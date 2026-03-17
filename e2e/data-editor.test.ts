import { expect, Page, test } from '@playwright/test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

type Mapping = { src: string; dest: string };

async function writeBufferToOPFS(page: Page, dest: string, buf: Buffer) {
	const base64 = buf.toString('base64');
	await page.evaluate(
		async ({ destPath, base64 }) => {
			// Convert base64 -> Uint8Array in the page (browser) context
			const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
			console.log(bytes);

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

/**
 * Recursively walk a directory and return all file mappings.
 */
async function walkDirectory(dir: string, baseDestPath: string = ''): Promise<Mapping[]> {
	const mappings: Mapping[] = [];
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
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

/**
 * Seed multiple files into OPFS.
 */
async function seedOPFS(page: Page, mappings: Mapping[]) {
	await Promise.all(
		mappings.map(async ({ src, dest }) => {
			const buf = await fs.readFile(src);
			await writeBufferToOPFS(page, dest, buf);
		})
	);
}

async function fullOpfsSeed(page: Page, projectsDir: string) {
	const projectEntries = await fs.readdir(projectsDir, { withFileTypes: true });
	const mappingsPromises = projectEntries
		.filter((entry) => entry.isDirectory())
		.map(async (entry) => {
			const subfolderPath = path.join(projectsDir, entry.name);
			return walkDirectory(subfolderPath, `/${entry.name}`);
		});
	const allMappingsArrays = await Promise.all(mappingsPromises);
	const allMappings = allMappingsArrays.flat();
	await seedOPFS(page, allMappings);
}

test('insert rows in data editor', async ({ page }) => {
	const here = path.dirname(test.info().file); // absolute dir of THIS test file
	const projectsDir = path.resolve(here, '../projects');

	await page.goto('/games');
    await fullOpfsSeed(page, projectsDir);

	await page.getByRole('button', { name: 'Use Browser' }).nth(1).click();
	await page.getByRole('button', { name: 'Use Browser storage' }).click();
	await page.getByRole('main').getByText('western-cards').click();
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('link', { name: 'western', exact: true }).click();
	await page.locator('tbody > tr > td:nth-child(8)').first().dblclick();
	await page.getByRole('textbox').fill('wow!');
	await expect(page.locator('.flex.w-screen > div:nth-child(1)').getByText('wow!')).toBeVisible();
	await page.getByRole('cell', { name: '1', exact: true }).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Delete selected rows' }).click();
	await expect(
		page.locator('.flex.w-screen > div:nth-child(1)').getByText('wow!')
	).not.toBeVisible();

	await page.getByRole('cell', { name: '1', exact: true }).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Insert a new row after' }).click();

	await page.getByRole('cell', { name: '1', exact: true }).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Insert a new row before' }).click();
});

test('go to data editor', async ({ page }) => {
	await page.goto('/games');
	await page.getByRole('button', { name: 'Use Browser' }).nth(1).click();
	await page.getByRole('button', { name: 'Use Browser storage' }).click();
	await expect(page.locator('h1')).toBeVisible();
});
