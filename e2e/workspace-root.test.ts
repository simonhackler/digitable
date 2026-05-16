import { expect, test, type Page } from '@playwright/test';

const markerName = '.digitable.json';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

type SavedRootOptions = {
	marker?: boolean;
	project?: boolean;
	junkFile?: boolean;
};

async function saveOpfsRootAsDirectoryPreference(page: Page, options: SavedRootOptions = {}) {
	await page.goto('/app/games');
	await page.setContent('<!doctype html><html><body><h1>Workspace seed</h1></body></html>');
	await page.evaluate(
		async ({ markerName, marker, project, junkFile }) => {
			const storage = navigator.storage as StorageManager & {
				getDirectory: () => Promise<FileSystemDirectoryHandle>;
			};
			const root = await storage.getDirectory();

			if (project) {
				const project = await root.getDirectoryHandle('western-cards', { create: true });
				const game = await project.getFileHandle('game.json', { create: true });
				const gameWritable = await game.createWritable();
				await gameWritable.write(
					JSON.stringify({
						name: 'Western Cards',
						description: 'Seeded workspace root validation project.',
						tags: ['E2E']
					})
				);
				await gameWritable.close();
			}

			if (junkFile) {
				const file = await root.getFileHandle('notes.txt', { create: true });
				const writable = await file.createWritable();
				await writable.write('not a Digitable workspace');
				await writable.close();
			}

			if (marker) {
				const markerFile = await root.getFileHandle(markerName, { create: true });
				const markerWritable = await markerFile.createWritable();
				await markerWritable.write(
					JSON.stringify({
						schemaVersion: 1,
						lastOpenedAppVersion: 'test-version',
						updatedAt: '2026-05-16T12:00:00.000Z'
					})
				);
				await markerWritable.close();
			}

			localStorage.setItem('storage-preference', 'directory');

			await new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('keyval-store', 1);
				request.onupgradeneeded = () => {
					const db = request.result;
					if (!db.objectStoreNames.contains('keyval')) {
						db.createObjectStore('keyval');
					}
				};
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const db = request.result;
					const transaction = db.transaction('keyval', 'readwrite');
					const store = transaction.objectStore('keyval');
					store.put(root, 'saved-folder');
					store.put('directory', 'storage-preference');
					transaction.oncomplete = () => {
						db.close();
						resolve();
					};
					transaction.onerror = () => {
						const error = transaction.error;
						db.close();
						reject(error);
					};
				};
			});
		},
		{
			markerName,
			marker: options.marker ?? false,
			project: options.project ?? true,
			junkFile: options.junkFile ?? false
		}
	);
}

async function readRootMarker(page: Page) {
	return page.evaluate(async (markerName) => {
		const storage = navigator.storage as StorageManager & {
			getDirectory: () => Promise<FileSystemDirectoryHandle>;
		};
		const root = await storage.getDirectory();
		const marker = await root.getFileHandle(markerName);
		return JSON.parse(await (await marker.getFile()).text()) as unknown;
	}, markerName);
}

test('restores a saved projects root with a valid workspace marker', async ({ page }) => {
	await saveOpfsRootAsDirectoryPreference(page, { marker: true });

	await page.goto('/app/games');

	await expect(page.getByRole('heading', { name: 'Board Games' })).toBeVisible();
	await expect(page.getByRole('main').getByText('western-cards')).toBeVisible();
	await expect(readRootMarker(page)).resolves.toMatchObject({
		schemaVersion: 1,
		lastOpenedAppVersion: 'dev'
	});
});

test('rejects a saved projects root without a workspace marker', async ({ page }) => {
	await saveOpfsRootAsDirectoryPreference(page);

	await page.goto('/app/games');

	await expect(
		page.getByRole('alert').filter({
			hasText: 'Pick your projects folder again. Digitable now requires a .digitable.json file.'
		})
	).toBeVisible();
	await expect(page.getByText(`Create ${markerName} in that folder with this JSON:`)).toBeVisible();
	await expect(page.getByText('"schemaVersion": 1')).toBeVisible();
	await expect(page.getByText('"lastOpenedAppVersion": "dev"')).toBeVisible();
	await page.getByRole('button', { name: 'Copy JSON' }).click();
	await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
	await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toContain(
		'"schemaVersion": 1'
	);
	await expect(page.getByRole('button', { name: 'Pick folder' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Board Games' })).not.toBeVisible();
});

test('rejects a saved non-empty folder without a workspace marker', async ({ page }) => {
	await saveOpfsRootAsDirectoryPreference(page, { project: false, junkFile: true });

	await page.goto('/app/games');

	await expect(
		page.getByRole('alert').filter({
			hasText: 'Pick your projects folder again. Digitable now requires a .digitable.json file.'
		})
	).toBeVisible();
	await expect(page.getByText(`Create ${markerName} in that folder with this JSON:`)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Copy JSON' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Pick folder' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Board Games' })).not.toBeVisible();
});
