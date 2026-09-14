import { expect, test } from '@playwright/test';
import {
	openOpfsSeedPage,
	readOpfsBytes,
	readOpfsText,
	saveOpfsStoragePreference,
	migrateProjectsIfPrompted,
	writeBufferToOPFS,
	writeOpfsText
} from './helpers/opfs';

test.setTimeout(60_000);

test('bootstraps every recognized project file into Automerge', async ({ page }) => {
	const project = 'automerge-all-files';
	await openOpfsSeedPage(page);
	await writeOpfsText(
		page,
		`/${project}/game.json`,
		`${JSON.stringify({
			name: 'Automerge all files',
			minPlayers: 1,
			maxPlayers: 4,
			description: 'A complete synchronization fixture.',
			tags: []
		})}\n`
	);
	await writeOpfsText(page, `/${project}/rules.md`, '# Rules\n');
	await writeOpfsText(page, `/${project}/components/cards/front.svg`, '<svg></svg>\n');
	await writeOpfsText(page, `/${project}/components/cards/back.svg`, '<svg></svg>\n');
	await writeOpfsText(page, `/${project}/components/cards/data.csv`, 'id,name\ncard-1,Ace\n');
	await writeOpfsText(page, `/${project}/setup/table.svg`, '<svg></svg>\n');
	await writeOpfsText(
		page,
		`/${project}/feedback/playtests.json`,
		'{"version":1,"playtests":[]}\n'
	);
	await writeOpfsText(page, `/${project}/feedback/session/note.md`, '# Useful feedback\n');
	await writeBufferToOPFS(page, `/${project}/assets/token.png`, Buffer.from([0, 1, 2, 255]));
	await writeOpfsText(page, `/${project}/tts-export/run/result.json`, '{}\n');
	await writeOpfsText(page, `/${project}/components/cards/source.ods`, 'not a project file\n');
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games');
	await migrateProjectsIfPrompted(page);

	await page.goto(`/app/games/${project}`);
	await expect(page.getByText('Edit Board Game')).toBeVisible();

	await expect
		.poll(async () => JSON.parse(await readOpfsText(page, `/${project}/.automerge/config.json`)))
		.toMatchObject({ version: 2 });
	const expectedPaths = [
		'assets/token.png',
		'components/cards/back.svg',
		'components/cards/data.csv',
		'components/cards/front.svg',
		'feedback/playtests.json',
		'feedback/session/note.md',
		'game.json',
		'rules.md',
		'setup/table.svg'
	];
	await expect
		.poll(
			async () => {
				const config = JSON.parse(await readOpfsText(page, `/${project}/.automerge/config.json`));
				return Object.values(config.projections)
					.map((projection) => (projection as { path: string }).path)
					.sort();
			},
			{ timeout: 15_000 }
		)
		.toEqual(expectedPaths);
	const saved = JSON.parse(await readOpfsText(page, `/${project}/.automerge/config.json`));
	const rules = Object.entries(saved.projections).find(
		([, projection]) => (projection as { path: string }).path === 'rules.md'
	);
	expect(rules).toBeDefined();
	const [rulesId, originalRules] = rules!;
	await writeOpfsText(page, `/${project}/rules.md`, '# Externally updated rules\n');
	await expect
		.poll(async () => {
			const updated = JSON.parse(await readOpfsText(page, `/${project}/.automerge/config.json`))
				.projections[rulesId];
			return (
				updated.hash !== (originalRules as { hash: string }).hash &&
				updated.url === (originalRules as { url: string }).url
			);
		})
		.toBe(true);
	expect(await readOpfsText(page, `/${project}/rules.md`)).toBe('# Externally updated rules\n');

	const asset = Object.entries(saved.projections).find(
		([, projection]) => (projection as { path: string }).path === 'assets/token.png'
	);
	expect(asset).toBeDefined();
	const [assetId, originalAsset] = asset!;
	await writeBufferToOPFS(page, `/${project}/assets/token.png`, Buffer.from([9, 8, 7, 6, 5]));
	await expect
		.poll(async () => {
			const updated = JSON.parse(await readOpfsText(page, `/${project}/.automerge/config.json`))
				.projections[assetId];
			return updated.url;
		})
		.not.toBe((originalAsset as { url: string }).url);
	expect(await readOpfsBytes(page, `/${project}/assets/token.png`)).toEqual([9, 8, 7, 6, 5]);

	await writeOpfsText(page, `/${project}/components/tokens/front.svg`, '<svg id="tokens"></svg>\n');
	await expect
		.poll(async () => {
			const updated = JSON.parse(await readOpfsText(page, `/${project}/.automerge/config.json`));
			return Object.values(updated.projections).map(
				(projection) => (projection as { path: string }).path
			);
		})
		.toContain('components/tokens/front.svg');
	const rootUrl = JSON.parse(
		await readOpfsText(page, `/${project}/.automerge/config.json`)
	).rootUrl;
	await page.reload();
	await expect(page.getByText('Edit Board Game')).toBeVisible();
	expect(JSON.parse(await readOpfsText(page, `/${project}/.automerge/config.json`)).rootUrl).toBe(
		rootUrl
	);
});

test('creates a component through the Automerge project command', async ({ page }) => {
	const project = 'automerge-component-command';
	await openOpfsSeedPage(page);
	await writeOpfsText(
		page,
		`/${project}/game.json`,
		`${JSON.stringify({
			name: 'Automerge component command',
			minPlayers: 1,
			maxPlayers: 4,
			description: 'A project command fixture.',
			tags: []
		})}\n`
	);
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games');
	await migrateProjectsIfPrompted(page);
	await page.goto(`/app/games/${project}`);
	await expect(page.getByText('Edit Board Game')).toBeVisible();

	if (!(await page.getByRole('link', { name: 'command_cards', exact: true }).isVisible())) {
		await page.getByRole('button', { name: 'Decks' }).click();
	}
	await page.getByRole('button', { name: 'New' }).click();
	await page.getByPlaceholder('deck name').fill('command_cards');
	await page.getByRole('button', { name: 'Create new deck' }).click();

	await expect(page).toHaveURL(new RegExp(`/app/games/${project}/decks/command_cards/editor`));
	await expect
		.poll(async () => {
			const config = JSON.parse(await readOpfsText(page, `/${project}/.automerge/config.json`));
			return Object.values(config.projections).map(
				(projection) => (projection as { path: string }).path
			);
		})
		.toEqual(
			expect.arrayContaining([
				'components/command_cards/front.svg',
				'components/command_cards/back.svg'
			])
		);
	const created = JSON.parse(await readOpfsText(page, `/${project}/.automerge/config.json`));
	const memberIds = Object.entries(created.projections)
		.filter(([, projection]) =>
			(projection as { path: string }).path.startsWith('components/command_cards/')
		)
		.map(([id]) => id)
		.sort();

	if (!(await page.getByRole('link', { name: 'command_cards', exact: true }).isVisible())) {
		await page.getByRole('button', { name: 'Decks' }).click();
	}
	await page.getByRole('button', { name: 'More for command_cards' }).click();
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	await page.getByRole('textbox', { name: 'Deck name' }).fill('renamed_cards');
	await page.getByRole('button', { name: 'Rename deck' }).click();
	await expect(page).toHaveURL(new RegExp(`/app/games/${project}/decks/renamed_cards/editor`));
	await expect
		.poll(async () => {
			const renamed = JSON.parse(await readOpfsText(page, `/${project}/.automerge/config.json`));
			return Object.entries(renamed.projections)
				.filter(([, projection]) =>
					(projection as { path: string }).path.startsWith('components/renamed_cards/')
				)
				.map(([id]) => id)
				.sort();
		})
		.toEqual(memberIds);
});
