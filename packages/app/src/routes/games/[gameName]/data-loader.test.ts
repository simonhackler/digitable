import { describe, expect, it } from 'vitest';
import type { FsDir, FsResult } from '$lib/components/file-browser/adapters/adapter';
import {
	getProjectFilePath,
	isImageFileName,
	listProjectImageFiles,
	resolveImageReference,
	TRANSPARENT_IMAGE
} from './data-loader';

const ok = <T>(data: T): FsResult<T> => ({ data, error: null }) as unknown as FsResult<T>;
const notFound = <T>(): FsResult<T> =>
	({
		error: {
			name: 'NotFoundError',
			message: 'not found',
			operation: 'read'
		}
	}) as FsResult<T>;

function createFs(entries: Record<string, Array<{ name: string; kind: 'file' | 'directory' }>>) {
	return {
		name: 'test',
		list: async (path = '') => ok(entries[path] ?? []),
		openDir: async () => notFound<FsDir>(),
		ensureDir: async () => notFound<FsDir>(),
		read: async () => notFound<File>(),
		readText: async () => notFound<string>(),
		write: async () => ok(undefined),
		remove: async () => ok(undefined),
		move: async () => ok(undefined)
	} satisfies FsDir;
}

describe('data-loader image helpers', () => {
	it('recognizes supported image filenames', () => {
		expect(isImageFileName('portrait.PNG')).toBe(true);
		expect(isImageFileName('generated/card.webp?cache=1')).toBe(true);
		expect(isImageFileName('notes.csv')).toBe(false);
		expect(isImageFileName('image')).toBe(false);
	});

	it('normalizes project-local image paths', () => {
		expect(getProjectFilePath('game', 'placeholder.svg')).toBe('/game/files/placeholder.svg');
		expect(getProjectFilePath('game', '../../files/generated/card.png')).toBe(
			'/game/files/generated/card.png'
		);
		expect(getProjectFilePath('game', '/game/files/generated/card.png')).toBe(
			'/game/files/generated/card.png'
		);
		expect(getProjectFilePath('game', 'data:image/png;base64,AA==')).toBeNull();
	});

	it('returns a transparent fallback for missing local images', async () => {
		const fs = createFs({});

		await expect(resolveImageReference(fs, 'game', 'missing.png')).resolves.toBe(TRANSPARENT_IMAGE);
	});

	it('lists image files recursively under project files', async () => {
		const fs = createFs({
			'game/files': [
				{ name: 'placeholder.svg', kind: 'file' },
				{ name: 'notes.csv', kind: 'file' },
				{ name: 'generated', kind: 'directory' }
			],
			'game/files/generated': [
				{ name: 'card.webp', kind: 'file' },
				{ name: 'prompt.txt', kind: 'file' }
			]
		});

		await expect(listProjectImageFiles(fs, 'game')).resolves.toEqual([
			'generated/card.webp',
			'placeholder.svg'
		]);
	});
});
