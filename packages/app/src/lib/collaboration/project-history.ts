import { encodeHeads, type DocHandle, type Repo, type UrlHeads } from '@automerge/automerge-repo';
import * as A from '@automerge/automerge';
import { assert } from '$lib/utils/assert';
import {
	isProjectDocument,
	type ProjectBranch,
	type ProjectBranchId,
	type ProjectCheckpoint,
	type ProjectCheckpointId,
	type ProjectDocument,
	type ProjectHistoryDocument,
	type ProjectMerge,
	type ProjectMemberDocument
} from './model';
import { isProjectMemberDocument, resolveProjectGraph, type ProjectGraph } from './project-graph';
import { describeProjectCheckpoint } from './checkpoint-title';
import { withProjectLock } from './project-lock';
import {
	applyProjectMergeMembers,
	createProjectMergePlan,
	publishProjectMergeRoot,
	resolveProjectCheckpointSnapshot,
	resolveProjectMergePlan,
	type ProjectCheckpointSnapshot,
	type ProjectMergePlan,
	type ProjectMergeResolution,
	type ResolvedProjectMerge
} from './project-merge';
import type { PendingMergeOperation } from './project-config';

export const MAIN_BRANCH_ID = 'main';

export type ProjectMergeProgress =
	| 'journal:prepared'
	| 'members:flushed'
	| 'journal:members-applied'
	| 'root:flushed'
	| 'journal:root-published'
	| 'checkpoint:flushed'
	| 'journal:checkpoint-recorded'
	| 'history:flushed'
	| 'journal:history-finalized';

export async function createProjectHistory(
	repo: Repo,
	graph: ProjectGraph
): Promise<DocHandle<ProjectHistoryDocument>> {
	const checkpoint = await checkpointFromGraph(repo, MAIN_BRANCH_ID, graph, 'Initial project');
	const handle = repo.create<ProjectHistoryDocument>({
		type: 'digitable-project-history',
		schemaVersion: 2,
		checkedOutBranchId: MAIN_BRANCH_ID,
		branches: {
			[MAIN_BRANCH_ID]: {
				name: 'Main',
				rootUrl: graph.projectHandle.url,
				createdAt: checkpoint.createdAt
			}
		},
		checkpoints: { [checkpoint.id]: checkpoint },
		merges: {}
	});
	await repo.flush([handle.documentId]);
	return handle;
}

export async function upgradeProjectHistory(
	repo: Repo,
	historyHandle: DocHandle<ProjectHistoryDocument>
): Promise<void> {
	const history = historyHandle.doc();
	assert(history, 'The project history is unavailable.');
	if (history.schemaVersion === 2) {
		for (const [branchId, branch] of Object.entries(history.branches)) {
			if (branchId === MAIN_BRANCH_ID) continue;
			assert(branch.baseCheckpointId, `Project branch "${branch.name}" has no Base checkpoint.`);
			const base = history.checkpoints[branch.baseCheckpointId];
			assert(base, `Project branch "${branch.name}" has an invalid Base checkpoint.`);
		}
		return;
	}
	historyHandle.change(
		(document) => {
			for (const [branchId, branch] of Object.entries(document.branches)) {
				if (branchId === MAIN_BRANCH_ID) continue;
				const checkpointId = branch.baseCheckpointId ?? branch.forkCheckpointId;
				assert(checkpointId, `Project branch "${branch.name}" has no Base checkpoint.`);
				const checkpoint = document.checkpoints[checkpointId];
				assert(checkpoint, `Project branch "${branch.name}" has an invalid Base checkpoint.`);
				branch.baseCheckpointId = checkpointId;
				branch.baseBranchId = checkpoint.branchId;
				delete branch.forkCheckpointId;
			}
			document.schemaVersion = 2;
		},
		{ message: 'Upgrade project history to schema 2' }
	);
	await repo.flush([historyHandle.documentId]);
}

export async function resolveBranchGraph(
	repo: Repo,
	historyHandle: DocHandle<ProjectHistoryDocument>,
	branchId = historyHandle.doc()?.checkedOutBranchId
): Promise<{ branchId: ProjectBranchId; branch: ProjectBranch; graph: ProjectGraph }> {
	assert(branchId, 'Project history has no checked-out branch.');
	const branch = historyHandle.doc()?.branches[branchId];
	assert(branch, `Project branch "${branchId}" does not exist.`);
	if (branch.deletedAt !== undefined)
		throw new Error(`Project branch "${branch.name}" was deleted.`);
	const root = await repo.find<ProjectDocument>(branch.rootUrl);
	return { branchId, branch, graph: await resolveProjectGraph(repo, root) };
}

export async function recordProjectCheckpoint(
	repo: Repo,
	historyHandle: DocHandle<ProjectHistoryDocument>,
	branchId: ProjectBranchId,
	graph: ProjectGraph,
	message?: string
): Promise<ProjectCheckpointId> {
	return withProjectLock(`checkpoint:${historyHandle.url}:${branchId}`, async () => {
		const automatic = message === undefined;
		const checkpoint = await checkpointFromGraph(repo, branchId, graph, message ?? 'Project edit');
		while (true) {
			const history = historyHandle.doc();
			const existing = Object.values(history?.checkpoints ?? {}).find(
				(candidate) => candidate.branchId === branchId && sameCheckpointState(candidate, checkpoint)
			);
			if (existing) return existing.id;
			const previous = history ? branchCheckpoints(history, branchId)[0] : undefined;
			checkpoint.message =
				automatic && previous
					? await describeProjectCheckpoint(repo, previous, checkpoint).catch(() => 'Project edit')
					: (message ?? 'Project edit');

			const latest = historyHandle.doc();
			const duplicate = Object.values(latest?.checkpoints ?? {}).find(
				(candidate) => candidate.branchId === branchId && sameCheckpointState(candidate, checkpoint)
			);
			if (duplicate) return duplicate.id;
			const latestPrevious = latest ? branchCheckpoints(latest, branchId)[0] : undefined;
			if (automatic && latestPrevious?.id !== previous?.id) continue;

			historyHandle.change(
				(document) => {
					document.checkpoints[checkpoint.id] ??= checkpoint;
				},
				{ message: `Record project checkpoint: ${checkpoint.message}` }
			);
			await repo.flush([historyHandle.documentId]);
			return checkpoint.id;
		}
	});
}

export async function forkProjectCheckpoint(
	repo: Repo,
	historyHandle: DocHandle<ProjectHistoryDocument>,
	checkpointId: ProjectCheckpointId,
	name: string
): Promise<ProjectBranchId> {
	const checkpoint = historyHandle.doc()?.checkpoints[checkpointId];
	assert(checkpoint, `Project checkpoint "${checkpointId}" does not exist.`);
	const sourceRoot = await repo.find<ProjectDocument>(checkpoint.rootUrl);
	const rootAtCheckpoint = sourceRoot.view(checkpoint.rootHeads).doc();
	if (!isProjectDocument(rootAtCheckpoint)) {
		throw new Error('The project root is unavailable at the selected checkpoint.');
	}

	const memberUrls = new Map<string, string>();
	const memberHandles: DocHandle<ProjectMemberDocument>[] = [];
	for (const [memberId, member] of Object.entries(checkpoint.members)) {
		const source = await repo.find<ProjectMemberDocument>(member.url);
		const view = source.view(member.heads);
		if (!isProjectMemberDocument(member.kind, view.doc()))
			throw new Error(`Project member ${member.path} is unavailable at the checkpoint.`);
		if (member.kind === 'asset') {
			memberUrls.set(memberId, member.url);
			continue;
		}
		const clone = repo.clone(view);
		memberUrls.set(memberId, clone.url);
		memberHandles.push(clone);
	}

	const project = structuredClone(rootAtCheckpoint) as ProjectDocument;
	for (const [memberId, url] of memberUrls) project.members[memberId].url = url as never;
	const root = repo.create<ProjectDocument>(project);
	await repo.flush([root.documentId, ...memberHandles.map((handle) => handle.documentId)]);

	const branchId = crypto.randomUUID();
	const createdAt = Date.now();
	const branchGraph = await resolveProjectGraph(repo, root);
	const branchCheckpoint = await checkpointFromGraph(
		repo,
		branchId,
		branchGraph,
		`Fork ${name.trim() || 'Branch'}`
	);
	historyHandle.change(
		(history) => {
			history.branches[branchId] = {
				name: name.trim() || 'Branch',
				rootUrl: root.url,
				parentBranchId: checkpoint.branchId,
				baseCheckpointId: checkpoint.id,
				baseBranchId: checkpoint.branchId,
				createdAt
			};
			history.checkpoints[branchCheckpoint.id] = branchCheckpoint;
			history.checkedOutBranchId = branchId;
		},
		{ message: `Fork branch ${name.trim() || 'Branch'}` }
	);
	await repo.flush([historyHandle.documentId]);
	return branchId;
}

export async function prepareProjectMerge(
	repo: Repo,
	historyHandle: DocHandle<ProjectHistoryDocument>,
	branchId: ProjectBranchId
): Promise<ProjectMergePlan> {
	const history = historyHandle.doc();
	const branch = history?.branches[branchId];
	assert(branch, `Project branch "${branchId}" does not exist.`);
	assert(
		branch.mergedAt === undefined && branch.deletedAt === undefined,
		'The source branch is unavailable.'
	);
	assert(branch.parentBranchId, 'Main cannot be merged into a parent branch.');
	const parent = history?.branches[branch.parentBranchId];
	assert(parent, 'The parent branch does not exist.');
	const baseCheckpointId = branch.baseCheckpointId ?? branch.forkCheckpointId;
	assert(baseCheckpointId, 'The source branch has no Base checkpoint.');
	const baseCheckpoint = history?.checkpoints[baseCheckpointId];
	assert(baseCheckpoint, 'The source branch Base checkpoint does not exist.');
	if (branch.baseBranchId) {
		assert(
			baseCheckpoint.branchId === branch.baseBranchId,
			'The Base checkpoint belongs to the wrong branch.'
		);
	}
	const source = await resolveBranchGraph(repo, historyHandle, branchId);
	const target = await resolveBranchGraph(repo, historyHandle, branch.parentBranchId);
	const sourceCheckpointId = await recordProjectCheckpoint(
		repo,
		historyHandle,
		branchId,
		source.graph,
		`Before merging ${branch.name}`
	);
	const targetCheckpointId = await recordProjectCheckpoint(
		repo,
		historyHandle,
		branch.parentBranchId,
		target.graph,
		`Before merging ${branch.name}`
	);
	const checkpoints = historyHandle.doc()?.checkpoints;
	const sourceCheckpoint = checkpoints?.[sourceCheckpointId];
	const targetCheckpoint = checkpoints?.[targetCheckpointId];
	assert(sourceCheckpoint && targetCheckpoint, 'The merge checkpoints are unavailable.');
	const [baseSnapshot, targetSnapshot, sourceSnapshot] = await Promise.all([
		resolveProjectCheckpointSnapshot(repo, baseCheckpoint),
		resolveProjectCheckpointSnapshot(repo, targetCheckpoint),
		resolveProjectCheckpointSnapshot(repo, sourceCheckpoint)
	]);
	assert(
		sameCheckpointGraphState(sourceCheckpoint, source.graph),
		'The source branch changed while preparing the merge.'
	);
	assert(
		sameCheckpointGraphState(targetCheckpoint, target.graph),
		'The parent branch changed while preparing the merge.'
	);
	return createProjectMergePlan({
		sourceBranchId: branchId,
		targetBranchId: branch.parentBranchId,
		sourceBranchName: branch.name,
		targetBranchName: parent.name,
		base: baseSnapshot,
		parent: targetSnapshot,
		branch: sourceSnapshot
	});
}

export async function commitProjectMerge(
	repo: Repo,
	historyHandle: DocHandle<ProjectHistoryDocument>,
	plan: ProjectMergePlan,
	resolutions: ProjectMergeResolution[],
	writePending: (pending: PendingMergeOperation) => Promise<void>,
	onProgress?: (progress: ProjectMergeProgress) => Promise<void>
): Promise<ProjectCheckpointId> {
	const history = historyHandle.doc();
	const sourceBranch = history?.branches[plan.sourceBranchId];
	assert(
		sourceBranch?.parentBranchId === plan.targetBranchId,
		'The merge target changed. Prepare the merge again.'
	);
	const targetBranch = history?.branches[plan.targetBranchId];
	assert(targetBranch, 'The merge target no longer exists.');
	const baseCheckpoint = history?.checkpoints[plan.baseCheckpointId];
	const sourceCheckpoint = history?.checkpoints[plan.sourceCheckpointId];
	const targetCheckpoint = history?.checkpoints[plan.targetCheckpointId];
	assert(
		baseCheckpoint && sourceCheckpoint && targetCheckpoint,
		'A reviewed merge checkpoint is unavailable.'
	);
	const [source, target] = await Promise.all([
		resolveBranchGraph(repo, historyHandle, plan.sourceBranchId),
		resolveBranchGraph(repo, historyHandle, plan.targetBranchId)
	]);
	assert(
		sameCheckpointGraphState(sourceCheckpoint, source.graph),
		'The source branch changed. Prepare the merge again.'
	);
	assert(
		sameCheckpointGraphState(targetCheckpoint, target.graph),
		'The parent branch changed. Prepare the merge again.'
	);
	const snapshots = await Promise.all([
		resolveProjectCheckpointSnapshot(repo, baseCheckpoint),
		resolveProjectCheckpointSnapshot(repo, targetCheckpoint),
		resolveProjectCheckpointSnapshot(repo, sourceCheckpoint)
	]);
	const currentPlan = createProjectMergePlan({
		id: plan.id,
		sourceBranchId: plan.sourceBranchId,
		targetBranchId: plan.targetBranchId,
		sourceBranchName: sourceBranch.name,
		targetBranchName: targetBranch.name,
		base: snapshots[0],
		parent: snapshots[1],
		branch: snapshots[2]
	});
	assert(
		JSON.stringify(currentPlan.conflicts) === JSON.stringify(plan.conflicts),
		'The reviewed merge plan is stale.'
	);
	const resolved = resolveProjectMergePlan(currentPlan, resolutions);
	const appliedMemberHeads = await expectedProjectMergeMemberHeads(
		repo,
		snapshots[1],
		snapshots[2],
		resolved.mutableMemberIds
	);
	const pending: PendingMergeOperation = {
		version: 2,
		type: 'merge',
		operationId: plan.id,
		phase: 'prepared',
		sourceBranchId: plan.sourceBranchId,
		targetBranchId: plan.targetBranchId,
		baseCheckpointId: plan.baseCheckpointId,
		sourceCheckpointId: plan.sourceCheckpointId,
		targetCheckpointId: plan.targetCheckpointId,
		resolutions,
		mutableMemberIds: resolved.mutableMemberIds,
		finalMembers: resolved.members,
		finalComponents: resolved.components,
		appliedMemberHeads
	};
	await writePending(pending);
	await onProgress?.('journal:prepared');
	return resumeProjectMerge(repo, historyHandle, pending, writePending, onProgress);
}

export async function resumeProjectMerge(
	repo: Repo,
	historyHandle: DocHandle<ProjectHistoryDocument>,
	pending: PendingMergeOperation,
	writePending: (pending: PendingMergeOperation) => Promise<void>,
	onProgress?: (progress: ProjectMergeProgress) => Promise<void>
): Promise<ProjectCheckpointId> {
	const history = historyHandle.doc();
	assert(history, 'The project history is unavailable.');
	if (pending.phase === 'history-finalized') {
		assert(pending.resultCheckpointId, 'The finalized merge has no result checkpoint.');
		const merge = history.merges[pending.operationId];
		assert(
			merge &&
				'baseCheckpointId' in merge &&
				merge.baseCheckpointId === pending.baseCheckpointId &&
				merge.sourceCheckpointId === pending.sourceCheckpointId &&
				merge.targetCheckpointId === pending.targetCheckpointId &&
				merge.resultCheckpointId === pending.resultCheckpointId &&
				history.checkpoints[pending.resultCheckpointId] &&
				history.branches[pending.sourceBranchId]?.mergedAt !== undefined &&
				history.checkedOutBranchId === pending.targetBranchId,
			'The finalized merge history is incomplete.'
		);
		return pending.resultCheckpointId;
	}
	const baseCheckpoint = history.checkpoints[pending.baseCheckpointId];
	const sourceCheckpoint = history.checkpoints[pending.sourceCheckpointId];
	const targetCheckpoint = history.checkpoints[pending.targetCheckpointId];
	assert(
		baseCheckpoint && sourceCheckpoint && targetCheckpoint,
		'A pending merge checkpoint is unavailable.'
	);
	const targetBranch = history.branches[pending.targetBranchId];
	const sourceBranch = history.branches[pending.sourceBranchId];
	assert(targetBranch && sourceBranch, 'A pending merge branch is unavailable.');
	const [base, target, branch] = await Promise.all([
		resolveProjectCheckpointSnapshot(repo, baseCheckpoint),
		resolveProjectCheckpointSnapshot(repo, targetCheckpoint),
		resolveProjectCheckpointSnapshot(repo, sourceCheckpoint)
	]);
	const reviewed = createProjectMergePlan({
		id: pending.operationId,
		sourceBranchId: pending.sourceBranchId,
		targetBranchId: pending.targetBranchId,
		sourceBranchName: sourceBranch.name,
		targetBranchName: targetBranch.name,
		base,
		parent: target,
		branch
	});
	const planned = resolveProjectMergePlan(reviewed, pending.resolutions);
	const expectedMemberHeads = await expectedProjectMergeMemberHeads(
		repo,
		target,
		branch,
		planned.mutableMemberIds
	);
	assert(
		JSON.stringify(planned.members) === JSON.stringify(pending.finalMembers) &&
			JSON.stringify(planned.components) === JSON.stringify(pending.finalComponents) &&
			JSON.stringify(planned.mutableMemberIds) === JSON.stringify(pending.mutableMemberIds) &&
			sameHeadsRecord(expectedMemberHeads, pending.appliedMemberHeads),
		'The pending merge journal does not match its reviewed checkpoints.'
	);
	const source = await resolveBranchGraph(repo, historyHandle, pending.sourceBranchId);
	assert(
		sameCheckpointGraphState(sourceCheckpoint, source.graph),
		'The source branch changed after merge preparation.'
	);
	const targetRoot = await repo.find<ProjectDocument>(targetBranch.rootUrl);
	const resolved: ResolvedProjectMerge = {
		members: pending.finalMembers,
		components: pending.finalComponents,
		mutableMemberIds: pending.mutableMemberIds
	};
	if (pending.phase === 'prepared') {
		const targetLive = await resolveBranchGraph(repo, historyHandle, pending.targetBranchId);
		assert(
			mergeMembersAreRecoverable(targetCheckpoint, targetLive.graph, pending.appliedMemberHeads),
			'The parent changed after merge preparation.'
		);
		await applyProjectMergeMembers({ repo, branch, resolved });
		for (const [memberId, heads] of Object.entries(pending.appliedMemberHeads)) {
			const handle = await repo.find<ProjectMemberDocument>(resolved.members[memberId].url);
			assert(
				sameHeads(heads, handle.heads()),
				`Parent member ${resolved.members[memberId].path} did not reach its planned state.`
			);
		}
		await onProgress?.('members:flushed');
		pending = { ...pending, phase: 'members-applied' };
		await writePending(pending);
		await onProgress?.('journal:members-applied');
	}
	if (pending.phase === 'members-applied') {
		for (const [memberId, heads] of Object.entries(pending.appliedMemberHeads)) {
			const handle = await repo.find<ProjectMemberDocument>(resolved.members[memberId].url);
			assert(
				sameHeads(heads, handle.heads()),
				`Parent member ${resolved.members[memberId].path} changed during merge recovery.`
			);
		}
		if (sameHeads(targetCheckpoint.rootHeads, targetRoot.heads())) {
			await publishProjectMergeRoot(repo, targetRoot, resolved);
		} else {
			assert(
				sameProjectStructure(targetRoot.doc(), resolved),
				'The parent structure changed while applying the merge root.'
			);
		}
		await onProgress?.('root:flushed');
		pending = { ...pending, phase: 'root-published', publishedRootHeads: targetRoot.heads() };
		await writePending(pending);
		await onProgress?.('journal:root-published');
	}
	let resultCheckpointId = pending.resultCheckpointId;
	if (pending.phase === 'root-published') {
		assert(pending.publishedRootHeads, 'The pending merge is missing published root heads.');
		assert(
			sameHeads(pending.publishedRootHeads, targetRoot.heads()) &&
				sameProjectStructure(targetRoot.doc(), resolved),
			'The parent changed after the merge root was published.'
		);
		const graph = await resolveProjectGraph(repo, targetRoot);
		resultCheckpointId = await recordProjectCheckpoint(
			repo,
			historyHandle,
			pending.targetBranchId,
			graph,
			`Merge ${sourceBranch.name}`
		);
		await onProgress?.('checkpoint:flushed');
		pending = { ...pending, phase: 'checkpoint-recorded', resultCheckpointId };
		await writePending(pending);
		await onProgress?.('journal:checkpoint-recorded');
	}
	assert(resultCheckpointId, 'The pending merge has no result checkpoint.');
	if (pending.phase === 'checkpoint-recorded') {
		assert(pending.publishedRootHeads, 'The pending merge is missing published root heads.');
		assert(
			sameHeads(pending.publishedRootHeads, targetRoot.heads()),
			'The parent changed before merge history was finalized.'
		);
		historyHandle.change(
			(document) => {
				const existing = document.merges[pending.operationId];
				if (!existing) {
					const merge: ProjectMerge = {
						id: pending.operationId,
						sourceBranchId: pending.sourceBranchId,
						targetBranchId: pending.targetBranchId,
						baseCheckpointId: pending.baseCheckpointId,
						sourceCheckpointId: pending.sourceCheckpointId,
						targetCheckpointId: pending.targetCheckpointId,
						resultCheckpointId: resultCheckpointId!,
						createdAt: Date.now()
					};
					document.merges[pending.operationId] = merge;
				}
				document.branches[pending.sourceBranchId].mergedAt ??= Date.now();
				for (const child of Object.values(document.branches)) {
					if (child.parentBranchId === pending.sourceBranchId)
						child.parentBranchId = pending.targetBranchId;
				}
				document.checkedOutBranchId = pending.targetBranchId;
			},
			{ message: `Merge ${sourceBranch.name} into ${targetBranch.name}` }
		);
		await repo.flush([historyHandle.documentId]);
		await onProgress?.('history:flushed');
		pending = { ...pending, phase: 'history-finalized', resultCheckpointId };
		await writePending(pending);
		await onProgress?.('journal:history-finalized');
	}
	return resultCheckpointId;
}

function sameProjectStructure(
	project: ProjectDocument | undefined,
	resolved: ResolvedProjectMerge
): boolean {
	if (!project) return false;
	const memberIds = Object.keys(resolved.members);
	const componentIds = Object.keys(resolved.components);
	return (
		memberIds.length === Object.keys(project.members).length &&
		componentIds.length === Object.keys(project.components).length &&
		memberIds.every(
			(id) => JSON.stringify(project.members[id]) === JSON.stringify(resolved.members[id])
		) &&
		componentIds.every(
			(id) => JSON.stringify(project.components[id]) === JSON.stringify(resolved.components[id])
		)
	);
}

/** Recovers the schema-1 journal before history migration. */
export async function mergeProjectBranch(
	repo: Repo,
	historyHandle: DocHandle<ProjectHistoryDocument>,
	branchId: ProjectBranchId,
	targetBranchId: ProjectBranchId,
	writePending: (pending: PendingMergeOperation) => Promise<void>,
	onProgress?: (progress: ProjectMergeProgress) => Promise<void>
): Promise<ProjectCheckpointId> {
	await upgradeProjectHistory(repo, historyHandle);
	const history = historyHandle.doc();
	const branch = history?.branches[branchId];
	assert(branch, `Project branch "${branchId}" does not exist.`);
	assert(
		branch.parentBranchId === targetBranchId,
		'The interrupted legacy merge target has changed.'
	);
	const completed = Object.values(history?.merges ?? {}).find(
		(merge) =>
			merge.sourceBranchId === branchId &&
			(!branch.parentBranchId || merge.targetBranchId === branch.parentBranchId)
	);
	if (completed) return completed.resultCheckpointId;
	assert(branch.mergedAt === undefined, 'The interrupted legacy merge has no merge record.');
	const plan = await prepareProjectMerge(repo, historyHandle, branchId);
	assert(plan.conflicts.length === 0, 'The interrupted legacy merge now requires review.');
	return commitProjectMerge(repo, historyHandle, plan, [], writePending, onProgress);
}

export function checkoutProjectBranch(
	historyHandle: DocHandle<ProjectHistoryDocument>,
	branchId: ProjectBranchId
): void {
	const branch = historyHandle.doc()?.branches[branchId];
	assert(
		branch && branch.deletedAt === undefined && branch.mergedAt === undefined,
		'Branch is unavailable.'
	);
	historyHandle.change(
		(history) => {
			history.checkedOutBranchId = branchId;
		},
		{ message: `Check out ${branch.name}` }
	);
}

export function renameProjectBranch(
	historyHandle: DocHandle<ProjectHistoryDocument>,
	branchId: ProjectBranchId,
	name: string
): void {
	const trimmed = name.trim();
	assert(trimmed, 'Branch name cannot be empty.');
	historyHandle.change((history) => {
		assert(history.branches[branchId], 'Branch does not exist.');
		history.branches[branchId].name = trimmed;
	});
}

export function deleteProjectBranch(
	historyHandle: DocHandle<ProjectHistoryDocument>,
	branchId: ProjectBranchId
): void {
	const branch = historyHandle.doc()?.branches[branchId];
	assert(branch?.parentBranchId, 'Main cannot be deleted.');
	historyHandle.change((history) => {
		const pending = [branchId];
		while (pending.length) {
			const current = pending.pop()!;
			const candidate = history.branches[current];
			if (!candidate || candidate.deletedAt !== undefined) continue;
			candidate.deletedAt = Date.now();
			for (const [childId, child] of Object.entries(history.branches)) {
				if (child.parentBranchId === current) pending.push(childId);
			}
		}
		history.checkedOutBranchId = branch.parentBranchId!;
	});
}

export function branchCheckpoints(
	history: ProjectHistoryDocument,
	branchId: ProjectBranchId
): ProjectCheckpoint[] {
	return Object.values(history.checkpoints)
		.filter((checkpoint) => checkpoint.branchId === branchId)
		.sort((left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id));
}

async function checkpointFromGraph(
	repo: Repo,
	branchId: ProjectBranchId,
	graph: ProjectGraph,
	message: string
): Promise<ProjectCheckpoint> {
	const rootHeads = graph.projectHandle.heads();
	const project = graph.projectHandle.view(rootHeads).doc();
	assert(isProjectDocument(project), 'The project root is unavailable while checkpointing.');
	const resolved = await Promise.all(
		Object.entries(project.members).map(async ([memberId, member]) => {
			const current = graph.memberHandles.get(memberId);
			const handle =
				current?.url === member.url ? current : await repo.find<ProjectMemberDocument>(member.url);
			assert(
				isProjectMemberDocument(member.kind, handle.doc()),
				`Project member ${member.path} is unavailable.`
			);
			return [memberId, { ...member, heads: handle.heads() }, handle] as const;
		})
	);
	await repo.flush([
		graph.projectHandle.documentId,
		...resolved.map(([, , handle]) => handle.documentId)
	]);
	if (!sameHeads(rootHeads, graph.projectHandle.heads())) {
		return checkpointFromGraph(
			repo,
			branchId,
			await resolveProjectGraph(repo, graph.projectHandle),
			message
		);
	}
	const members = Object.fromEntries(resolved.map(([id, member]) => [id, member]));
	return {
		id: crypto.randomUUID(),
		branchId,
		createdAt: Date.now(),
		message,
		rootUrl: graph.projectHandle.url,
		rootHeads,
		members
	};
}

function sameHeads(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((head) => right.includes(head));
}

function sameCheckpointState(left: ProjectCheckpoint, right: ProjectCheckpoint): boolean {
	if (left.rootUrl !== right.rootUrl || !sameHeads(left.rootHeads, right.rootHeads)) return false;
	const leftIds = Object.keys(left.members);
	const rightIds = Object.keys(right.members);
	return (
		leftIds.length === rightIds.length &&
		leftIds.every((id) => {
			const leftMember = left.members[id];
			const rightMember = right.members[id];
			return (
				!!rightMember &&
				leftMember.url === rightMember.url &&
				leftMember.path === rightMember.path &&
				sameHeads(leftMember.heads, rightMember.heads)
			);
		})
	);
}

function sameCheckpointGraphState(checkpoint: ProjectCheckpoint, graph: ProjectGraph): boolean {
	if (
		checkpoint.rootUrl !== graph.projectHandle.url ||
		!sameHeads(checkpoint.rootHeads, graph.projectHandle.heads())
	) {
		return false;
	}
	const checkpointIds = Object.keys(checkpoint.members);
	const projectIds = Object.keys(graph.projectHandle.doc()?.members ?? {});
	return (
		checkpointIds.length === projectIds.length &&
		checkpointIds.every((id) => {
			const member = checkpoint.members[id];
			const handle = graph.memberHandles.get(id);
			return !!handle && handle.url === member.url && sameHeads(handle.heads(), member.heads);
		})
	);
}

async function expectedProjectMergeMemberHeads(
	repo: Repo,
	target: ProjectCheckpointSnapshot,
	branch: ProjectCheckpointSnapshot,
	memberIds: string[]
): Promise<Record<string, UrlHeads>> {
	return Object.fromEntries(
		await Promise.all(
			memberIds.map(async (memberId) => {
				const targetMember = target.checkpoint.members[memberId];
				const branchMember = branch.checkpoint.members[memberId];
				assert(targetMember && branchMember, 'A mutable merge member is unavailable.');
				const [targetHandle, branchHandle] = await Promise.all([
					repo.find<ProjectMemberDocument>(targetMember.url),
					repo.find<ProjectMemberDocument>(branchMember.url)
				]);
				const targetDocument = targetHandle.view(targetMember.heads).doc();
				const branchDocument = branchHandle.view(branchMember.heads).doc();
				if (!targetDocument || !branchDocument) {
					throw new Error(`Mutable member ${targetMember.path} is unavailable.`);
				}
				assert(
					isProjectMemberDocument(targetMember.kind, targetDocument) &&
						isProjectMemberDocument(branchMember.kind, branchDocument),
					`Mutable member ${targetMember.path} is unavailable.`
				);
				const merged = A.merge<ProjectMemberDocument>(A.clone(targetDocument), branchDocument);
				return [memberId, encodeHeads(A.getHeads(merged))] as const;
			})
		)
	);
}

function mergeMembersAreRecoverable(
	checkpoint: ProjectCheckpoint,
	graph: ProjectGraph,
	expected: Record<string, readonly string[]>
): boolean {
	if (
		checkpoint.rootUrl !== graph.projectHandle.url ||
		!sameHeads(checkpoint.rootHeads, graph.projectHandle.heads())
	) {
		return false;
	}
	const checkpointIds = Object.keys(checkpoint.members);
	const projectIds = Object.keys(graph.projectHandle.doc()?.members ?? {});
	return (
		checkpointIds.length === projectIds.length &&
		checkpointIds.every((id) => {
			const member = checkpoint.members[id];
			const handle = graph.memberHandles.get(id);
			if (!handle || handle.url !== member.url) return false;
			return (
				sameHeads(handle.heads(), member.heads) || sameHeads(handle.heads(), expected[id] ?? [])
			);
		})
	);
}

function sameHeadsRecord(
	left: Record<string, readonly string[]>,
	right: Record<string, readonly string[]>
): boolean {
	const ids = Object.keys(left);
	return (
		ids.length === Object.keys(right).length &&
		ids.every((id) => sameHeads(left[id], right[id] ?? []))
	);
}
