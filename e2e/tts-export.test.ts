import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { seedOPFS, walkDirectory } from './helpers/opfs';

const projectName = 'tts-local-images';
const westernProjectName = 'western-cards';

const files = [
	{
		path: `${projectName}/game.json`,
		type: 'application/json',
		contents: JSON.stringify({
			name: 'TTS Local Images',
			description: 'Small project for TTS export e2e coverage.',
			tags: []
		})
	},
	{
		path: `${projectName}/files/placeholder.svg`,
		type: 'image/svg+xml',
		contents:
			'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><rect width="1" height="1" fill="#0f172a"/></svg>'
	},
	{
		path: `${projectName}/system/local-image-deck/front.svg`,
		type: 'image/svg+xml',
		contents:
			'<svg xmlns="http://www.w3.org/2000/svg" width="63mm" height="88mm" viewBox="0 0 63 88"><rect id="front_background" width="63" height="88" fill="#fff7ed"/><text id="title" x="8" y="44" font-size="8" fill="#111827">Title</text></svg>'
	},
	{
		path: `${projectName}/system/local-image-deck/back.svg`,
		type: 'image/svg+xml',
		contents:
			'<svg xmlns="http://www.w3.org/2000/svg" width="63mm" height="88mm" viewBox="0 0 63 88"><image id="template_background" href="/placeholder.svg" width="63" height="88"/></svg>'
	},
	{
		path: `${projectName}/system/local-image-deck/data.csv`,
		type: 'text/csv',
		contents: 'id,title\n1,Export me\n'
	}
];

async function writeTextFileToOPFS(page: Page, path: string, contents: string, type: string) {
	await page.evaluate(
		async ({ path, contents, type }) => {
			const storage = navigator.storage as StorageManager & {
				getDirectory: () => Promise<FileSystemDirectoryHandle>;
			};
			const root = await storage.getDirectory();
			const parts = path.replace(/^\/+/, '').split('/');
			const fileName = parts.pop()!;
			let dir = root;
			for (const part of parts) {
				dir = await dir.getDirectoryHandle(part, { create: true });
			}
			const handle = await dir.getFileHandle(fileName, { create: true });
			const writable = await handle.createWritable();
			await writable.write(new Blob([contents], { type }));
			await writable.close();
		},
		{ path, contents, type }
	);
}

async function seedProject(page: Page) {
	await Promise.all(
		files.map((file) => writeTextFileToOPFS(page, file.path, file.contents, file.type))
	);
}

async function opfsFileExists(page: Page, path: string) {
	return page.evaluate(async (path) => {
		const storage = navigator.storage as StorageManager & {
			getDirectory: () => Promise<FileSystemDirectoryHandle>;
		};
		const root = await storage.getDirectory();
		const parts = path.replace(/^\/+/, '').split('/');
		const fileName = parts.pop();
		if (!fileName) return false;

		let dir = root;
		for (const part of parts) {
			try {
				dir = await dir.getDirectoryHandle(part);
			} catch {
				return false;
			}
		}

		try {
			const handle = await dir.getFileHandle(fileName);
			const file = await handle.getFile();
			return file.size > 0;
		} catch {
			return false;
		}
	}, path);
}

async function readOpfsTextFile(page: Page, path: string) {
	return page.evaluate(async (path) => {
		const storage = navigator.storage as StorageManager & {
			getDirectory: () => Promise<FileSystemDirectoryHandle>;
		};
		const root = await storage.getDirectory();
		const parts = path.replace(/^\/+/, '').split('/');
		const fileName = parts.pop();
		if (!fileName) throw new Error('Missing file name');

		let dir = root;
		for (const part of parts) {
			dir = await dir.getDirectoryHandle(part);
		}

		const handle = await dir.getFileHandle(fileName);
		const file = await handle.getFile();
		return file.text();
	}, path);
}

async function readOpfsFile(page: Page, path: string) {
	return page.evaluate(async (path) => {
		const storage = navigator.storage as StorageManager & {
			getDirectory: () => Promise<FileSystemDirectoryHandle>;
		};
		const root = await storage.getDirectory();
		const parts = path.replace(/^\/+/, '').split('/');
		const fileName = parts.pop();
		if (!fileName) throw new Error('Missing file name');

		let dir = root;
		for (const part of parts) {
			dir = await dir.getDirectoryHandle(part);
		}

		const handle = await dir.getFileHandle(fileName);
		const file = await handle.getFile();
		const bytes = new Uint8Array(await file.arrayBuffer());
		let binary = '';
		for (let i = 0; i < bytes.length; i += 0x8000) {
			binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
		}

		return {
			base64: btoa(binary),
			size: file.size,
			type: file.type
		};
	}, path);
}

function contentTypeFor(fileName: string) {
	return fileName.endsWith('.json') ? 'application/json' : 'image/png';
}

async function attachTtsExportFile(
	page: Page,
	testInfo: TestInfo,
	project: string,
	fileName: string
) {
	const opfsPath = `${project}/tts-export/${fileName}`;
	const file = await readOpfsFile(page, opfsPath);
	const buffer = Buffer.from(file.base64, 'base64');
	const outputPath = testInfo.outputPath('tts-export', fileName);

	await fs.mkdir(path.dirname(outputPath), { recursive: true });
	await fs.writeFile(outputPath, buffer);
	await testInfo.attach(fileName, {
		path: outputPath,
		contentType: file.type || contentTypeFor(fileName)
	});

	return {
		fileName,
		size: file.size,
		sha256: createHash('sha256').update(buffer).digest('hex')
	};
}

test('inlines local image refs before rasterizing TTS sheets', async ({ page }) => {
	test.setTimeout(60_000);
	const exportErrors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') {
			exportErrors.push(message.text());
		}
	});

	await page.goto('/app/games');
	await seedProject(page);

	await page.getByRole('button', { name: 'Use Browser' }).nth(1).click();
	await page.getByRole('button', { name: 'Use Browser storage' }).click();
	await page.goto(`/app/games/${projectName}/export/tts`);

	await expect(page.getByText('TTS export finished successfully!')).toBeVisible({
		timeout: 30_000
	});
	expect(
		await opfsFileExists(page, `${projectName}/tts-export/local-image-deck_0_70_sheet.png`)
	).toBe(true);
	expect(
		await opfsFileExists(page, `${projectName}/tts-export/local-image-deck_0_70_back_sheet.png`)
	).toBe(true);

	const hiddenSheetMarkup = await page.locator('.hide #sheet').evaluate((sheet) => sheet.innerHTML);
	expect(hiddenSheetMarkup).not.toContain('/placeholder.svg');
	expect(hiddenSheetMarkup).toContain('#0f172a');

	const remainingImageHrefs = await page
		.locator('.hide #sheet svg image')
		.evaluateAll((images) =>
			images.map((image) => image.getAttribute('href') ?? image.getAttribute('xlink:href') ?? '')
		);
	expect(remainingImageHrefs.some((href) => href.includes('/placeholder.svg'))).toBe(false);

	expect(exportErrors.filter((message) => message.includes('Error taking image'))).toEqual([]);
	expect(
		exportErrors.filter((message) => message.includes('[takeImage] Broken image src'))
	).toEqual([]);
});

test('exports the full western cards TTS package', async ({ page }, testInfo) => {
	test.setTimeout(180_000);
	const exportErrors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') {
			exportErrors.push(message.text());
		}
	});

	const here = path.dirname(test.info().file);
	const westernProjectDir = path.resolve(here, '../projects', westernProjectName);
	const mappings = (await walkDirectory(westernProjectDir, `/${westernProjectName}`)).filter(
		({ dest }) => !dest.includes('/tts-export/')
	);

	await page.goto('/app/games');
	await seedOPFS(page, mappings);

	await page.getByRole('button', { name: 'Use Browser' }).nth(1).click();
	await page.getByRole('button', { name: 'Use Browser storage' }).click();
	await page.goto(`/app/games/${westernProjectName}/export/tts`);

	await expect(page.getByText('TTS export finished successfully!')).toBeVisible({
		timeout: 120_000
	});

	const exportFileNames = [
		'best_deck_0_70_sheet.png',
		'best_deck_0_70_back_sheet.png',
		'western_0_70_sheet.png',
		'western_0_70_back_sheet.png',
		'western-cards.json'
	];

	for (const fileName of exportFileNames) {
		expect(await opfsFileExists(page, `${westernProjectName}/tts-export/${fileName}`)).toBe(true);
	}

	const manifest = [];
	for (const fileName of exportFileNames) {
		manifest.push(await attachTtsExportFile(page, testInfo, westernProjectName, fileName));
	}
	const manifestPath = testInfo.outputPath('tts-export', 'manifest.json');
	await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
	await testInfo.attach('tts-export-manifest.json', {
		path: manifestPath,
		contentType: 'application/json'
	});

	const exportJson = JSON.parse(
		await readOpfsTextFile(page, `${westernProjectName}/tts-export/western-cards.json`)
	);
	expect(
		exportJson.ObjectStates.map((state: { Nickname: string }) => state.Nickname).sort()
	).toEqual(['best_deck', 'western']);

	expect(exportErrors.filter((message) => message.includes('Error taking image'))).toEqual([]);
	expect(
		exportErrors.filter((message) => message.includes('[takeImage] Broken image src'))
	).toEqual([]);
});
