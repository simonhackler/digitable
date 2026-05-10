import { Ok } from 'wellcrafted/result';
import {
	FsError,
	basename,
	dirname,
	fsCause,
	fsFailed,
	joinFsPath,
	parseFsPath,
	wrapFs,
	type FsEntry,
	type FsDir,
	type FsResult,
	type FsWriteData
} from '../adapter';

/**
 * Adapter implementation for the Origin Private File System (OPFS) and picked
 * File System Access API directories.
 */
export class OPFSAdapter implements FsDir {
	public constructor(private readonly root: FileSystemDirectoryHandle) {}

	static async create(): Promise<OPFSAdapter> {
		const root = await navigator.storage.getDirectory();
		return new OPFSAdapter(root);
	}

	private splitPath(path: string): { parent: string; name: string } {
		const parts = joinFsPath(path).split('/').filter(Boolean);
		const name = parts.pop()!;
		const parent = parts.join('/');
		return { parent, name };
	}

	private async getDirectoryHandle(
		path: string,
		create = false
	): Promise<FileSystemDirectoryHandle> {
		const parts = joinFsPath(path).split('/').filter(Boolean);
		let dir: FileSystemDirectoryHandle = this.root;

		for (const part of parts) {
			dir = await dir.getDirectoryHandle(part, create ? { create: true } : undefined);
		}

		return dir;
	}

	private async getEntryKind(path: string): Promise<FsEntry['kind']> {
		const { parent, name } = this.splitPath(path);
		const dir = parent ? await this.getDirectoryHandle(parent) : this.root;

		try {
			await dir.getDirectoryHandle(name);
			return 'directory';
		} catch (error) {
			const cause = fsCause(error);
			if (cause.name === 'TypeMismatchError') return 'file';
			if (cause.name !== 'NotFoundError') throw error;
		}

		const fileHandle = await dir.getFileHandle(name);
		return fileHandle.kind;
	}

	private async pathExists(path: string): Promise<FsResult<boolean>> {
		try {
			await this.getEntryKind(path);
			return Ok(true);
		} catch (error) {
			if (fsCause(error).name === 'NotFoundError') return Ok(false);
			return fsFailed('move', error, path);
		}
	}

	private async copyDirectory(sourcePath: string, targetPath: string): Promise<FsResult<void>> {
		const ensured = await this.ensureDir(targetPath);
		if (ensured.error) return ensured;

		const entries = await this.list(sourcePath);
		if (entries.error) return entries;

		for (const entry of entries.data) {
			const sourceEntryPath = joinFsPath(sourcePath, entry.name);
			const targetEntryPath = joinFsPath(targetPath, entry.name);

			if (entry.kind === 'directory') {
				const copied = await this.copyDirectory(sourceEntryPath, targetEntryPath);
				if (copied.error) return copied;
				continue;
			}

			const file = await this.read(sourceEntryPath);
			if (file.error) return file;

			const written = await this.write(targetEntryPath, file.data);
			if (written.error) return written;
		}

		return Ok(undefined);
	}

	async list(path?: string): Promise<FsResult<FsEntry[]>> {
		if (path) {
			const parsed = parseFsPath('list', path);
			if (parsed.error) return parsed;
		}

		return wrapFs(
			{
				operation: 'list',
				path,
				expected: 'directory'
			},
			async () => {
				const dir = path ? await this.getDirectoryHandle(path) : this.root;
				const entries: FsEntry[] = [];

				for await (const [name, handle] of dir.entries()) {
					entries.push({ name, kind: handle.kind });
				}

				return entries;
			}
		);
	}

	async openDir(path: string): Promise<FsResult<FsDir>> {
		const parsed = parseFsPath('openDir', path);
		if (parsed.error) return parsed;

		return wrapFs(
			{
				operation: 'openDir',
				path,
				expected: 'directory'
			},
			async () => new OPFSAdapter(await this.getDirectoryHandle(path))
		);
	}

	async ensureDir(path: string): Promise<FsResult<FsDir>> {
		const parsed = parseFsPath('ensureDir', path);
		if (parsed.error) return parsed;

		return wrapFs(
			{
				operation: 'ensureDir',
				path,
				expected: 'directory'
			},
			async () => new OPFSAdapter(await this.getDirectoryHandle(path, true))
		);
	}

	async read(path: string): Promise<FsResult<File>> {
		const parsed = parseFsPath('read', path);
		if (parsed.error) return parsed;

		return wrapFs(
			{
				operation: 'read',
				path,
				expected: 'file'
			},
			async () => {
				const { parent, name } = this.splitPath(path);
				const dir = parent ? await this.getDirectoryHandle(parent) : this.root;
				const fileHandle = await dir.getFileHandle(name);

				return fileHandle.getFile();
			}
		);
	}

	async readText(path: string): Promise<FsResult<string>> {
		const file = await this.read(path);
		if (file.error) return file;

		return Ok(await file.data.text());
	}

	async write(path: string, data: FsWriteData): Promise<FsResult<void>> {
		const parsed = parseFsPath('write', path);
		if (parsed.error) return parsed;

		return wrapFs(
			{
				operation: 'write',
				path,
				expected: 'file'
			},
			async () => {
				const parent = dirname(path);
				if (parent) await this.getDirectoryHandle(parent, true);

				const { parent: parentPath, name } = this.splitPath(path);
				const dir = parentPath ? await this.getDirectoryHandle(parentPath) : this.root;
				const fileHandle = await dir.getFileHandle(name || basename(path), { create: true });
				let writable: FileSystemWritableFileStream | undefined;

				try {
					writable = await fileHandle.createWritable();
					await writable.write(data);
					await writable.close();
				} catch (error) {
					await writable?.abort().catch(() => undefined);
					throw error;
				}
			}
		);
	}

	async move(
		sourcePath: string,
		targetPath: string,
		options?: { overwrite?: boolean }
	): Promise<FsResult<void>> {
		const parsedSource = parseFsPath('move', sourcePath);
		if (parsedSource.error) return parsedSource;

		const parsedTarget = parseFsPath('move', targetPath);
		if (parsedTarget.error) return parsedTarget;

		const source = joinFsPath(sourcePath);
		const target = joinFsPath(targetPath);
		if (source === target) return Ok(undefined);

		try {
			const kind = await this.getEntryKind(source);

			if (kind === 'directory' && target.startsWith(`${source}/`)) {
				return FsError.InvalidPath({
					operation: 'move',
					path: targetPath,
					reason: 'Cannot move a directory into itself.'
				});
			}

			const targetExists = await this.pathExists(target);
			if (targetExists.error) return targetExists;

			if (targetExists.data) {
				if (!options?.overwrite) {
					return FsError.Failed({
						operation: 'move',
						path: targetPath,
						cause: { message: 'Target already exists.' }
					});
				}

				const removedTarget = await this.remove(target, { recursive: true });
				if (removedTarget.error) return removedTarget;
			}

			const copied =
				kind === 'directory'
					? await this.copyDirectory(source, target)
					: await this.read(source).then(async (file) =>
							file.error ? file : await this.write(target, file.data)
						);

			if (copied.error) {
				await this.remove(target, { recursive: true });
				return copied;
			}

			const removedSource = await this.remove(source, { recursive: kind === 'directory' });
			if (removedSource.error) {
				await this.remove(target, { recursive: true });
				return removedSource;
			}

			return Ok(undefined);
		} catch (error) {
			return fsFailed('move', error, sourcePath);
		}
	}

	async remove(path: string, options?: { recursive?: boolean }): Promise<FsResult<void>> {
		const parsed = parseFsPath('remove', path);
		if (parsed.error) return parsed;

		try {
			const { parent, name } = this.splitPath(path);
			const dir = parent ? await this.getDirectoryHandle(parent) : this.root;
			await dir.removeEntry(name, { recursive: options?.recursive ?? false });

			return Ok(undefined);
		} catch (error) {
			if (fsCause(error).name === 'TypeMismatchError') {
				return FsError.WrongKind({ operation: 'remove', path, cause: fsCause(error) });
			}

			return fsFailed('remove', error, path);
		}
	}
}
