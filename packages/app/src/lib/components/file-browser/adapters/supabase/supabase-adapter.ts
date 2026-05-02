import type { SupabaseClient } from '@supabase/supabase-js';
import { Ok } from 'wellcrafted/result';
import { getAllFilesMetadata } from './helper';
import {
	FsError,
	basename,
	entryPath,
	fsCause,
	fsFailed,
	joinFsPath,
	parseFsPath,
	type FsEntry,
	type FsDir,
	type FsOperation,
	type FsResult,
	type FsWriteData
} from '../adapter';

export class SupabaseAdapter implements FsDir {
	constructor(
		private readonly supabase: SupabaseClient,
		private readonly rootPath: string
	) {}

	private fullPath(path?: string): string {
		return joinFsPath(this.rootPath, path ?? '');
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

	private storageError(operation: FsOperation, error: unknown, path?: string): FsResult<never> {
		const statusCode =
			error && typeof error === 'object'
				? Number(
						(error as { statusCode?: unknown; status?: unknown }).statusCode ??
							(error as { statusCode?: unknown; status?: unknown }).status
					)
				: undefined;
		const cause = fsCause(error);

		if (
			statusCode === 404 ||
			cause.message.toLowerCase().includes('not found') ||
			cause.message.toLowerCase().includes('not_found')
		) {
			return FsError.NotFound({ operation, path, cause });
		}

		return FsError.Failed({ operation, path, cause });
	}

	private async filePaths(): Promise<FsResult<string[]>> {
		const { data, error } = await getAllFilesMetadata(this.supabase, 'folders');
		if (error) return fsFailed('list', error);

		return Ok(data.map((file) => joinFsPath(...file.pathTokens)));
	}

	private async hasDirectory(path: string): Promise<FsResult<boolean>> {
		const files = await this.filePaths();
		if (files.error) return files;

		const prefix = this.fullPath(path) + '/';
		return Ok(files.data.some((filePath) => filePath.startsWith(prefix)));
	}

	private async hasFile(path: string): Promise<FsResult<boolean>> {
		const files = await this.filePaths();
		if (files.error) return files;

		return Ok(files.data.includes(this.fullPath(path)));
	}

	async list(path?: string): Promise<FsResult<FsEntry[]>> {
		if (path) {
			const parsed = parseFsPath('list', path);
			if (parsed.error) return parsed;

			const file = await this.hasFile(path);
			if (file.error) return file;
			if (file.data) return FsError.WrongKind({ operation: 'list', path, expected: 'directory' });

			const directory = await this.hasDirectory(path);
			if (directory.error) return directory;
			if (!directory.data) return FsError.NotFound({ operation: 'list', path });
		}

		const files = await this.filePaths();
		if (files.error) return files;

		const prefix = this.fullPath(path) + '/';
		const entries = new Map<string, FsEntry>();

		for (const filePath of files.data) {
			if (!filePath.startsWith(prefix)) continue;

			const relative = filePath.slice(prefix.length);
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

		const file = await this.hasFile(path);
		if (file.error) return file;
		if (file.data) return FsError.WrongKind({ operation: 'openDir', path, expected: 'directory' });

		const directory = await this.hasDirectory(path);
		if (directory.error) return directory;
		if (!directory.data) return FsError.NotFound({ operation: 'openDir', path });

		return Ok(new SupabaseAdapter(this.supabase, this.fullPath(path)));
	}

	async ensureDir(path: string): Promise<FsResult<FsDir>> {
		const parsed = parseFsPath('ensureDir', path);
		if (parsed.error) return parsed;

		const file = await this.hasFile(path);
		if (file.error) return file;
		if (file.data)
			return FsError.WrongKind({ operation: 'ensureDir', path, expected: 'directory' });

		return Ok(new SupabaseAdapter(this.supabase, this.fullPath(path)));
	}

	async read(path: string): Promise<FsResult<File>> {
		const parsed = parseFsPath('read', path);
		if (parsed.error) return parsed;

		const fullPath = this.fullPath(path);
		const { data, error } = await this.supabase.storage.from('folders').download(fullPath);
		if (error) return this.storageError('read', error, path);
		if (!data) return FsError.NotFound({ operation: 'read', path });

		return Ok(new File([data], basename(path), { type: data.type }));
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
			const blob = await this.toBlob(data);
			const { error } = await this.supabase.storage
				.from('folders')
				.upload(this.fullPath(path), blob, {
					contentType: blob.type || 'application/octet-stream',
					upsert: true
				});

			if (error) return this.storageError('write', error, path);

			return Ok(undefined);
		} catch (error) {
			return fsFailed('write', error, path, 'file');
		}
	}

	async remove(path: string, options?: { recursive?: boolean }): Promise<FsResult<void>> {
		const parsed = parseFsPath('remove', path);
		if (parsed.error) return parsed;

		const file = await this.hasFile(path);
		if (file.error) return file;

		if (file.data) {
			const { error } = await this.supabase.storage.from('folders').remove([this.fullPath(path)]);
			if (error) return this.storageError('remove', error, path);

			return Ok(undefined);
		}

		const directory = await this.hasDirectory(path);
		if (directory.error) return directory;
		if (!directory.data) return FsError.NotFound({ operation: 'remove', path });

		if (!options?.recursive) {
			return FsError.WrongKind({ operation: 'remove', path, expected: 'file' });
		}

		const files = await this.filePaths();
		if (files.error) return files;

		const prefix = this.fullPath(path) + '/';
		const paths = files.data.filter((filePath) => filePath.startsWith(prefix));
		const { error } = await this.supabase.storage.from('folders').remove(paths);
		if (error) return this.storageError('remove', error, path);

		return Ok(undefined);
	}

	resolve(path: string): string {
		return entryPath(this.rootPath, path);
	}
}
