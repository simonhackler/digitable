import type { DocHandle, Repo } from '@automerge/automerge-repo';
import {
	GAME_METADATA_MEMBER_ID,
	isBinaryFileDocument,
	isComponentDataDocument,
	isGameMetadataDocument,
	isProjectDocument,
	isTextFileDocument,
	type ComponentDataDocument,
	type GameMetadataDocument,
	type ProjectDocument,
	type ProjectMemberDocument
} from './model';
import type { ProjectFileSource } from './project-files';

export type ProjectGraph = {
	projectHandle: DocHandle<ProjectDocument>;
	metadataHandle: DocHandle<GameMetadataDocument>;
	memberHandles: Map<string, DocHandle<ProjectMemberDocument>>;
	componentDataHandles: Map<string, DocHandle<ComponentDataDocument>>;
};

export async function createProjectGraph(repo: Repo, sources: ProjectFileSource[]): Promise<ProjectGraph> {
	const metadata = sources.find((source) => source.kind === 'game-metadata');
	const metadataDocument = await metadata?.document();
	if (!metadata || !metadataDocument || !isGameMetadataDocument(metadataDocument)) {
		throw new Error('Project is missing valid game.json metadata.');
	}
	const componentIds = new Map<string, string>();
	for (const source of sources) {
		if (source.componentName && !componentIds.has(source.componentName)) {
			componentIds.set(source.componentName, crypto.randomUUID());
		}
	}

	const members: ProjectDocument['members'] = {};
	const components: ProjectDocument['components'] = Object.fromEntries(
		[...componentIds].map(([name, id]) => [id, { name }])
	);
	const memberHandles = new Map<string, DocHandle<ProjectMemberDocument>>();
	for (const source of sources) {
		const id = source.kind === 'game-metadata' ? GAME_METADATA_MEMBER_ID : `file-${crypto.randomUUID()}`;
		const handle = repo.create<ProjectMemberDocument>(await source.document());
		const componentId = source.componentName ? componentIds.get(source.componentName) : undefined;
		members[id] = {
			kind: source.kind,
			path: source.path,
			url: handle.url,
			...(source.kind === 'asset' ? { hash: source.snapshot.hash } : {}),
			...(componentId ? { componentId } : {})
		};
		memberHandles.set(id, handle);
		if (!componentId) continue;
		const component = components[componentId];
		if (source.kind === 'component-data') component.dataMemberId = id;
		if (source.side === 'front') component.frontMemberId = id;
		if (source.side === 'back') component.backMemberId = id;
	}

	const projectHandle = repo.create<ProjectDocument>({
		type: 'digitable-project',
		schemaVersion: 2,
		members,
		components
	});
	await repo.flush([
		projectHandle.documentId,
		...Array.from(memberHandles.values(), (handle) => handle.documentId)
	]);
	return graphFromHandles(projectHandle, memberHandles);
}

export async function resolveProjectGraph(
	repo: Repo,
	projectHandle: DocHandle<unknown>
): Promise<ProjectGraph> {
	const project = projectHandle.doc();
	if (!isProjectDocument(project)) {
		throw new Error('The Automerge root document is not a supported Digitable project.');
	}
	const memberHandles = new Map<string, DocHandle<ProjectMemberDocument>>();
	for (const [id, member] of Object.entries(project.members)) {
		const handle = await repo.find<ProjectMemberDocument>(member.url);
		if (!isMemberDocument(member.kind, handle.doc())) {
			throw new Error(`Automerge project member ${member.path} has an unsupported format.`);
		}
		memberHandles.set(id, handle);
	}
	return graphFromHandles(projectHandle as DocHandle<ProjectDocument>, memberHandles);
}

function graphFromHandles(
	projectHandle: DocHandle<ProjectDocument>,
	memberHandles: Map<string, DocHandle<ProjectMemberDocument>>
): ProjectGraph {
	const project = projectHandle.doc();
	if (!project) throw new Error('The Automerge root document is unavailable.');
	const metadataHandle = memberHandles.get(GAME_METADATA_MEMBER_ID);
	if (!metadataHandle || !isGameMetadataDocument(metadataHandle.doc())) {
		throw new Error('The Automerge project is missing its game metadata member.');
	}
	const componentDataHandles = new Map<string, DocHandle<ComponentDataDocument>>();
	for (const [componentId, component] of Object.entries(project.components)) {
		if (!component.dataMemberId) continue;
		const handle = memberHandles.get(component.dataMemberId);
		if (!handle || !isComponentDataDocument(handle.doc())) {
			throw new Error(`Component "${component.name}" has unsupported Automerge data.`);
		}
		componentDataHandles.set(componentId, handle as DocHandle<ComponentDataDocument>);
	}
	return {
		projectHandle,
		metadataHandle: metadataHandle as DocHandle<GameMetadataDocument>,
		memberHandles,
		componentDataHandles
	};
}

function isMemberDocument(kind: ProjectDocument['members'][string]['kind'], value: unknown): boolean {
	if (kind === 'game-metadata') return isGameMetadataDocument(value);
	if (kind === 'component-data') return isComponentDataDocument(value);
	if (kind === 'asset') return isBinaryFileDocument(value);
	return isTextFileDocument(value);
}
