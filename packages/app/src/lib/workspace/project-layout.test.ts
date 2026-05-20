import { describe, expect, it } from 'vitest';
import type {
	FsDir,
	FsEntry,
	FsResult,
	FsWriteData
} from '$lib/components/file-browser/adapters/adapter';
import { migrateProjectLayout, projectMigrationState, PROJECT_VERSION } from './project-layout';

const ok = <T>(data: T): FsResult<T> => ({ data, error: null }) as FsResult<T>;
const notFound = <T>(path: string): FsResult<T> =>
	({
		error: {
			name: 'NotFoundError',
			message: `not found: ${path}`,
			operation: 'read',
			path
		}
	}) as FsResult<T>;

class MemoryFs implements FsDir {
	name: string;

	constructor(
		private files: Map<string, string>,
		private root = ''
	) {
		this.name = root.split('/').filter(Boolean).pop() ?? 'root';
	}

	private path(path = '') {
		return [this.root, path].filter(Boolean).join('/').replace(/^\/+/, '');
	}

	async list(path = ''): Promise<FsResult<FsEntry[]>> {
		const prefix = this.path(path);
		const rootPrefix = prefix ? `${prefix}/` : '';
		const entries = new Map<string, FsEntry>();

		for (const filePath of this.files.keys()) {
			if (!filePath.startsWith(rootPrefix)) continue;
			const relative = filePath.slice(rootPrefix.length);
			const [name, ...rest] = relative.split('/');
			if (!name) continue;
			entries.set(name, { name, kind: rest.length ? 'directory' : 'file' });
		}

		if (prefix && entries.size === 0 && !this.files.has(prefix)) return notFound<FsEntry[]>(prefix);
		return ok([...entries.values()]);
	}

	async openDir(path: string): Promise<FsResult<FsDir>> {
		const entries = await this.list(path);
		if (entries.error) return entries as FsResult<FsDir>;
		return ok(new MemoryFs(this.files, this.path(path)));
	}

	async ensureDir(path: string): Promise<FsResult<FsDir>> {
		return ok(new MemoryFs(this.files, this.path(path)));
	}

	async read(path: string): Promise<FsResult<File>> {
		const text = this.files.get(this.path(path));
		if (text == null) return notFound<File>(path);
		return ok(new File([text], path.split('/').pop() ?? 'file'));
	}

	async readText(path: string): Promise<FsResult<string>> {
		const text = this.files.get(this.path(path));
		return text == null ? notFound<string>(path) : ok(text);
	}

	async write(path: string, data: FsWriteData): Promise<FsResult<void>> {
		this.files.set(this.path(path), typeof data === 'string' ? data : String(data));
		return ok(undefined);
	}

	async remove(path: string): Promise<FsResult<void>> {
		const target = this.path(path);
		for (const filePath of [...this.files.keys()]) {
			if (filePath === target || filePath.startsWith(`${target}/`)) this.files.delete(filePath);
		}
		return ok(undefined);
	}

	async move(sourcePath: string, targetPath: string): Promise<FsResult<void>> {
		const source = this.path(sourcePath);
		const target = this.path(targetPath);
		for (const filePath of [...this.files.keys()]) {
			if (filePath === source || filePath.startsWith(`${source}/`)) {
				const nextPath = filePath.replace(source, target);
				this.files.set(nextPath, this.files.get(filePath) ?? '');
				this.files.delete(filePath);
			}
		}
		return ok(undefined);
	}
}

describe('project layout migration', () => {
	it('moves old folders, rewrites asset references, and writes version metadata', async () => {
		const files = new Map([
			[
				'game/game.json',
				JSON.stringify({
					name: 'Game',
					minPlayers: 1,
					maxPlayers: 4,
					description: 'Test',
					tags: []
				})
			],
			['game/system/cards/front.svg', '<image href="../../files/card.png" />'],
			['game/system/cards/data.csv', 'id,image\n1,files/card.png'],
			['game/files/card.png', 'png']
		]);
		const fs = new MemoryFs(files);

		await expect(projectMigrationState(fs, 'game')).resolves.toMatchObject({
			needsMigration: true
		});
		await expect(migrateProjectLayout(fs, 'game')).resolves.toMatchObject({ error: null });

		expect(files.has('game/system/cards/front.svg')).toBe(false);
		expect(files.has('game/files/card.png')).toBe(false);
		expect(files.get('game/components/cards/front.svg')).toContain('../../assets/card.png');
		expect(files.get('game/components/cards/data.csv')).toContain('assets/card.png');
		expect(JSON.parse(files.get('game/game.json') ?? '{}').digitableVersion).toBe(PROJECT_VERSION);
	});
});
