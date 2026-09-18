import {
	FsError,
	joinFsPath,
	parseFsPath,
	type FsDir,
	type FsEntry,
	type FsResult,
	type FsWriteData
} from '$lib/components/file-browser/adapters/adapter';
import { Ok } from 'wellcrafted/result';
import { componentDataMaterializer } from './component-data';
import { encodeText } from './filesystem';
import { gameMetadataMaterializer } from './game-metadata';
import { markdownFileMaterializer } from './markdown/markdown-file';
import {
	isBinaryFileDocument,
	isComponentDataDocument,
	isGameMetadataDocument,
	isMarkdownFileDocument,
	isTextFileDocument
} from './model';
import type { ProjectGraph } from './project-graph';
import { svgFileMaterializer } from './svg-file';
import { textFileMaterializer } from './text-file';
import { isSvgDocument } from '@svg-table/svgeditor';

export function createCheckpointProjectFiles(graph: ProjectGraph, name: string): FsDir {
	const files = new Map<string, Uint8Array>();
	for (const [id, member] of Object.entries(graph.project.members)) {
		const document = graph.memberHandles.get(id)?.doc();
		if (member.kind === 'game-metadata' && isGameMetadataDocument(document)) {
			files.set(member.path, encodeText(gameMetadataMaterializer.serialize(document)));
			continue;
		}
		if (member.kind === 'component-data' && isComponentDataDocument(document)) {
			files.set(member.path, encodeText(componentDataMaterializer.serialize(document)));
			continue;
		}
		if (member.kind === 'component-svg' && isSvgDocument(document)) {
			files.set(member.path, encodeText(svgFileMaterializer.serialize(document)));
			continue;
		}
		if (member.kind === 'rules' && isMarkdownFileDocument(document)) {
			files.set(member.path, encodeText(markdownFileMaterializer.serialize(document)));
			continue;
		}
		if (member.kind === 'asset' && isBinaryFileDocument(document)) {
			files.set(member.path, Uint8Array.from(document.content));
			continue;
		}
		if (
			isTextFileDocument(document) &&
			(member.kind === 'component-svg' ||
				member.kind === 'rules' ||
				member.kind === 'table-setup' ||
				member.kind === 'feedback-registry' ||
				member.kind === 'feedback-markdown')
		) {
			files.set(member.path, encodeText(textFileMaterializer(member.kind).serialize(document)));
			continue;
		}
		throw new Error(`Checkpoint member ${member.path} has an unsupported format.`);
	}
	return checkpointDir(name, files, '');
}

export function createCheckpointWorkspace(
	workspace: FsDir,
	projectName: string,
	project: FsDir
): FsDir {
	const projectPath = `${projectName}/`;
	return {
		name: workspace.name,
		list: (path) =>
			path === projectName || path?.startsWith(projectPath)
				? project.list(path === projectName ? undefined : path.slice(projectPath.length))
				: workspace.list(path),
		openDir: (path) => {
			if (path === projectName) return Promise.resolve(Ok(project));
			if (path.startsWith(projectPath)) return project.openDir(path.slice(projectPath.length));
			return workspace.openDir(path);
		},
		ensureDir: (path) =>
			path === projectName || path.startsWith(projectPath)
				? Promise.resolve(readOnlyError('ensureDir', path))
				: workspace.ensureDir(path),
		read: (path) =>
			path.startsWith(projectPath)
				? project.read(path.slice(projectPath.length))
				: workspace.read(path),
		readText: (path) =>
			path.startsWith(projectPath)
				? project.readText(path.slice(projectPath.length))
				: workspace.readText(path),
		write: (path, data) =>
			path.startsWith(projectPath)
				? Promise.resolve(readOnlyError('write', path))
				: workspace.write(path, data),
		remove: (path, options) =>
			path === projectName || path.startsWith(projectPath)
				? Promise.resolve(readOnlyError('remove', path))
				: workspace.remove(path, options),
		move: (source, target, options) =>
			source === projectName ||
			source.startsWith(projectPath) ||
			target === projectName ||
			target.startsWith(projectPath)
				? Promise.resolve(readOnlyError('move', source))
				: workspace.move(source, target, options)
	};
}

function checkpointDir(name: string, files: Map<string, Uint8Array>, prefix: string): FsDir {
	const resolvePath = (path = '') => joinFsPath(prefix, path);
	return {
		name,
		async list(path) {
			const parsed = parseFsPath('list', resolvePath(path));
			if (parsed.error) return parsed;
			const directory = parsed.data.join('/');
			const start = directory ? `${directory}/` : '';
			const entries = new Map<string, FsEntry['kind']>();
			for (const file of files.keys()) {
				if (!file.startsWith(start)) continue;
				const rest = file.slice(start.length);
				if (!rest) continue;
				const slash = rest.indexOf('/');
				entries.set(
					slash === -1 ? rest : rest.slice(0, slash),
					slash === -1 ? 'file' : 'directory'
				);
			}
			return Ok(
				[...entries]
					.map(([entryName, kind]) => ({ name: entryName, kind }))
					.sort((a, b) => a.name.localeCompare(b.name))
			);
		},
		async openDir(path) {
			const parsed = parseFsPath('openDir', resolvePath(path));
			if (parsed.error) return parsed;
			const next = parsed.data.join('/');
			if (![...files.keys()].some((file) => file.startsWith(`${next}/`))) {
				return FsError.NotFound({ operation: 'openDir', path });
			}
			return Ok(checkpointDir(parsed.data.at(-1) ?? name, files, next));
		},
		ensureDir: async (path) => readOnlyError('ensureDir', path),
		async read(path) {
			const parsed = parseFsPath('read', resolvePath(path));
			if (parsed.error) return parsed;
			const resolved = parsed.data.join('/');
			const bytes = files.get(resolved);
			if (!bytes) return FsError.NotFound({ operation: 'read', path });
			return Ok(new File([Uint8Array.from(bytes).buffer], parsed.data.at(-1) ?? path));
		},
		async readText(path) {
			const read = await this.read(path);
			return read.error ? read : Ok(await read.data.text());
		},
		write: async (path: string, _data: FsWriteData) => readOnlyError('write', path),
		remove: async (path) => readOnlyError('remove', path),
		move: async (source) => readOnlyError('move', source)
	};
}

function readOnlyError(
	operation: 'ensureDir' | 'write' | 'remove' | 'move',
	path: string
): FsResult<never> {
	return FsError.Failed({
		operation,
		path,
		cause: { name: 'ReadOnlyError', message: 'Historical project checkpoints are read-only.' }
	});
}
