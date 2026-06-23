import { expect, type Page } from '@playwright/test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export type Mapping = { src: string; dest: string };

const EXCLUDED_DIRECTORY_NAMES = new Set(['feedback', 'tts-export']);
const SEED_CONCURRENCY = 4;
const here = path.dirname(fileURLToPath(import.meta.url));
const defaultProjectsDir = path.resolve(here, '../../projects');
const DEFAULT_PROJECT_NAMES = ['western-cards'];
const directoryMappings = new Map<string, Promise<Mapping[]>>();
const allProjectMappings = new Map<string, Promise<Mapping[]>>();

const shouldSeedProjectEntry = (name: string) => !name.startsWith('.');

const shouldSeedPath = (dest: string) => {
	const parts = dest.split('/').filter(Boolean);
	return !parts.includes('tts-export') && !parts.includes('system') && !parts.includes('files');
};

const shouldSeedProjectAsset = (dest: string, includeFileAssets: boolean) => {
	if (includeFileAssets) {
		return true;
	}

	return !dest.split('/').includes('assets');
};

export async function writeBufferToOPFS(page: Page, dest: string, buf: Buffer) {
	const base64 = buf.toString('base64');
	await page.evaluate(
		async ({ destPath, base64 }) => {
			// Convert base64 -> Uint8Array in the page (browser) context
			const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

			// Walk/create directories, then create/write the file
			const storage = navigator.storage as StorageManager & {
				getDirectory: () => Promise<FileSystemDirectoryHandle>;
			};
			const root = await storage.getDirectory();
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
		},
		{ destPath: dest, base64 }
	);
}

async function writeFilesToOPFS(page: Page, files: Array<{ dest: string; base64: string }>) {
	await page.evaluate(async (files) => {
		const storage = navigator.storage as StorageManager & {
			getDirectory: () => Promise<FileSystemDirectoryHandle>;
		};
		const root = await storage.getDirectory();

		async function writeFile(destPath: string, base64: string) {
			const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
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

		for (const file of files) {
			await writeFile(file.dest, file.base64);
		}
	}, files);
}

/**
 * Recursively walk a directory and return all file mappings.
 */
export async function walkDirectory(dir: string, baseDestPath: string = ''): Promise<Mapping[]> {
	const mappings: Mapping[] = [];
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.isDirectory() && EXCLUDED_DIRECTORY_NAMES.has(entry.name)) {
			continue;
		}

		const srcPath = path.join(dir, entry.name);
		const destPath = path.join(baseDestPath, entry.name).replace(/\\/g, '/');

		if (entry.isDirectory()) {
			const subdirMappings = await walkDirectory(srcPath, destPath);
			mappings.push(...subdirMappings);
		} else {
			mappings.push({ src: srcPath, dest: destPath });
		}
	}

	return mappings;
}

async function cachedWalkDirectory(dir: string, baseDestPath: string = '') {
	const cacheKey = `${dir}\0${baseDestPath}`;
	const cached = directoryMappings.get(cacheKey);
	if (cached) {
		return cached;
	}

	const mappings = walkDirectory(dir, baseDestPath);
	directoryMappings.set(cacheKey, mappings);
	return mappings;
}

export async function projectMappings(projectName: string) {
	const projectDir = path.join(defaultProjectsDir, projectName);
	return cachedWalkDirectory(projectDir, `/${projectName}`);
}

/**
 * Seed multiple files into OPFS.
 */
export async function seedOPFS(page: Page, mappings: Mapping[]) {
	for (let index = 0; index < mappings.length; index += SEED_CONCURRENCY) {
		const chunk = mappings.slice(index, index + SEED_CONCURRENCY);
		const files = await Promise.all(
			chunk.map(async ({ src, dest }) => {
				const buf = await fs.readFile(src);
				return { dest, base64: buf.toString('base64') };
			})
		);
		await writeFilesToOPFS(page, files);
	}
}

export async function fullOpfsSeed(page: Page, projectsDir: string) {
	let allMappingsPromise = allProjectMappings.get(projectsDir);
	if (!allMappingsPromise) {
		allMappingsPromise = (async () => {
			const projectEntries = await fs.readdir(projectsDir, { withFileTypes: true });
			const mappingsPromises = projectEntries
				.filter((entry) => entry.isDirectory() && shouldSeedProjectEntry(entry.name))
				.map(async (entry) => {
					const subfolderPath = path.join(projectsDir, entry.name);
					return cachedWalkDirectory(subfolderPath, `/${entry.name}`);
				});
			const allMappingsArrays = await Promise.all(mappingsPromises);
			return allMappingsArrays.flat().filter(({ dest }) => shouldSeedPath(dest));
		})();
		allProjectMappings.set(projectsDir, allMappingsPromise);
	}

	await seedOPFS(page, await allMappingsPromise);
}

export async function seedProjectFiles(
	page: Page,
	projectName: string,
	options?: { includeFileAssets?: boolean }
) {
	await seedOPFS(
		page,
		(await projectMappings(projectName)).filter(
			({ dest }) =>
				shouldSeedPath(dest) && shouldSeedProjectAsset(dest, options?.includeFileAssets ?? true)
		)
	);
}

export async function useBrowserStorage(page: Page, useBrowserButtonIndex = 0) {
	if (await page.getByRole('heading', { name: 'Board Games' }).isVisible()) {
		return;
	}

	const useBrowserButton = page
		.getByRole('button', { name: 'Use Browser' })
		.nth(useBrowserButtonIndex);
	if (!(await useBrowserButton.isVisible({ timeout: 2000 }).catch(() => false))) {
		await saveOpfsStoragePreference(page);
		await page.goto('/app/games');
		await migrateProjectsIfPrompted(page);
		return;
	}

	await useBrowserButton.click();
	await page.getByRole('button', { name: 'Use Browser storage' }).click();
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

export async function openSeededProjects(page: Page, options?: { projectNames?: string[] }) {
	await openOpfsSeedPage(page);
	for (const projectName of options?.projectNames ?? DEFAULT_PROJECT_NAMES) {
		await seedProjectFiles(page, projectName, { includeFileAssets: false });
	}
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games');
	await migrateProjectsIfPrompted(page);
}

export async function seedProjects(page: Page) {
	await openSeededProjects(page);
}

export async function writeOpfsText(page: Page, destPath: string, text: string) {
	await page.evaluate(
		async ({ destPath, text }) => {
			const storage = navigator.storage as StorageManager & {
				getDirectory: () => Promise<FileSystemDirectoryHandle>;
			};
			const root = await storage.getDirectory();
			const parts = destPath.replace(/^\/+/, '').split('/');
			const fileName = parts.pop()!;
			let dir = root;
			for (const part of parts) {
				dir = await dir.getDirectoryHandle(part, { create: true });
			}
			const handle = await dir.getFileHandle(fileName, { create: true });
			const writable = await handle.createWritable();
			await writable.write(text);
			await writable.close();
		},
		{ destPath, text }
	);
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
