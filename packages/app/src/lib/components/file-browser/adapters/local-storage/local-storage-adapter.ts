import { Ok } from 'wellcrafted/result';
import { parseStoredFileData } from '$lib/components/file-browser/browser-utils/file-tree.svelte';
import {
	FsError,
	basename,
	dirname,
	entryPath,
	fsFailed,
	joinFsPath,
	parseFsPath,
	type FsEntry,
	type FsDir,
	type FsResult,
	type FsWriteData
} from '../adapter';

export class LocalStorageAdapter implements FsDir {
	public readonly name: string;

	constructor(private readonly rootPath: string) {
		this.name = basename(rootPath);
	}

	private keyFor(path?: string): string {
		const joined = joinFsPath(this.rootPath, path ?? '');
		return this.rootPath.startsWith('/') ? `/${joined}` : joined;
	}

	private hasFile(path: string): boolean {
		return localStorage.getItem(this.keyFor(path)) !== null;
	}

	private hasDirectory(path: string): boolean {
		const prefix = this.keyFor(path) + '/';

		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(prefix)) return true;
		}

		return false;
	}

	private async blobToDataURL(blob: Blob): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

	private async toBlob(data: FsWriteData): Promise<Blob> {
		if (data instanceof Blob) return data;
		if (typeof data === 'string') return new Blob([data], { type: 'text/plain' });
		if (ArrayBuffer.isView(data)) return new Blob([data.buffer]);
		if (data instanceof ArrayBuffer) return new Blob([data]);

		if (typeof data === 'object' && data !== null && 'type' in data) {
			const writeParams = data as { type?: string; data?: FsWriteData };
			if (writeParams.type === 'write' && writeParams.data !== undefined) {
				return this.toBlob(writeParams.data);
			}
		}

		return new Blob([String(data)]);
	}

	async list(path?: string): Promise<FsResult<FsEntry[]>> {
		if (path) {
			const parsed = parseFsPath('list', path);
			if (parsed.error) return parsed;

			if (this.hasFile(path)) {
				return FsError.WrongKind({ operation: 'list', path, expected: 'directory' });
			}

			if (!this.hasDirectory(path)) {
				return FsError.NotFound({ operation: 'list', path });
			}
		}

		const prefix = this.keyFor(path) + '/';
		const entries = new Map<string, FsEntry>();

		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (!key?.startsWith(prefix)) continue;

			const relative = key.slice(prefix.length);
			const [name, ...rest] = relative.split('/');
			if (!name) continue;

			entries.set(name, {
				name,
				kind: rest.length > 0 ? 'directory' : 'file'
			});
		}

		return Ok([...entries.values()]);
	}

	async openDir(path: string): Promise<FsResult<FsDir>> {
		const parsed = parseFsPath('openDir', path);
		if (parsed.error) return parsed;

		if (this.hasFile(path)) {
			return FsError.WrongKind({ operation: 'openDir', path, expected: 'directory' });
		}

		if (!this.hasDirectory(path)) {
			return FsError.NotFound({ operation: 'openDir', path });
		}

		return Ok(new LocalStorageAdapter(this.keyFor(path)));
	}

	async ensureDir(path: string): Promise<FsResult<FsDir>> {
		const parsed = parseFsPath('ensureDir', path);
		if (parsed.error) return parsed;

		if (this.hasFile(path)) {
			return FsError.WrongKind({ operation: 'ensureDir', path, expected: 'directory' });
		}

		return Ok(new LocalStorageAdapter(this.keyFor(path)));
	}

	async read(path: string): Promise<FsResult<File>> {
		const parsed = parseFsPath('read', path);
		if (parsed.error) return parsed;

		try {
			const stored = localStorage.getItem(this.keyFor(path));

			if (!stored) {
				if (this.hasDirectory(path)) {
					return FsError.WrongKind({ operation: 'read', path, expected: 'file' });
				}

				return FsError.NotFound({ operation: 'read', path });
			}

			const fileData = await parseStoredFileData(stored);
			const blob =
				fileData.blob || (await fetch(fileData.dataURL).then((response) => response.blob()));
			if (!blob) {
				return FsError.NotFound({ operation: 'read', path });
			}

			return Ok(
				new File([blob], basename(path), {
					type: fileData.mimetype,
					lastModified: fileData.updatedAt.getTime()
				})
			);
		} catch (error) {
			return fsFailed('read', error, path, 'file');
		}
	}

	async readText(path: string): Promise<FsResult<string>> {
		const file = await this.read(path);
		if (file.error) return file;

		return Ok(await file.data.text());
	}

	async write(path: string, data: FsWriteData): Promise<FsResult<void>> {
		const parsed = parseFsPath('write', path);
		if (parsed.error) return parsed;

		try {
			const parent = dirname(path);
			if (parent) {
				const ensured = await this.ensureDir(parent);
				if (ensured.error) return ensured;
			}

			const blob = await this.toBlob(data);
			const dataURL = await this.blobToDataURL(blob);
			const payload = {
				dataURL,
				size: blob.size,
				mimetype: blob.type || 'application/octet-stream',
				updatedAt: data instanceof File ? data.lastModified : Date.now()
			};

			localStorage.setItem(this.keyFor(path), JSON.stringify(payload));
			return Ok(undefined);
		} catch (error) {
			return fsFailed('write', error, path, 'file');
		}
	}

	async remove(path: string, options?: { recursive?: boolean }): Promise<FsResult<void>> {
		const parsed = parseFsPath('remove', path);
		if (parsed.error) return parsed;

		try {
			if (this.hasFile(path)) {
				localStorage.removeItem(this.keyFor(path));
				return Ok(undefined);
			}

			if (!this.hasDirectory(path)) {
				return FsError.NotFound({ operation: 'remove', path });
			}

			if (!options?.recursive) {
				return FsError.WrongKind({ operation: 'remove', path, expected: 'file' });
			}

			const prefix = this.keyFor(path) + '/';
			const keys: string[] = [];

			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key?.startsWith(prefix)) keys.push(key);
			}

			keys.forEach((key) => localStorage.removeItem(key));
			return Ok(undefined);
		} catch (error) {
			return fsFailed('remove', error, path);
		}
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
			const sourceIsFile = this.hasFile(source);
			const sourceIsDirectory = this.hasDirectory(source);

			if (!sourceIsFile && !sourceIsDirectory) {
				return FsError.NotFound({ operation: 'move', path: sourcePath });
			}

			if (sourceIsDirectory && target.startsWith(`${source}/`)) {
				return FsError.InvalidPath({
					operation: 'move',
					path: targetPath,
					reason: 'Cannot move a directory into itself.'
				});
			}

			const parent = dirname(target);
			if (parent && this.hasFile(parent)) {
				return FsError.WrongKind({ operation: 'move', path: parent, expected: 'directory' });
			}

			const targetExists = this.hasFile(target) || this.hasDirectory(target);
			if (targetExists) {
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

			if (sourceIsFile) {
				const stored = localStorage.getItem(this.keyFor(source));
				if (stored === null) return FsError.NotFound({ operation: 'move', path: sourcePath });

				localStorage.setItem(this.keyFor(target), stored);
				localStorage.removeItem(this.keyFor(source));
				return Ok(undefined);
			}

			const sourcePrefix = this.keyFor(source) + '/';
			const targetPrefix = this.keyFor(target) + '/';
			const entries: Array<{ oldKey: string; newKey: string; value: string }> = [];

			for (let i = 0; i < localStorage.length; i++) {
				const oldKey = localStorage.key(i);
				if (!oldKey?.startsWith(sourcePrefix)) continue;

				const value = localStorage.getItem(oldKey);
				if (value === null) continue;

				entries.push({
					oldKey,
					newKey: targetPrefix + oldKey.slice(sourcePrefix.length),
					value
				});
			}

			for (const entry of entries) {
				localStorage.setItem(entry.newKey, entry.value);
			}

			for (const entry of entries) {
				localStorage.removeItem(entry.oldKey);
			}

			return Ok(undefined);
		} catch (error) {
			return fsFailed('move', error, sourcePath);
		}
	}

	resolve(path: string): string {
		return entryPath(this.rootPath, path);
	}
}
