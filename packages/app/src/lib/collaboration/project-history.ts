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
	type ProjectMemberDocument
} from './model';
import { resolveProjectGraph, type ProjectGraph } from './project-graph';

export const MAIN_BRANCH_ID = 'main';

export async function createProjectHistory(
	repo: Repo,
	graph: ProjectGraph
): Promise<DocHandle<ProjectHistoryDocument>> {
	const checkpoint = await checkpointFromGraph(repo, MAIN_BRANCH_ID, graph, 'Initial project');
	const handle = repo.create<ProjectHistoryDocument>({
		type: 'digitable-project-history',
		schemaVersion: 1,
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
	message: string
): Promise<ProjectCheckpointId> {
	const checkpoint = await checkpointFromGraph(repo, branchId, graph, message);
	const existing = Object.values(historyHandle.doc()?.checkpoints ?? {}).find(
		(candidate) => candidate.branchId === branchId && sameCheckpointState(candidate, checkpoint)
	);
	if (existing) return existing.id;
	historyHandle.change(
		(history) => {
			history.checkpoints[checkpoint.id] ??= checkpoint;
		},
		{ message: `Record project checkpoint: ${message}` }
	);
	await repo.flush([historyHandle.documentId]);
	return checkpoint.id;
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
		if (!view.doc())
			throw new Error(`Project member ${member.path} is unavailable at the checkpoint.`);
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
				forkCheckpointId: checkpoint.id,
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

export async function mergeProjectBranch(
	repo: Repo,
	historyHandle: DocHandle<ProjectHistoryDocument>,
	branchId: ProjectBranchId,
	onPrepared: (targetBranchId: ProjectBranchId) => Promise<void> = async () => undefined
): Promise<ProjectCheckpointId> {
	const history = historyHandle.doc();
	const branch = history?.branches[branchId];
	assert(branch, `Project branch "${branchId}" does not exist.`);
	assert(branch.parentBranchId, 'Main cannot be merged into a parent branch.');
	const parent = history?.branches[branch.parentBranchId];
	assert(parent, 'The parent branch does not exist.');

	const source = await resolveBranchGraph(repo, historyHandle, branchId);
	const target = await resolveBranchGraph(repo, historyHandle, branch.parentBranchId);
	assertCompatibleStructure(source.graph.project, target.graph.project);
	for (const [memberId, sourceMember] of Object.entries(source.graph.project.members)) {
		if (sourceMember.kind !== 'asset') continue;
		const targetMember = target.graph.project.members[memberId];
		if (sourceMember.hash !== targetMember?.hash) {
			throw new Error('Binary asset changes cannot be merged between branches yet.');
		}
	}
	await onPrepared(branch.parentBranchId);
	const sourceCheckpointId = await recordProjectCheckpoint(
		repo,
		historyHandle,
		branchId,
		source.graph,
		`Before merging ${branch.name}`
	);

	for (const [memberId, sourceMember] of Object.entries(source.graph.project.members)) {
		const targetMember = target.graph.project.members[memberId];
		assert(targetMember, `Parent branch is missing ${sourceMember.path}.`);
		if (sourceMember.kind === 'asset') {
			continue;
		}
		const sourceHandle = source.graph.memberHandles.get(memberId);
		const targetHandle = target.graph.memberHandles.get(memberId);
		assert(sourceHandle && targetHandle, `Project member ${sourceMember.path} is unavailable.`);
		targetHandle.merge(sourceHandle);
	}
	await repo.flush(Array.from(target.graph.memberHandles.values(), (handle) => handle.documentId));
	const refreshedTarget = await resolveProjectGraph(repo, target.graph.projectHandle);
	const resultCheckpointId = await recordProjectCheckpoint(
		repo,
		historyHandle,
		branch.parentBranchId,
		refreshedTarget,
		`Merge ${branch.name}`
	);
	const mergeId = crypto.randomUUID();
	historyHandle.change(
		(document) => {
			document.branches[branchId].mergedAt = Date.now();
			for (const child of Object.values(document.branches)) {
				if (child.parentBranchId === branchId) child.parentBranchId = branch.parentBranchId;
			}
			document.checkedOutBranchId = branch.parentBranchId!;
			document.merges[mergeId] = {
				sourceBranchId: branchId,
				targetBranchId: branch.parentBranchId!,
				sourceCheckpointId,
				resultCheckpointId,
				createdAt: Date.now()
			};
		},
		{ message: `Merge ${branch.name} into ${parent.name}` }
	);
	await repo.flush([historyHandle.documentId]);
	return resultCheckpointId;
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
	const members = Object.fromEntries(
		Object.entries(graph.project.members).map(([memberId, member]) => {
			const handle = graph.memberHandles.get(memberId);
			assert(handle, `Project member ${member.path} is unavailable.`);
			return [memberId, { ...member, heads: handle.heads() }];
		})
	);
	await repo.flush([
		graph.projectHandle.documentId,
		...Array.from(graph.memberHandles.values(), (handle) => handle.documentId)
	]);
	if (!sameHeads(rootHeads, graph.projectHandle.heads())) {
		return checkpointFromGraph(
			repo,
			branchId,
			await resolveProjectGraph(repo, graph.projectHandle),
			message
		);
	}
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

function assertCompatibleStructure(source: ProjectDocument, target: ProjectDocument): void {
	const normalize = (project: ProjectDocument) => ({
		members: Object.fromEntries(
			Object.entries(project.members).map(([id, member]) => [
				id,
				{ kind: member.kind, path: member.path, componentId: member.componentId }
			])
		),
		components: project.components
	});
	if (JSON.stringify(normalize(source)) !== JSON.stringify(normalize(target))) {
		throw new Error('Branches with structural project changes cannot be merged yet.');
	}
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
