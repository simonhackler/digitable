import { expect, type Page } from '@playwright/test';
import { projectFiles } from './fixtures';

export async function writeBufferToOPFS(page: Page, dest: string, buf: Buffer) {
	await writeFilesToOPFS(page, [{ dest, base64: buf.toString('base64') }]);
}

export async function writeOpfsFiles(page: Page, files: Record<string, string | Buffer>) {
	await writeFilesToOPFS(
		page,
		Object.entries(files).map(([dest, content]) => ({
			dest,
			base64: Buffer.from(content).toString('base64')
		}))
	);
}

async function writeFilesToOPFS(page: Page, files: Array<{ dest: string; base64: string }>) {
	await page.evaluate(async (files) => {
		const storage = navigator.storage as StorageManager & {
			getDirectory: () => Promise<FileSystemDirectoryHandle>;
		};
		const root = await storage.getDirectory();

		async function writeFile(destPath: string, base64: string) {
			const binary = atob(base64);
			const bytes = new Uint8Array(binary.length);
			for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
			const parts = destPath.replace(/^\/+/, '').split('/');
			const fileName = parts.pop()!;
			let dir = root;
			for (const part of parts) {
				dir = await dir.getDirectoryHandle(part, { create: true });
			}
			const handle = await dir.getFileHandle(fileName, { create: true });
			const writable = await handle.createWritable();
			await writable.write(bytes);
			await writable.close();
		}

		for (let index = 0; index < files.length; index += 4) {
			await Promise.all(
				files.slice(index, index + 4).map((file) => writeFile(file.dest, file.base64))
			);
		}
	}, files);
}

export async function seedProjectFiles(
	page: Page,
	projectName: string,
	options?: { includeFileAssets?: boolean }
) {
	await writeFilesToOPFS(page, await projectFiles(projectName, options?.includeFileAssets ?? true));
}

export async function useBrowserStorage(page: Page) {
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games');
	await migrateProjectsIfPrompted(page);
}

export async function migrateProjectsIfPrompted(page: Page) {
	await expect(page.getByRole('heading', { name: /Board Games|Migrate Projects/ })).toBeVisible();

	const migrationHeading = page.getByRole('heading', { name: 'Migrate Projects' });
	if (await migrationHeading.isVisible()) {
		await page.getByRole('button', { name: 'Migrate projects' }).click();
	}
	await expect(page.getByRole('heading', { name: 'Board Games' })).toBeVisible();
}

export async function saveOpfsStoragePreference(page: Page) {
	await page.evaluate(async () => {
		localStorage.setItem('storage-preference', 'opfs');

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
				transaction.objectStore('keyval').put('opfs', 'storage-preference');
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
	});
}

export async function openOpfsSeedPage(page: Page) {
	await page.goto('/placeholder.svg');
	await page.setContent('<!doctype html><html><body><h1>OPFS seed</h1></body></html>');
}

export async function seedProjects(
	page: Page,
	options?: { projectNames?: string[]; includeFileAssets?: boolean }
) {
	await openOpfsSeedPage(page);
	for (const projectName of options?.projectNames ?? ['western-cards']) {
		await seedProjectFiles(page, projectName, {
			includeFileAssets: options?.includeFileAssets ?? false
		});
	}
	await useBrowserStorage(page);
}

export async function writeOpfsText(page: Page, destPath: string, text: string) {
	await writeOpfsFiles(page, { [destPath]: text });
}

export async function readOpfsText(page: Page, sourcePath: string) {
	return page.evaluate(async (sourcePath) => {
		const storage = navigator.storage as StorageManager & {
			getDirectory: () => Promise<FileSystemDirectoryHandle>;
		};
		const root = await storage.getDirectory();
		const parts = sourcePath.replace(/^\/+/, '').split('/');
		const fileName = parts.pop()!;
		let dir = root;
		for (const part of parts) {
			dir = await dir.getDirectoryHandle(part);
		}
		const handle = await dir.getFileHandle(fileName);
		return handle.getFile().then((file) => file.text());
	}, sourcePath);
}

export async function readOpfsBytes(page: Page, sourcePath: string) {
	return page.evaluate(async (sourcePath) => {
		const storage = navigator.storage as StorageManager & {
			getDirectory: () => Promise<FileSystemDirectoryHandle>;
		};
		const root = await storage.getDirectory();
		const parts = sourcePath.replace(/^\/+/, '').split('/');
		const fileName = parts.pop()!;
		let dir = root;
		for (const part of parts) dir = await dir.getDirectoryHandle(part);
		const handle = await dir.getFileHandle(fileName);
		return Array.from(new Uint8Array(await (await handle.getFile()).arrayBuffer()));
	}, sourcePath);
}

export async function opfsEntryExists(page: Page, sourcePath: string) {
	return page.evaluate(async (sourcePath) => {
		const storage = navigator.storage as StorageManager & {
			getDirectory: () => Promise<FileSystemDirectoryHandle>;
		};
		const root = await storage.getDirectory();
		const parts = sourcePath.replace(/^\/+/, '').split('/').filter(Boolean);
		const entryName = parts.pop();
		if (!entryName) return true;

		let dir = root;
		for (const part of parts) {
			try {
				dir = await dir.getDirectoryHandle(part);
			} catch {
				return false;
			}
		}

		try {
			await dir.getFileHandle(entryName);
			return true;
		} catch {
			try {
				await dir.getDirectoryHandle(entryName);
				return true;
			} catch {
				return false;
			}
		}
	}, sourcePath);
}
