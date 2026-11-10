import { Ok } from 'wellcrafted/result';
import { resolve } from '$app/paths';
import {
	FsError,
	basename,
	joinFsPath,
	parseFsPath,
	fsFailed,
	wrapFs,
	type FsDir,
	type FsEntry,
	type FsOperation,
	type FsResult,
	type FsWriteData
} from '$lib/components/file-browser/adapters/adapter';

export class DevProjectsAdapter implements FsDir {
	readonly name: string;

	constructor(private readonly root = '') {
		this.name = basename(root) || 'projects';
	}

	private async request(operation: FsOperation, path: string, init?: RequestInit) {
		const response = await wrapFs({ operation, path }, async () => {
			const url = new URL(resolve('/api/dev-projects'), window.location.origin);
			url.searchParams.set('operation', operation);
			url.searchParams.set('path', joinFsPath(this.root, path));
			return fetch(url, init);
		});
		if (response.error) return response;
		if (response.data.status === 404) {
			return FsError.NotFound({ operation, path: joinFsPath(this.root, path) });
		}
		if (!response.data.ok) {
			return fsFailed(operation, new Error(await response.data.text()), path);
		}
		return response;
	}

	async list(path = ''): Promise<FsResult<FsEntry[]>> {
		const parsed = path ? parseFsPath('list', path) : Ok([]);
		if (parsed.error) return parsed;
		const response = await this.request('list', path);
		if (response.error) return response;
		return Ok((await response.data.json()) as FsEntry[]);
	}

	async openDir(path: string): Promise<FsResult<FsDir>> {
		const parsed = parseFsPath('openDir', path);
		if (parsed.error) return parsed;
		const entries = await this.list(path);
		if (entries.error) return entries;
		return Ok(new DevProjectsAdapter(joinFsPath(this.root, path)));
	}

	async ensureDir(path: string): Promise<FsResult<FsDir>> {
		const parsed = parseFsPath('ensureDir', path);
		if (parsed.error) return parsed;
		const response = await this.request('ensureDir', path, { method: 'POST' });
		if (response.error) return response;
		return Ok(new DevProjectsAdapter(joinFsPath(this.root, path)));
	}

	async read(path: string): Promise<FsResult<File>> {
		const parsed = parseFsPath('read', path);
		if (parsed.error) return parsed;
		const response = await this.request('read', path);
		if (response.error) return response;
		const extension = basename(path).split('.').at(-1)?.toLowerCase() ?? '';
		const types: Record<string, string> = {
			svg: 'image/svg+xml',
			png: 'image/png',
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			gif: 'image/gif',
			webp: 'image/webp',
			json: 'application/json',
			pdf: 'application/pdf',
			csv: 'text/csv',
			md: 'text/markdown',
			txt: 'text/plain'
		};
		return Ok(
			new File([await response.data.blob()], basename(path), { type: types[extension] ?? '' })
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
		const chunk =
			typeof data === 'object' && data !== null && 'data' in data && data.type === 'write'
				? data.data
				: data;
		const response = await this.request('write', path, {
			method: 'POST',
			body: typeof chunk === 'string' ? chunk : new Blob([chunk as BlobPart])
		});
		if (response.error) return response;
		return Ok(undefined);
	}

	async remove(path: string, options?: { recursive?: boolean }): Promise<FsResult<void>> {
		const parsed = parseFsPath('remove', path);
		if (parsed.error) return parsed;
		const response = await this.request('remove', path, {
			method: 'DELETE',
			headers: { 'X-Recursive': String(options?.recursive ?? false) }
		});
		if (response.error) return response;
		return Ok(undefined);
	}

	async move(
		sourcePath: string,
		targetPath: string,
		options?: { overwrite?: boolean }
	): Promise<FsResult<void>> {
		const source = parseFsPath('move', sourcePath);
		if (source.error) return source;
		const target = parseFsPath('move', targetPath);
		if (target.error) return target;
		const response = await this.request('move', sourcePath, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				target: joinFsPath(this.root, targetPath),
				overwrite: options?.overwrite
			})
		});
		if (response.error) return response;
		return Ok(undefined);
	}
}
