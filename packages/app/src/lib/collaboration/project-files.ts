import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';
import { componentDataMaterializer } from './component-data';
import { decodeText, hashBytes, readFile } from './filesystem';
import { gameMetadataMaterializer } from './game-metadata';
import { svgFileMaterializer } from './svg-file';
import type {
	BinaryFileDocument,
	MarkdownFileDocument,
	ProjectMemberDocument,
	ProjectMemberKind,
	TextFileDocument
} from './model';

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
	requestedPaths?: string[]
): Promise<{
	files: ProjectFileSource[];
	components: string[];
}> {
	const paths = requestedPaths ?? (await walkKnownFiles(project));
	const components = new Set(await listComponents(project));
	const files: ProjectFileSource[] = [];
	for (let index = 0; index < paths.length; index += 4) {
		files.push(
			...(await Promise.all(
				paths.slice(index, index + 4).map(async (path): Promise<ProjectFileSource> => {
					const classification = classifyProjectFile(path);
					if (!classification) throw new Error(`Unsupported project file path ${path}.`);
					const file = await readFileRequired(project, path);
					const bytes = new Uint8Array(await file.arrayBuffer());
					const snapshot = {
						hash: await hashBytes(bytes)
					};
					if (classification.componentName) components.add(classification.componentName);
					return {
						path,
						...classification,
						snapshot,
						async document() {
							const current = new Uint8Array(
								await (await readFileRequired(project, path)).arrayBuffer()
							);
							if ((await hashBytes(current)) !== snapshot.hash) {
								throw new Error(`${path} changed while it was being imported.`);
							}
							if (classification.kind === 'game-metadata') {
								return gameMetadataMaterializer.parse(decodeText(current), {
									hash: snapshot.hash
								});
							}
							if (classification.kind === 'component-data') {
								return componentDataMaterializer.parse(decodeText(current), {
									hash: snapshot.hash,
									allowMissingIds: true
								});
							}
							if (classification.kind === 'component-svg') {
								return svgFileMaterializer.parse(decodeText(current), {
									hash: snapshot.hash
								});
							}
							if (classification.kind === 'asset') {
								return {
									type: 'binary-file',
									schemaVersion: 1,
									content: current
								} satisfies BinaryFileDocument;
							}
							if (classification.kind === 'rules') {
								return {
									type: 'markdown-file',
									schemaVersion: 1,
									dialect: 'commonmark',
									content: decodeText(current)
								} satisfies MarkdownFileDocument;
							}
							return {
								type: 'text-file',
								schemaVersion: 1,
								content: decodeText(current)
							} satisfies TextFileDocument;
						}
					};
				})
			))
		);
	}
	return { files, components: [...components].sort() };
}

async function readFileRequired(project: FsDir, path: string): Promise<File> {
	const file = await readFile(project, path);
	if (!file) throw new Error(`Project file ${path} disappeared while it was being scanned.`);
	return file;
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

async function walkKnownFiles(project: FsDir, path = ''): Promise<string[]> {
	const listed = path ? await project.list(path) : await project.list();
	if (listed.error) throw new Error(listed.error.message, { cause: listed.error });
	const paths = await Promise.all(
		listed.data.map(async (entry): Promise<string[]> => {
			if (!path && (entry.name === '.automerge' || entry.name === 'tts-export')) return [];
			const child = path ? joinFsPath(path, entry.name) : entry.name;
			if (entry.kind === 'directory') return walkKnownFiles(project, child);
			return classifyProjectFile(child) ? [child] : [];
		})
	);
	return paths.flat().sort();
}
