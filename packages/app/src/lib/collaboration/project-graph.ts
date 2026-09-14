import type { DocHandle, Repo } from '@automerge/automerge-repo';
import {
	GAME_METADATA_MEMBER_ID,
	isBinaryFileDocument,
	isComponentDataDocument,
	isGameMetadataDocument,
	isMarkdownFileDocument,
	isProjectDocument,
	isTextFileDocument,
	type ComponentDataDocument,
	type GameMetadataDocument,
	type MarkdownFileDocument,
	type ProjectDocument,
	type ProjectMemberDocument
} from './model';
import {
	classifyProjectFile,
	projectComponentId,
	projectMemberId,
	type ProjectFileSource
} from './project-files';
import { applyMarkdown } from './markdown/markdown-codec';

export type ProjectGraph = {
	projectHandle: DocHandle<ProjectDocument>;
	project: ProjectDocument;
	metadataHandle: DocHandle<GameMetadataDocument>;
	memberHandles: Map<string, DocHandle<ProjectMemberDocument>>;
	componentDataHandles: Map<string, DocHandle<ComponentDataDocument>>;
};

export async function createProjectGraph(
	repo: Repo,
	sources: ProjectFileSource[]
): Promise<ProjectGraph> {
	const metadata = sources.find((source) => source.kind === 'game-metadata');
	const metadataDocument = await metadata?.document();
	if (!metadata || !metadataDocument || !isGameMetadataDocument(metadataDocument)) {
		throw new Error('Project is missing valid game.json metadata.');
	}
	const componentIds = new Map<string, string>();
	for (const source of sources) {
		if (source.componentName && !componentIds.has(source.componentName)) {
			componentIds.set(source.componentName, projectComponentId(source.componentName));
		}
	}

	const members: ProjectDocument['members'] = {};
	const components: ProjectDocument['components'] = Object.fromEntries(
		[...componentIds].map(([name, id]) => [id, { name }])
	);
	const memberHandles = new Map<string, DocHandle<ProjectMemberDocument>>();
	for (const source of sources) {
		const id =
			source.kind === 'game-metadata' ? GAME_METADATA_MEMBER_ID : projectMemberId(source.path);
		const handle = await createProjectMemberHandle(repo, source);
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
	return graphFromHandles(projectHandle, projectHandle.doc()!, memberHandles);
}

export async function createProjectMemberHandle(
	repo: Repo,
	source: ProjectFileSource
): Promise<DocHandle<ProjectMemberDocument>> {
	const handle = repo.create<ProjectMemberDocument>(await source.document());
	if (source.kind !== 'rules') return handle;
	const document = handle.doc();
	if (!isMarkdownFileDocument(document))
		throw new Error('New rules document has an invalid format.');
	const markdown = document.content;
	handle.change((value) => applyMarkdown(value as MarkdownFileDocument, markdown), {
		message: `Import ${source.path}`
	});
	return handle;
}

export async function resolveProjectGraph(
	repo: Repo,
	projectHandle: DocHandle<unknown>
): Promise<ProjectGraph> {
	while (true) {
		const heads = projectHandle.heads();
		const project = projectHandle.doc();
		if (!isProjectDocument(project)) {
			throw new Error('The Automerge root document is not a supported Digitable project.');
		}
		const resolved = await Promise.all(
			Object.entries(project.members).map(async ([id, member]) => {
				const classification = classifyProjectFile(member.path);
				if (!classification || classification.kind !== member.kind) {
					throw new Error(
						`Automerge project member ${member.path} is not a recognized ${member.kind} file.`
					);
				}
				const handle = await repo.find<ProjectMemberDocument>(member.url);
				if (!isMemberDocument(member.kind, handle.doc())) {
					throw new Error(`Automerge project member ${member.path} has an unsupported format.`);
				}
				return [id, handle] as const;
			})
		);
		if (!sameHeads(heads, projectHandle.heads())) continue;
		return graphFromHandles(
			projectHandle as DocHandle<ProjectDocument>,
			project,
			new Map(resolved)
		);
	}
}

function graphFromHandles(
	projectHandle: DocHandle<ProjectDocument>,
	project: ProjectDocument,
	memberHandles: Map<string, DocHandle<ProjectMemberDocument>>
): ProjectGraph {
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
		project,
		metadataHandle: metadataHandle as DocHandle<GameMetadataDocument>,
		memberHandles,
		componentDataHandles
	};
}

function sameHeads(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((head) => right.includes(head));
}

function isMemberDocument(
	kind: ProjectDocument['members'][string]['kind'],
	value: unknown
): boolean {
	if (kind === 'game-metadata') return isGameMetadataDocument(value);
	if (kind === 'component-data') return isComponentDataDocument(value);
	if (kind === 'asset') return isBinaryFileDocument(value);
	if (kind === 'rules') return isMarkdownFileDocument(value) || isTextFileDocument(value);
	return isTextFileDocument(value);
}
