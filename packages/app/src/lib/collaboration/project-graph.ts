import { isValidAutomergeUrl, type DocHandle, type Repo } from '@automerge/automerge-repo';
import { isSvgDocument } from '@svg-table/svgeditor';
import {
	GAME_METADATA_MEMBER_ID,
	isBinaryFileDocument,
	isComponentDataDocument,
	isGameMetadataDocument,
	isMarkdownFileDocument,
	isProjectDocument,
	isTextFileDocument,
	type GameMetadataDocument,
	type MarkdownFileDocument,
	type ProjectCheckpoint,
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
			componentIds.set(source.componentName, projectComponentId());
		}
	}

	const members: ProjectDocument['members'] = {};
	const components: ProjectDocument['components'] = Object.fromEntries(
		[...componentIds].map(([name, id]) => [id, { name }])
	);
	const memberHandles = new Map<string, DocHandle<ProjectMemberDocument>>();
	for (const source of sources) {
		const id = source.kind === 'game-metadata' ? GAME_METADATA_MEMBER_ID : projectMemberId();
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
		const errors = validateProjectStructure(project);
		if (errors.length) throw new Error(errors[0]);
		const resolved = await Promise.all(
			Object.entries(project.members).map(async ([id, member]) => {
				const classification = classifyProjectFile(member.path);
				if (!classification || classification.kind !== member.kind) {
					throw new Error(
						`Automerge project member ${member.path} is not a recognized ${member.kind} file.`
					);
				}
				const handle = await repo.find<ProjectMemberDocument>(member.url);
				if (!isProjectMemberDocument(member.kind, handle.doc())) {
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

export async function resolveProjectGraphAtCheckpoint(
	repo: Repo,
	checkpoint: ProjectCheckpoint
): Promise<ProjectGraph> {
	const root = await repo.find<ProjectDocument>(checkpoint.rootUrl);
	const projectHandle = root.view(checkpoint.rootHeads);
	const project = projectHandle.doc();
	if (!isProjectDocument(project)) {
		throw new Error('The Automerge project root is unavailable at the selected checkpoint.');
	}
	const errors = validateProjectStructure(project);
	if (errors.length) throw new Error(errors[0]);
	const resolved = await Promise.all(
		Object.entries(project.members).map(async ([id, member]) => {
			const version = checkpoint.members[id];
			if (!version || version.url !== member.url) {
				throw new Error(`Checkpoint is missing project member ${member.path}.`);
			}
			const source = await repo.find<ProjectMemberDocument>(version.url);
			const handle = source.view(version.heads);
			if (!isProjectMemberDocument(member.kind, handle.doc())) {
				throw new Error(`Project member ${member.path} is unavailable at the checkpoint.`);
			}
			return [id, handle] as const;
		})
	);
	return graphFromHandles(projectHandle, project, new Map(resolved));
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
	return {
		projectHandle,
		project,
		metadataHandle: metadataHandle as DocHandle<GameMetadataDocument>,
		memberHandles
	};
}

function sameHeads(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((head) => right.includes(head));
}

export function isProjectMemberDocument(
	kind: ProjectDocument['members'][string]['kind'],
	value: unknown
): boolean {
	if (kind === 'game-metadata') return isGameMetadataDocument(value);
	if (kind === 'component-data') return isComponentDataDocument(value);
	if (kind === 'asset') return isBinaryFileDocument(value);
	if (kind === 'rules') return isMarkdownFileDocument(value);
	if (kind === 'component-svg') return isSvgDocument(value);
	return isTextFileDocument(value);
}

export function validateProjectStructure(project: ProjectDocument): string[] {
	const errors: string[] = [];
	const metadata = Object.entries(project.members).filter(
		([, member]) => member.kind === 'game-metadata'
	);
	if (
		metadata.length !== 1 ||
		metadata[0]?.[0] !== GAME_METADATA_MEMBER_ID ||
		project.members[GAME_METADATA_MEMBER_ID]?.path !== 'game.json'
	) {
		errors.push('The project must contain exactly one $metadata game.json member.');
	}
	const paths = new Set<string>();
	for (const [id, member] of Object.entries(project.members)) {
		if (!isValidAutomergeUrl(member.url)) errors.push(`Member ${member.path} has an invalid URL.`);
		const classification = classifyProjectFile(member.path);
		if (!classification || classification.kind !== member.kind) {
			errors.push(`Member ${member.path} is not a recognized ${member.kind} path.`);
		}
		if (paths.has(member.path)) errors.push(`Member path ${member.path} is not unique.`);
		paths.add(member.path);
		if (member.kind === 'asset' && !member.hash)
			errors.push(`Asset ${member.path} is missing its hash.`);
		if (member.kind !== 'asset' && member.hash !== undefined)
			errors.push(`Mutable member ${member.path} cannot have an asset hash.`);
		if (id === GAME_METADATA_MEMBER_ID && member.kind !== 'game-metadata')
			errors.push('$metadata must identify game metadata.');
	}
	const names = new Set<string>();
	for (const component of Object.values(project.components)) {
		if (names.has(component.name)) errors.push(`Component name ${component.name} is not unique.`);
		names.add(component.name);
	}
	for (const member of Object.values(project.members)) {
		const classification = classifyProjectFile(member.path);
		if (classification?.componentName && !member.componentId) {
			errors.push(`Component member ${member.path} has no owning component.`);
			continue;
		}
		if (!classification?.componentName && member.componentId) {
			errors.push(`Project member ${member.path} cannot belong to a component.`);
			continue;
		}
		if (!member.componentId) continue;
		const component = project.components[member.componentId];
		if (!component) {
			errors.push(`Member ${member.path} references a missing component.`);
			continue;
		}
		if (classification?.componentName !== component.name) {
			errors.push(`Member ${member.path} does not match component ${component.name}.`);
		}
	}
	return errors;
}
