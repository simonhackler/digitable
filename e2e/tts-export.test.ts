import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { seedProjectFiles, useBrowserStorage } from './helpers/opfs';

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

async function seedTtsLocalProject(page: Page) {
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

async function listOpfsEntries(page: Page, path: string) {
	return page.evaluate(async (path) => {
		const storage = navigator.storage as StorageManager & {
			getDirectory: () => Promise<FileSystemDirectoryHandle>;
		};
		const root = await storage.getDirectory();
		const parts = path.replace(/^\/+/, '').split('/').filter(Boolean);

		let dir = root;
		for (const part of parts) {
			dir = await dir.getDirectoryHandle(part);
		}

		const entries: Array<{ name: string; kind: FileSystemHandleKind }> = [];
		for await (const [name, handle] of dir.entries()) {
			entries.push({ name, kind: handle.kind });
		}

		return entries.sort((a, b) => a.name.localeCompare(b.name));
	}, path);
}

async function ttsExportFolders(page: Page, project: string) {
	const entries = await listOpfsEntries(page, `${project}/tts-export`);
	return entries
		.filter(
			(entry) =>
				entry.kind === 'directory' &&
				/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(?:-\d+)?$/.test(entry.name)
		)
		.map((entry) => entry.name);
}

async function latestTtsExportFolder(page: Page, project: string) {
	const folders = await ttsExportFolders(page, project);
	const folder = folders.at(-1);
	expect(folder).toBeTruthy();
	return folder!;
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

function decodeSvgDataUrl(dataUrl: string) {
	const [, payload = ''] = dataUrl.split(',', 2);
	return dataUrl.includes(';base64,')
		? Buffer.from(payload, 'base64').toString('utf8')
		: decodeURIComponent(payload);
}

async function attachTtsExportFile(
	page: Page,
	testInfo: TestInfo,
	project: string,
	exportFolderName: string,
	fileName: string
) {
	const opfsPath = `${project}/tts-export/${exportFolderName}/${fileName}`;
	const file = await readOpfsFile(page, opfsPath);
	const buffer = Buffer.from(file.base64, 'base64');
	const outputPath = testInfo.outputPath('tts-export', exportFolderName, fileName);

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
	await seedTtsLocalProject(page);

	await useBrowserStorage(page, 1);
	await page.goto(`/app/games/${projectName}/export/tts`);

	await expect(page.getByText('TTS export finished successfully!')).toBeVisible({
		timeout: 30_000
	});
	const exportFolderName = await latestTtsExportFolder(page, projectName);
	const exportPath = `${projectName}/tts-export/${exportFolderName}`;
	await expect(page.getByText(`Saved to ${exportPath}`)).toBeVisible();
	expect(await opfsFileExists(page, `${exportPath}/local-image-deck_0_70_sheet.png`)).toBe(true);
	expect(await opfsFileExists(page, `${exportPath}/local-image-deck_0_70_back_sheet.png`)).toBe(
		true
	);

	const hiddenSheetMarkup = await page.locator('.hide #sheet').evaluate((sheet) => sheet.innerHTML);
	expect(hiddenSheetMarkup).not.toContain('/placeholder.svg');

	const remainingImageHrefs = await page
		.locator('.hide #sheet svg image')
		.evaluateAll((images) =>
			images.map((image) => image.getAttribute('href') ?? image.getAttribute('xlink:href') ?? '')
		);
	expect(remainingImageHrefs.some((href) => href.includes('/placeholder.svg'))).toBe(false);
	expect(remainingImageHrefs.some((href) => decodeSvgDataUrl(href).includes('#0f172a'))).toBe(true);

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

	await page.goto('/app/games');
	await seedProjectFiles(page, westernProjectName);

	await useBrowserStorage(page, 1);
	await page.goto(`/app/games/${westernProjectName}/export/tts`);

	await expect(page.getByText('TTS export finished successfully!')).toBeVisible({
		timeout: 120_000
	});
	const exportFolderName = await latestTtsExportFolder(page, westernProjectName);
	const exportPath = `${westernProjectName}/tts-export/${exportFolderName}`;
	const jsonExportPath = `tts-export/${exportFolderName}`;
	await expect(page.getByText(`Saved to ${exportPath}`)).toBeVisible();

	const exportFileNames = [
		'ggd_0_70_sheet.png',
		'ggd_0_70_back_sheet.png',
		'western_0_70_sheet.png',
		'western_0_70_back_sheet.png',
		'next_deck_0_70_sheet.png',
		'next_deck_0_70_back_sheet.png',
		'western-cards.json'
	];

	for (const fileName of exportFileNames) {
		expect(await opfsFileExists(page, `${exportPath}/${fileName}`)).toBe(true);
	}

	const manifest = [];
	for (const fileName of exportFileNames) {
		manifest.push(
			await attachTtsExportFile(page, testInfo, westernProjectName, exportFolderName, fileName)
		);
	}
	const manifestPath = testInfo.outputPath('tts-export', 'manifest.json');
	await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
	await testInfo.attach('tts-export-manifest.json', {
		path: manifestPath,
		contentType: 'application/json'
	});

	const exportJson = JSON.parse(await readOpfsTextFile(page, `${exportPath}/western-cards.json`));
	expect(
		exportJson.ObjectStates.map((state: { Nickname: string }) => state.Nickname).sort()
	).toEqual(['ggd', 'next_deck', 'western']);
	const westernDeck = exportJson.ObjectStates.find(
		(state: { Nickname: string }) => state.Nickname === 'western'
	);
	if (!westernDeck) {
		throw new Error('western deck missing from TTS export');
	}
	const customDeck = Object.values(westernDeck.CustomDeck)[0] as {
		FaceURL: string;
		BackURL: string;
	};
	expect(customDeck.FaceURL).toBe(`${jsonExportPath}/western_0_70_sheet.png`);
	expect(customDeck.BackURL).toBe(`${jsonExportPath}/western_0_70_back_sheet.png`);

	expect(exportErrors.filter((message) => message.includes('Error taking image'))).toEqual([]);
	expect(
		exportErrors.filter((message) => message.includes('[takeImage] Broken image src'))
	).toEqual([]);
});

test('creates a distinct timestamped folder for each TTS export', async ({ page }) => {
	test.setTimeout(90_000);

	await page.goto('/app/games');
	await seedTtsLocalProject(page);

	await useBrowserStorage(page, 1);

	await page.goto(`/app/games/${projectName}/export/tts`);
	await expect(page.getByText('TTS export finished successfully!')).toBeVisible({
		timeout: 30_000
	});
	const firstFolders = await ttsExportFolders(page, projectName);
	expect(firstFolders).toHaveLength(1);
	const firstExportPath = `${projectName}/tts-export/${firstFolders[0]}`;
	expect(await opfsFileExists(page, `${firstExportPath}/local-image-deck_0_70_sheet.png`)).toBe(
		true
	);

	await page.goto('/app/games');
	await page.goto(`/app/games/${projectName}/export/tts`);
	await expect(page.getByText('TTS export finished successfully!')).toBeVisible({
		timeout: 30_000
	});

	const secondFolders = await ttsExportFolders(page, projectName);
	expect(secondFolders).toHaveLength(2);
	expect(new Set(secondFolders).size).toBe(2);
	expect(await opfsFileExists(page, `${firstExportPath}/local-image-deck_0_70_sheet.png`)).toBe(
		true
	);

	const newestFolder = secondFolders.find((folder) => folder !== firstFolders[0]);
	expect(newestFolder).toBeTruthy();
	const secondExportPath = `${projectName}/tts-export/${newestFolder}`;
	await expect(page.getByText(`Saved to ${secondExportPath}`)).toBeVisible();
	expect(await opfsFileExists(page, `${secondExportPath}/local-image-deck_0_70_sheet.png`)).toBe(
		true
	);
});
