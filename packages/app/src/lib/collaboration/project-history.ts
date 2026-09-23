import type { DocHandle, Repo } from '@automerge/automerge-repo';
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
import { encodeText, hashBytes } from './filesystem';
import { withProjectLock } from './project-lock';
import {
	createMergedProjectRoot,
	createProjectMergePlan,
	resolveProjectCheckpointSnapshot,
	resolveProjectMergePlan,
	type ProjectMergePlan,
	type ProjectMergeResolution
} from './project-merge';

export const MAIN_BRANCH_ID = 'main';

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
	const baseCheckpointId = branch.baseCheckpointId;
	assert(baseCheckpointId, 'The source branch has no Base checkpoint.');
	const baseCheckpoint = history?.checkpoints[baseCheckpointId];
	assert(baseCheckpoint, 'The source branch Base checkpoint does not exist.');
	assert(history?.branches[baseCheckpoint.branchId], 'The Base checkpoint branch is unavailable.');
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
	resolutions: ProjectMergeResolution[]
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
	const root = await createMergedProjectRoot({
		repo,
		parent: snapshots[1],
		branch: snapshots[2],
		resolved
	});
	const graph = await resolveProjectGraph(repo, root);
	const resultCheckpoint = await checkpointFromGraph(
		repo,
		plan.targetBranchId,
		graph,
		`Merge ${sourceBranch.name}`
	);
	const [latestSource, latestTarget] = await Promise.all([
		resolveBranchGraph(repo, historyHandle, plan.sourceBranchId),
		resolveBranchGraph(repo, historyHandle, plan.targetBranchId)
	]);
	assert(
		sameCheckpointGraphState(sourceCheckpoint, latestSource.graph),
		'The source branch changed while applying the merge.'
	);
	assert(
		sameCheckpointGraphState(targetCheckpoint, latestTarget.graph),
		'The parent branch changed while applying the merge.'
	);

	const createdAt = Date.now();
	historyHandle.change(
		(document) => {
			const currentSource = document.branches[plan.sourceBranchId];
			const currentTarget = document.branches[plan.targetBranchId];
			assert(
				currentSource?.parentBranchId === plan.targetBranchId &&
					currentSource.mergedAt === undefined &&
					currentTarget?.rootUrl === targetCheckpoint.rootUrl,
				'The merge branches changed while publishing the merge.'
			);
			assert(!document.merges[plan.id], 'The merge was already published.');
			currentTarget.rootUrl = root.url;
			document.checkpoints[resultCheckpoint.id] = resultCheckpoint;
			const merge: ProjectMerge = {
				sourceBranchId: plan.sourceBranchId,
				targetBranchId: plan.targetBranchId,
				baseCheckpointId: plan.baseCheckpointId,
				sourceCheckpointId: plan.sourceCheckpointId,
				targetCheckpointId: plan.targetCheckpointId,
				resultCheckpointId: resultCheckpoint.id,
				createdAt
			};
			document.merges[plan.id] = merge;
			currentSource.mergedAt = createdAt;
			for (const child of Object.values(document.branches)) {
				if (child.parentBranchId === plan.sourceBranchId)
					child.parentBranchId = plan.targetBranchId;
			}
			document.checkedOutBranchId = plan.targetBranchId;
		},
		{ message: `Merge ${sourceBranch.name} into ${targetBranch.name}` }
	);
	await repo.flush([historyHandle.documentId]);
	return resultCheckpoint.id;
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
		id: await checkpointId(branchId, graph.projectHandle.url, rootHeads, members),
		branchId,
		createdAt: Date.now(),
		message,
		rootUrl: graph.projectHandle.url,
		rootHeads,
		members
	};
}

async function checkpointId(
	branchId: ProjectBranchId,
	rootUrl: string,
	rootHeads: readonly string[],
	members: ProjectCheckpoint['members']
): Promise<ProjectCheckpointId> {
	const state = {
		branchId,
		rootUrl,
		rootHeads: [...rootHeads].sort(),
		members: Object.fromEntries(
			Object.entries(members)
				.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
				.map(([id, member]) => [id, { url: member.url, heads: [...member.heads].sort() }])
		)
	};
	return `checkpoint-${await hashBytes(encodeText(JSON.stringify(state)))}`;
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
