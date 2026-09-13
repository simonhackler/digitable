import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';
import { componentDataMaterializer } from './component-data';
import { decodeText, hashBytes, readFile } from './filesystem';
import { gameMetadataMaterializer } from './game-metadata';
import type {
	BinaryFileDocument,
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
	lastModified: number;
	size: number;
};

export async function scanProjectFiles(
	project: FsDir,
	cache?: Map<string, ProjectFileFingerprint>
): Promise<{
	files: ProjectFileSource[];
	components: string[];
}> {
	const paths = await walkKnownFiles(project);
	const components = new Set(await listComponents(project));
	const files = await Promise.all(paths.map(async (path): Promise<ProjectFileSource> => {
		const classification = classifyProjectFile(path);
		if (!classification) throw new Error(`Unsupported project file path ${path}.`);
		const file = await readFile(project, path);
		if (!file) throw new Error(`Project file ${path} disappeared while it was being scanned.`);
		const previous = cache?.get(path);
		let bytes: Uint8Array | undefined;
		const unchanged = previous?.lastModified === file.lastModified && previous.size === file.size;
		if (!unchanged) bytes = new Uint8Array(await file.arrayBuffer());
		const snapshot = {
			hash: unchanged ? previous.hash : await hashBytes(bytes!),
			lastModified: file.lastModified,
			size: file.size
		};
		cache?.set(path, snapshot);
		if (classification.componentName) components.add(classification.componentName);
		return {
			path,
			...classification,
			snapshot,
			async document() {
				const content = bytes ?? new Uint8Array(await (await readFileRequired(project, path)).arrayBuffer());
				if (classification.kind === 'game-metadata') {
					return gameMetadataMaterializer.parse(decodeText(content), { hash: snapshot.hash });
				}
				if (classification.kind === 'component-data') {
					return componentDataMaterializer.parse(decodeText(content), {
						hash: snapshot.hash,
						allowMissingIds: true
					});
				}
				if (classification.kind === 'asset') {
					return {
						type: 'binary-file',
						schemaVersion: 1,
						content
					} satisfies BinaryFileDocument;
				}
				return {
					type: 'text-file',
					schemaVersion: 1,
					content: decodeText(content)
				} satisfies TextFileDocument;
			}
		};
	}));
	if (cache) {
		const currentPaths = new Set(paths);
		for (const path of cache.keys()) {
			if (!currentPaths.has(path)) cache.delete(path);
		}
	}
	return { files, components: [...components].sort() };
}

export async function primeProjectFileCache(
	project: FsDir,
	hashes: ReadonlyMap<string, string | null>
): Promise<Map<string, ProjectFileFingerprint>> {
	const cache = new Map<string, ProjectFileFingerprint>();
	await Promise.all(
		(await walkKnownFiles(project)).map(async (path) => {
			const hash = hashes.get(path);
			if (!hash) return;
			const file = await readFile(project, path);
			if (!file) return;
			cache.set(path, { hash, lastModified: file.lastModified, size: file.size });
		})
	);
	return cache;
}

async function readFileRequired(project: FsDir, path: string): Promise<File> {
	const file = await readFile(project, path);
	if (!file) throw new Error(`Project file ${path} disappeared while it was being imported.`);
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
