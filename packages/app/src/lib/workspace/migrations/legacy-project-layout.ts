import {
	FsError,
	joinFsPath,
	type FsDir,
	type FsEntry,
	type FsResult
} from '$lib/components/file-browser/adapters/adapter';

const COMPONENTS_DIR = 'components';
const ASSETS_DIR = 'assets';
const OLD_COMPONENTS_DIR = 'system';
const OLD_ASSETS_DIR = 'files';

const svgReferenceRewrites = [
	[/\.\.\/\.\.\/files\//g, '../../assets/'],
	[/\/files\//g, '/assets/']
] as const;

const csvReferenceRewrites = [
	[/\.\.\/\.\.\/files\//g, '../../assets/'],
	[/\bfiles\//g, 'assets/'],
	[/\/files\//g, '/assets/']
] as const;

function failed(operation: 'readText' | 'write' | 'move' | 'list', path: string, message: string) {
	return FsError.Failed({
		operation,
		path,
		cause: { message }
	});
}

function hasEntry(entries: FsEntry[], name: string, kind: FsEntry['kind'] = 'directory') {
	return entries.some((entry) => entry.name === name && entry.kind === kind);
}

function rewriteText(value: string, rewrites: readonly (readonly [RegExp, string])[]) {
	return rewrites.reduce(
		(next, [pattern, replacement]) => next.replace(pattern, replacement),
		value
	);
}

async function rewriteFiles(
	dir: FsDir,
	path: string,
	shouldRewrite: (fileName: string) => boolean,
	rewrite: (text: string) => string
): Promise<FsResult<void>> {
	const entries = await dir.list(path);
	if (entries.error) return entries;

	for (const entry of entries.data) {
		const entryPath = joinFsPath(path, entry.name);
		if (entry.kind === 'directory') {
			const rewritten = await rewriteFiles(dir, entryPath, shouldRewrite, rewrite);
			if (rewritten.error) return rewritten;
			continue;
		}

		if (!shouldRewrite(entry.name)) continue;

		const current = await dir.readText(entryPath);
		if (current.error) return current;

		const next = rewrite(current.data);
		if (next === current.data) continue;

		const written = await dir.write(entryPath, next);
		if (written.error) return written;
	}

	return { data: undefined, error: null };
}

export async function migrateLegacyProjectLayout(
	fileSystem: FsDir,
	projectName: string
): Promise<FsResult<void>> {
	const projectDir = await fileSystem.openDir(projectName);
	if (projectDir.error) return projectDir;

	const entries = await projectDir.data.list();
	if (entries.error) return entries;

	const hasOldComponents = hasEntry(entries.data, OLD_COMPONENTS_DIR);
	const hasOldAssets = hasEntry(entries.data, OLD_ASSETS_DIR);

	if (hasOldComponents && hasEntry(entries.data, COMPONENTS_DIR)) {
		return failed('move', joinFsPath(projectName, COMPONENTS_DIR), 'components already exists.');
	}

	if (hasOldAssets && hasEntry(entries.data, ASSETS_DIR)) {
		return failed('move', joinFsPath(projectName, ASSETS_DIR), 'assets already exists.');
	}

	if (hasOldComponents) {
		const moved = await projectDir.data.move(OLD_COMPONENTS_DIR, COMPONENTS_DIR);
		if (moved.error) return moved;
	}

	if (hasOldAssets) {
		const moved = await projectDir.data.move(OLD_ASSETS_DIR, ASSETS_DIR);
		if (moved.error) return moved;
	}

	const svgRewritten = await rewriteFiles(
		projectDir.data,
		COMPONENTS_DIR,
		(name) => name.toLowerCase().endsWith('.svg'),
		(text) => rewriteText(text, svgReferenceRewrites)
	);
	if (svgRewritten.error && svgRewritten.error.name !== 'NotFoundError') return svgRewritten;

	const csvRewritten = await rewriteFiles(
		projectDir.data,
		COMPONENTS_DIR,
		(name) => name.toLowerCase().endsWith('.csv'),
		(text) => rewriteText(text, csvReferenceRewrites)
	);
	if (csvRewritten.error && csvRewritten.error.name !== 'NotFoundError') return csvRewritten;

	return { data: undefined, error: null };
}
