import { joinFsPath, parseFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';
import { hashBytes, readFile } from './filesystem';
import { seedProjectMember } from './project-member-codec';
import type { ProjectMemberDocument, ProjectMemberKind } from './model';

export type ProjectFileSource = {
	path: string;
	kind: ProjectMemberKind;
	componentName?: string;
	side?: 'front' | 'back';
	snapshot: ProjectFileFingerprint;
	document(): Promise<ProjectMemberDocument>;
};

export type ProjectFileFingerprint = {
	hash: string;
};

export function projectMemberId(): string {
	return crypto.randomUUID();
}

export function projectComponentId(): string {
	return crypto.randomUUID();
}

export async function scanProjectFiles(
	project: FsDir,
	requestedPaths?: readonly string[]
): Promise<{
	files: ProjectFileSource[];
	components?: string[];
	scope: readonly string[] | null;
}> {
	const paths = requestedPaths
		? [
				...new Set(
					(
						await Promise.all(
							requestedPaths.map((path) =>
								classifyProjectFile(path) ? [path] : walkKnownFiles(project, path)
							)
						)
					).flat()
				)
			]
		: await walkKnownFiles(project);
	const components =
		!requestedPaths ||
		requestedPaths.some(
			(path) =>
				path === 'components' || (path.startsWith('components/') && !classifyProjectFile(path))
		)
			? await listComponents(project)
			: undefined;
	const files: ProjectFileSource[] = [];
	for (let index = 0; index < paths.length; index += 4) {
		files.push(
			...(
				await Promise.all(
					paths.slice(index, index + 4).map(async (path) => {
						const file = await readFile(project, path);
						return file
							? [await projectFileSource(path, new Uint8Array(await file.arrayBuffer()))]
							: [];
					})
				)
			).flat()
		);
	}
	return { files, components, scope: requestedPaths ?? null };
}

export async function projectFileSource(
	path: string,
	bytes: Uint8Array
): Promise<ProjectFileSource> {
	const parsed = parseFsPath('read', path);
	if (parsed.error) throw new Error(parsed.error.message);
	const classification = classifyProjectFile(path);
	if (!classification) throw new Error(`Unsupported project file path ${path}.`);
	const hash = await hashBytes(bytes);
	return {
		path,
		...classification,
		snapshot: { hash },
		async document() {
			return seedProjectMember(classification.kind, bytes, { hash, allowMissingIds: true })
				.document;
		}
	};
}

async function listComponents(project: FsDir): Promise<string[]> {
	const listed = await project.list('components');
	if (listed.error?.name === 'NotFoundError') return [];
	if (listed.error) throw new Error(listed.error.message, { cause: listed.error });
	return listed.data.filter((entry) => entry.kind === 'directory').map((entry) => entry.name);
}

export function classifyProjectFile(path: string):
	| {
			kind: ProjectMemberKind;
			componentName?: string;
			side?: 'front' | 'back';
	  }
	| undefined {
	if (path === 'game.json') return { kind: 'game-metadata' };
	if (path === 'rules.md') return { kind: 'rules' };
	if (path === 'setup/table.svg') return { kind: 'table-setup' };
	if (path === 'feedback/playtests.json') return { kind: 'feedback-registry' };
	if (/^feedback\/.+\.md$/i.test(path)) return { kind: 'feedback-markdown' };
	if (path.startsWith('assets/') && path.length > 'assets/'.length) return { kind: 'asset' };
	const component = /^components\/([^/]+)\/(front\.svg|back\.svg|data\.csv)$/.exec(path);
	if (!component) return undefined;
	if (component[2] === 'data.csv') {
		return { kind: 'component-data', componentName: component[1] };
	}
	return {
		kind: 'component-svg',
		componentName: component[1],
		side: component[2] === 'front.svg' ? 'front' : 'back'
	};
}

export async function walkKnownFiles(project: FsDir, path = ''): Promise<string[]> {
	const listed = path ? await project.list(path) : await project.list();
	if (listed.error?.name === 'NotFoundError') return [];
	if (listed.error?.name === 'WrongKindError') return classifyProjectFile(path) ? [path] : [];
	if (listed.error) throw new Error(listed.error.message, { cause: listed.error });
	const paths: string[] = [];
	// Discovery yields between directories instead of flooding the filesystem with background reads.
	for (const entry of listed.data) {
		if (entry.name.startsWith('.') || (!path && entry.name === 'tts-export')) continue;
		const child = path ? joinFsPath(path, entry.name) : entry.name;
		if (entry.kind === 'directory') paths.push(...(await walkKnownFiles(project, child)));
		if (entry.kind === 'file' && classifyProjectFile(child)) paths.push(child);
	}
	return paths.sort();
}
