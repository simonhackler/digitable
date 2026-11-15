import { expect, test } from '@playwright/test';
import {
	openOpfsSeedPage,
	readOpfsText,
	useBrowserStorage,
	writeOpfsFiles,
	writeOpfsText
} from './helpers/opfs';

for (const observation of ['native', 'fallback']) {
	test(`${observation} observation imports directory changes and preserves app edits across tabs`, async ({
		playwright,
		browser: defaultBrowser
	}, testInfo) => {
		test.setTimeout(60000);
		const browser =
			observation === 'fallback'
				? await playwright.chromium.launch({
						executablePath: process.env.PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH,
						args: [
							'--disable-crashpad',
							'--disable-features=CrashpadSupport',
							'--disable-blink-features=FileSystemObserver'
						]
					})
				: defaultBrowser;
		const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
		try {
			const page = await context.newPage();
			const project = 'observed-project';
			await openOpfsSeedPage(page);
			expect(await page.evaluate(() => 'FileSystemObserver' in globalThis)).toBe(
				observation === 'native'
			);
			await writeOpfsText(
				page,
				`/${project}/game.json`,
				JSON.stringify({
					name: project,
					minPlayers: 1,
					maxPlayers: 4,
					description: 'Initial description',
					tags: []
				})
			);
			await useBrowserStorage(page);
			await page.goto(`/app/games/${project}`);
			await expect(page.getByLabel('Game Description')).toHaveValue('Initial description');
			const peer = await context.newPage();
			await peer.goto(`/app/games/${project}`);
			await expect(peer.getByLabel('Game Description')).toHaveValue('Initial description');

			// These writes bypass the application, just like an external editor using the same directory.
			await writeOpfsFiles(page, {
				[`/${project}/components/external/front.svg`]:
					'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text id="label">External card</text></svg>',
				[`/${project}/components/external/back.svg`]:
					'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>',
				[`/${project}/components/external/data.csv`]: 'id,label\nexternal-card,External card\n'
			});
			await page.getByRole('button', { name: 'Decks', exact: true }).click();
			await expect(page.getByRole('link', { name: 'external', exact: true })).toBeVisible();
			await peer.getByRole('button', { name: 'Decks', exact: true }).click();
			await expect(peer.getByRole('link', { name: 'external', exact: true })).toBeVisible();
			await page.evaluate(async (project) => {
				const root = await navigator.storage.getDirectory();
				const directory = await root.getDirectoryHandle(project);
				const components = await directory.getDirectoryHandle('components');
				const source = await components.getDirectoryHandle('external');
				const target = await components.getDirectoryHandle('renamed', { create: true });
				for (const name of ['front.svg', 'back.svg', 'data.csv']) {
					const file = await (await source.getFileHandle(name)).getFile();
					const writable = await (
						await target.getFileHandle(name, { create: true })
					).createWritable();
					await writable.write(await file.arrayBuffer());
					await writable.close();
				}
				await components.removeEntry('external', { recursive: true });
			}, project);
			for (const current of [page, peer]) {
				await expect(current.getByRole('link', { name: 'renamed', exact: true })).toBeVisible();
				await expect(current.getByRole('link', { name: 'external', exact: true })).toHaveCount(0);
			}

			await page.getByLabel('Game Description').fill('Edited through Automerge');
			await expect(peer.getByLabel('Game Description')).toHaveValue('Edited through Automerge');
			await expect(async () => {
				expect(await readOpfsText(page, `/${project}/game.json`)).toContain(
					'Edited through Automerge'
				);
			}).toPass({ timeout: 5000 });
			await writeOpfsText(
				peer,
				`/${project}/rules.md`,
				'# Rules changed outside the application\n'
			);
			await page.getByRole('link', { name: 'Rules', exact: true }).click();
			await expect(page.getByRole('textbox', { name: 'Game rules editor' })).toContainText(
				'Rules changed outside the application'
			);
			await peer.reload();
			await expect(peer.getByLabel('Game Description')).toHaveValue('Edited through Automerge');
		} finally {
			await context.close();
			if (observation === 'fallback') await browser.close();
		}
	});
}
