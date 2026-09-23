import { expect, test } from '@playwright/test';
import {
	migrateProjectsIfPrompted,
	opfsEntryExists,
	openOpfsSeedPage,
	readOpfsBytes,
	readOpfsText,
	saveOpfsStoragePreference,
	writeBufferToOPFS,
	writeOpfsText
} from './helpers/opfs';

test.setTimeout(60_000);

async function seedProject(
	page: import('@playwright/test').Page,
	project: string,
	files: Record<string, string> = {}
) {
	await openOpfsSeedPage(page);
	await writeOpfsText(
		page,
		`/${project}/game.json`,
		`${JSON.stringify({
			name: project,
			minPlayers: 1,
			maxPlayers: 4,
			description: 'Initial description',
			tags: []
		})}\n`
	);
	await writeOpfsText(page, `/${project}/rules.md`, '# Initial rules\n');
	for (const [path, content] of Object.entries(files)) {
		await writeOpfsText(page, `/${project}/${path}`, content);
	}
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games');
	await migrateProjectsIfPrompted(page);
	await page.goto(`/app/games/${project}`);
	await expect(page.getByText('Edit Board Game')).toBeVisible();
	await page.waitForTimeout(1_000);
}

async function expectCheckpoint(page: import('@playwright/test').Page, message: string) {
	await page.getByRole('button', { name: 'History', exact: true }).click();
	const history = page.getByRole('dialog', { name: / history$/ });
	const checkpoint = page.getByRole('group', { name: `Checkpoint ${message}`, exact: true });
	await expect(checkpoint).toBeVisible({ timeout: 10_000 });
	await history.getByRole('button', { name: 'Close' }).click();
	await expect(history).not.toBeVisible();
}

async function checkpointCount(page: import('@playwright/test').Page) {
	await page.getByRole('button', { name: 'History', exact: true }).click();
	const history = page.getByRole('dialog', { name: / history$/ });
	const count = await history.getByRole('group', { name: /^Checkpoint / }).count();
	await history.getByRole('button', { name: 'Close' }).click();
	await expect(history).not.toBeVisible();
	return count;
}

test('names automatic metadata checkpoints and groups continuous edits', async ({ page }) => {
	const project = 'checkpoint-metadata-titles';
	await seedProject(page, project);

	await page.getByLabel('Game Description').fill('Description only');
	await expectCheckpoint(page, 'Updated game description');

	const countBeforeTyping = await checkpointCount(page);
	const name = page.getByLabel('Game Name');
	await name.selectText();
	await name.pressSequentially('New Name', { delay: 25 });
	await expectCheckpoint(page, 'Renamed game to "New Name"');
	expect(await checkpointCount(page)).toBe(countBeforeTyping + 1);

	await page.getByLabel('Min').fill('2');
	await page.getByLabel('Game Description').fill('Players and description');
	await expectCheckpoint(page, 'Updated game details');

	await page.getByRole('button', { name: 'History', exact: true }).click();
	await expect(
		page.getByRole('group', { name: 'Checkpoint Initial project', exact: true })
	).toBeVisible();
	await expect(
		page.getByRole('group', { name: 'Checkpoint Renamed game to "New Name"', exact: true })
	).toHaveCount(1);
});

test('names member edits from exact checkpoint documents', async ({ page }) => {
	const project = 'checkpoint-member-titles';
	await seedProject(page, project, {
		'components/cards/front.svg':
			'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect id="card" width="100" height="100"/></svg>\n',
		'components/cards/back.svg':
			'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect id="back" width="100" height="100"/></svg>\n',
		'components/cards/data.csv': 'name,count\nCard,1\n',
		'setup/table.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>\n',
		'feedback/playtests.json': '[]\n',
		'feedback/session-one.md': '# Session one\n',
		'assets/token.png': 'initial token'
	});

	await writeOpfsText(page, `/${project}/rules.md`, '# Edited rules\n');
	await expectCheckpoint(page, 'Edited rules');

	await writeOpfsText(
		page,
		`/${project}/components/cards/front.svg`,
		'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle id="card" r="40"/></svg>\n'
	);
	await expectCheckpoint(page, 'Edited "cards" front layout');

	await writeOpfsText(
		page,
		`/${project}/components/cards/data.csv`,
		'name,count\nChanged card,2\n'
	);
	await expectCheckpoint(page, 'Edited "cards" spreadsheet');

	await writeOpfsText(
		page,
		`/${project}/setup/table.svg`,
		'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"></svg>\n'
	);
	await expectCheckpoint(page, 'Edited table setup');

	await writeOpfsText(page, `/${project}/feedback/playtests.json`, '[{"id":"one"}]\n');
	await expectCheckpoint(page, 'Updated playtests');

	await writeOpfsText(page, `/${project}/feedback/session-one.md`, '# Edited session\n');
	await expectCheckpoint(page, 'Edited playtest "session-one"');

	await writeBufferToOPFS(page, `/${project}/assets/token.png`, Buffer.from([9, 8, 7]));
	await expectCheckpoint(page, 'Replaced asset "token.png"');
});

test('names deck structure changes', async ({ page }) => {
	const project = 'checkpoint-deck-titles';
	await seedProject(page, project);

	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('button', { name: 'New' }).click();
	await page.getByPlaceholder('deck name').fill('tokens');
	await page.getByRole('button', { name: 'Create new deck' }).click();
	await expect(page).toHaveURL(new RegExp(`/app/games/${project}/decks/tokens/editor`));
	await expectCheckpoint(page, 'Added deck "tokens"');

	if (!(await page.getByRole('link', { name: 'tokens', exact: true }).isVisible())) {
		await page.getByRole('button', { name: 'Decks' }).click();
	}
	await page.getByRole('button', { name: 'More for tokens' }).click();
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	await page.getByRole('textbox', { name: 'Deck name' }).fill('pieces');
	await page.getByRole('button', { name: 'Rename deck' }).click();
	await expect(page).toHaveURL(new RegExp(`/app/games/${project}/decks/pieces/editor`));
	await expectCheckpoint(page, 'Renamed deck "tokens" to "pieces"');
});

test('summarizes three independent files changed in one quiet period', async ({ page }) => {
	const project = 'checkpoint-multiple-files';
	await seedProject(page, project, {
		'setup/table.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>\n'
	});

	await Promise.all([
		writeOpfsText(
			page,
			`/${project}/game.json`,
			`${JSON.stringify({
				name: project,
				minPlayers: 1,
				maxPlayers: 4,
				description: 'Changed with other files',
				tags: []
			})}\n`
		),
		writeOpfsText(page, `/${project}/rules.md`, '# Changed with other files\n'),
		writeOpfsText(
			page,
			`/${project}/setup/table.svg`,
			'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"></svg>\n'
		)
	]);
	await expectCheckpoint(page, 'Updated 3 files');
});

test('keeps branch edits isolated and opens complete historical checkpoints read-only', async ({
	page
}) => {
	const project = 'branch-checkpoints';
	await openOpfsSeedPage(page);
	await writeOpfsText(
		page,
		`/${project}/game.json`,
		`${JSON.stringify({
			name: 'Branch checkpoints',
			minPlayers: 1,
			maxPlayers: 4,
			description: 'Main description',
			tags: []
		})}\n`
	);
	await writeOpfsText(page, `/${project}/rules.md`, '# Original rules\n');
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games');
	await migrateProjectsIfPrompted(page);
	await page.goto(`/app/games/${project}`);
	await expect(page.getByText('Edit Board Game')).toBeVisible();

	await page.getByLabel('Game Name').fill('Branch checkpoints edited');
	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	await expect(page.getByRole('button', { name: 'Branch 1', exact: true })).toBeVisible();
	await expectCheckpoint(page, 'Fork Branch 1');

	const description = page.getByLabel('Game Description');
	await description.fill('Branch description');
	await expect(description).toHaveValue('Branch description');

	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Main', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Main', exact: true })).toBeVisible();
	await expect(page.getByLabel('Game Description')).toHaveValue('Main description');
	await expectCheckpoint(page, 'Branch point');

	await page.getByRole('button', { name: /^History/ }).click();
	const initial = page.getByRole('group', { name: 'Checkpoint Initial project', exact: true });
	await expect(initial).toBeVisible();
	await initial.getByRole('button', { name: 'View' }).click();
	await expect(page.getByText('Viewing historical checkpoint · Read only')).toBeVisible();
	await expect(page.getByLabel('Game Description')).toBeDisabled();
	await page.getByRole('link', { name: 'Rules', exact: true }).click();
	await expect(page).toHaveURL(/checkpoint=/);
	const rules = page.getByRole('textbox', { name: 'Game rules editor' });
	await expect(rules).toContainText('Original rules');
	await expect(rules).toHaveAttribute('aria-readonly', 'true');
});

test('merges a branch into its parent and checks the parent out', async ({ page }) => {
	const project = 'branch-merge';
	await openOpfsSeedPage(page);
	await writeOpfsText(
		page,
		`/${project}/game.json`,
		`${JSON.stringify({
			name: 'Branch merge',
			minPlayers: 1,
			maxPlayers: 4,
			description: 'Before merge',
			tags: []
		})}\n`
	);
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games');
	await migrateProjectsIfPrompted(page);
	await page.goto(`/app/games/${project}`);
	await expect(page.getByText('Edit Board Game')).toBeVisible();

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	await expect(page.getByRole('button', { name: 'Branch 1', exact: true })).toBeVisible();
	await page.getByLabel('Game Description').fill('After merge');

	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Merge into parent' }).click();
	const merge = page.getByRole('dialog', { name: 'Merge Branch 1 into Main' });
	await expect(merge.getByText('No conflicts require resolution.')).toBeVisible();
	const baseId = (await merge.getByText(/^Base /).textContent())!.replace('Base ', '');
	const targetId = (await merge.getByText(/^Parent /).textContent())!.replace('Parent ', '');
	const sourceId = (await merge.getByText(/^Branch /).textContent())!.replace('Branch ', '');
	await merge.getByRole('button', { name: 'Merge into Main' }).click();

	await expect(page.getByRole('button', { name: 'Main', exact: true })).toBeVisible();
	await expect(page.getByLabel('Game Description')).toHaveValue('After merge');
	await expectCheckpoint(page, 'Merge Branch 1');
	await page.getByRole('button', { name: 'History', exact: true }).click();
	const result = page.getByRole('group', { name: 'Checkpoint Merge Branch 1', exact: true });
	await expect(result).toContainText(`Base: ${baseId}`);
	await expect(result).toContainText(`Source: ${sourceId}`);
	await expect(result).toContainText(`Target: ${targetId}`);
	const resultText = (await result.textContent())!;
	const resultId = resultText.match(/Result: ([0-9a-f-]+)/)?.[1];
	expect(resultId).toBeTruthy();
	expect(resultId).not.toBe(targetId);
});

test('merges branch component structure with an independent parent metadata edit', async ({
	page
}) => {
	const project = 'branch-structural-merge';
	await seedProject(page, project);

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	await expect(page.getByRole('button', { name: 'Branch 1', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('button', { name: 'New' }).click();
	await page.getByPlaceholder('deck name').fill('cards');
	await page.getByRole('button', { name: 'Create new deck' }).click();
	await expect(page).toHaveURL(new RegExp(`/app/games/${project}/decks/cards/editor`));
	await page.getByRole('button', { name: 'More for cards' }).click();
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	await page.getByRole('textbox', { name: 'Deck name' }).fill('playing-cards');
	await page.getByRole('button', { name: 'Rename deck' }).click();
	await expect(page).toHaveURL(new RegExp(`/app/games/${project}/decks/playing-cards/editor`));

	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Main', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Main', exact: true })).toBeVisible();
	await page.goto(`/app/games/${project}`);
	await page.getByLabel('Game Description').fill('Edited independently on Main');

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Merge into parent' }).click();
	const merge = page.getByRole('dialog', { name: 'Merge Branch 1 into Main' });
	await expect(merge.getByRole('list', { name: 'Changes to merge' })).toContainText(
		'Add component playing-cards'
	);
	await expect(merge.getByText('No conflicts require resolution.')).toBeVisible();
	await merge.getByRole('button', { name: 'Merge into Main' }).click();

	await expect(page.getByRole('button', { name: 'Main', exact: true })).toBeVisible();
	await expect(page.getByLabel('Game Description')).toHaveValue('Edited independently on Main');
	await page.goto(`/app/games/${project}/decks/playing-cards/editor`);
	await expect(page.getByRole('toolbar', { name: 'Layout editor toolbar' })).toBeVisible();
});

test('keeps branch content through a parent rename and preserves the Base files', async ({
	page
}) => {
	test.setTimeout(90_000);
	const project = 'branch-rename-history';
	const originalAsset = 'original-asset-bytes';
	await seedProject(page, project, {
		'components/cards/front.svg':
			'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><image id="token-image" href="../../assets/token.png" width="20" height="20"/></svg>\n',
		'components/cards/back.svg':
			'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>\n',
		'assets/token.png': originalAsset
	});

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	await page.waitForTimeout(1_000);
	await writeOpfsText(
		page,
		`/${project}/components/cards/front.svg`,
		'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><image id="token-image" href="../../assets/token.png" width="20" height="20"/><circle data-branch-edit="yes" cx="50" cy="50" r="20"/></svg>\n'
	);
	await expectCheckpoint(page, 'Edited "cards" front layout');
	await writeBufferToOPFS(page, `/${project}/assets/token.png`, Buffer.from([9, 8, 7, 6]));
	await expectCheckpoint(page, 'Replaced asset "token.png"');

	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Main', exact: true }).click();
	await page.goto(`/app/games/${project}/decks/cards/editor`);
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('button', { name: 'More for cards' }).click();
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	await page.getByRole('textbox', { name: 'Deck name' }).fill('playing-cards');
	await page.getByRole('button', { name: 'Rename deck' }).click();
	await expect(page).toHaveURL(new RegExp(`/app/games/${project}/decks/playing-cards/editor`));

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Merge into parent' }).click();
	const merge = page.getByRole('dialog', { name: 'Merge Branch 1 into Main' });
	await expect(merge.getByText('No conflicts require resolution.')).toBeVisible();
	const baseId = (await merge.getByText(/^Base /).textContent())!.replace('Base ', '');
	await merge.getByRole('button', { name: 'Merge into Main' }).click();

	await expect(page.getByRole('button', { name: 'Main', exact: true })).toBeVisible();
	const mergedFront = `/${project}/components/playing-cards/front.svg`;
	await expect.poll(() => opfsEntryExists(page, mergedFront)).toBe(true);
	expect(await readOpfsText(page, mergedFront)).toContain('data-branch-edit="yes"');
	await page.goto(`/app/games/${project}/decks/cards/editor?checkpoint=${baseId}`);
	await expect(page.getByText('Viewing historical checkpoint · Read only')).toBeVisible();
	await expect(page.getByRole('toolbar', { name: 'Layout editor toolbar' })).toBeVisible();
	const historicalAsset = await page.locator('#svgcanvas #token-image').evaluate(async (image) => {
		const href = image.getAttribute('href');
		if (!href) throw new Error('The historical asset URL is unavailable.');
		return Array.from(new Uint8Array(await (await fetch(href)).arrayBuffer()));
	});
	expect(historicalAsset).toEqual([...new TextEncoder().encode(originalAsset)]);
});

test('previews delete-modify conflicts and keeps the parent component', async ({ page }) => {
	const project = 'branch-delete-modify';
	await seedProject(page, project, {
		'components/cards/front.svg':
			'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>\n',
		'components/cards/back.svg':
			'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>\n',
		'components/cards/data.csv': 'name,count\nCard,1\n'
	});

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	await page.waitForTimeout(1_000);
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('button', { name: 'More for cards' }).click();
	await page.getByRole('menuitem', { name: 'Delete' }).click();
	await expect(page).toHaveURL(new RegExp(`/app/games/${project}$`));

	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Main', exact: true }).click();
	await page.waitForTimeout(1_000);
	await writeOpfsText(
		page,
		`/${project}/components/cards/front.svg`,
		'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>\n'
	);
	await expectCheckpoint(page, 'Edited "cards" front layout');

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Merge into parent' }).click();
	const merge = page.getByRole('dialog', { name: 'Merge Branch 1 into Main' });
	await expect(
		merge.getByRole('group', { name: /was deleted and modified/ }).first()
	).toBeVisible();
	const conflicts = merge.getByRole('group', { name: /was deleted and modified/ });
	for (let index = 0; index < (await conflicts.count()); index++) {
		await conflicts.nth(index).getByRole('radio', { name: 'Keep Parent' }).check();
	}
	await merge.getByRole('button', { name: 'Merge into Main' }).click();

	await expect(page.getByRole('button', { name: 'Main', exact: true })).toBeVisible();
	await page.goto(`/app/games/${project}/decks/cards/editor`);
	await expect(page.getByRole('toolbar', { name: 'Layout editor toolbar' })).toBeVisible();
});

test('applies a one-sided member deletion without a conflict', async ({ page }) => {
	const project = 'branch-member-delete';
	await seedProject(page, project, {
		'components/cards/front.svg':
			'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>\n',
		'components/cards/back.svg':
			'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>\n'
	});

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	await page.waitForTimeout(1_000);
	await page.evaluate(async (projectName) => {
		const root = await (
			navigator.storage as StorageManager & {
				getDirectory: () => Promise<FileSystemDirectoryHandle>;
			}
		).getDirectory();
		const projectDir = await root.getDirectoryHandle(projectName);
		const components = await projectDir.getDirectoryHandle('components');
		const cards = await components.getDirectoryHandle('cards');
		await cards.removeEntry('back.svg');
	}, project);
	await expectCheckpoint(page, 'Updated project structure');

	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Merge into parent' }).click();
	const merge = page.getByRole('dialog', { name: 'Merge Branch 1 into Main' });
	await expect(merge.getByRole('list', { name: 'Changes to merge' })).toContainText(
		'Delete components/cards/back.svg'
	);
	await expect(merge.getByText('No conflicts require resolution.')).toBeVisible();
	await merge.getByRole('button', { name: 'Merge into Main' }).click();

	await page.goto(`/app/games/${project}/decks/cards/editor`);
	await expect(page.getByRole('toolbar', { name: 'Layout editor toolbar' })).toBeVisible();
	await expect
		.poll(() => opfsEntryExists(page, `/${project}/components/cards/back.svg`))
		.toBe(false);
});

test('merges a branch asset replacement with an unrelated parent edit', async ({ page }) => {
	const project = 'branch-asset-merge';
	await seedProject(page, project, { 'assets/token.png': 'original' });

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	await page.waitForTimeout(1_000);
	await writeBufferToOPFS(page, `/${project}/assets/token.png`, Buffer.from([1, 2, 3, 4]));
	await expectCheckpoint(page, 'Replaced asset "token.png"');

	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Main', exact: true }).click();
	await page.goto(`/app/games/${project}`);
	await page.getByLabel('Game Description').fill('Parent metadata edit');

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Merge into parent' }).click();
	const merge = page.getByRole('dialog', { name: 'Merge Branch 1 into Main' });
	await expect(merge.getByRole('list', { name: 'Changes to merge' })).toContainText(
		'Replace assets/token.png'
	);
	await expect(merge.getByText('No conflicts require resolution.')).toBeVisible();
	await merge.getByRole('button', { name: 'Merge into Main' }).click();

	await expect(page.getByLabel('Game Description')).toHaveValue('Parent metadata edit');
	await expect
		.poll(() => readOpfsBytes(page, `/${project}/assets/token.png`))
		.toEqual([1, 2, 3, 4]);
});

test('previews different asset replacements and applies the selected branch bytes', async ({
	page
}) => {
	const project = 'branch-asset-conflict';
	await seedProject(page, project, { 'assets/token.png': 'original' });

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	await page.waitForTimeout(1_000);
	await writeBufferToOPFS(page, `/${project}/assets/token.png`, Buffer.from([1, 2, 3]));
	await expectCheckpoint(page, 'Replaced asset "token.png"');

	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Main', exact: true }).click();
	await page.waitForTimeout(1_000);
	await writeBufferToOPFS(page, `/${project}/assets/token.png`, Buffer.from([9, 8, 7, 6]));
	await expectCheckpoint(page, 'Replaced asset "token.png"');

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Merge into parent' }).click();
	const merge = page.getByRole('dialog', { name: 'Merge Branch 1 into Main' });
	const conflict = merge.getByRole('group', { name: /token\.png has different replacements/ });
	await expect(conflict.getByText('3 bytes')).toBeVisible();
	await expect(conflict.getByText('4 bytes')).toBeVisible();
	await conflict.getByRole('radio', { name: 'Use Branch' }).check();
	await merge.getByRole('button', { name: 'Merge into Main' }).click();

	await expect.poll(() => readOpfsBytes(page, `/${project}/assets/token.png`)).toEqual([1, 2, 3]);
});

test('merges identical asset replacements without a conflict', async ({ page }) => {
	const project = 'branch-identical-asset';
	const replacement = Buffer.from([4, 3, 2, 1]);
	await seedProject(page, project, { 'assets/token.png': 'original' });

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	await page.waitForTimeout(1_000);
	await writeBufferToOPFS(page, `/${project}/assets/token.png`, replacement);
	await expectCheckpoint(page, 'Replaced asset "token.png"');

	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Main', exact: true }).click();
	await page.waitForTimeout(1_000);
	await writeBufferToOPFS(page, `/${project}/assets/token.png`, replacement);
	await expectCheckpoint(page, 'Replaced asset "token.png"');

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Merge into parent' }).click();
	const merge = page.getByRole('dialog', { name: 'Merge Branch 1 into Main' });
	await expect(merge.getByText('No conflicts require resolution.')).toBeVisible();
	await merge.getByRole('button', { name: 'Merge into Main' }).click();

	await expect
		.poll(() => readOpfsBytes(page, `/${project}/assets/token.png`))
		.toEqual([...replacement]);
});

test('keeps a nested branch Base when its parent is merged and reparented', async ({ page }) => {
	const project = 'nested-branch-base';
	await seedProject(page, project);

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	page.once('dialog', (dialog) => dialog.accept('Parent branch'));
	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Rename branch' }).click();
	await expect(page.getByRole('button', { name: 'Parent branch', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Parent branch', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	page.once('dialog', (dialog) => dialog.accept('Child branch'));
	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Rename branch' }).click();
	await expect(page.getByRole('button', { name: 'Child branch', exact: true })).toBeVisible();
	await page.getByLabel('Game Description').fill('Nested child edit');

	await page.getByRole('button', { name: 'Child branch', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Merge into parent' }).click();
	let merge = page.getByRole('dialog', { name: 'Merge Child branch into Parent branch' });
	const originalBaseId = (await merge.getByText(/^Base /).textContent())!.replace('Base ', '');
	await merge.getByRole('button', { name: 'Cancel' }).click();

	await page.getByRole('button', { name: 'Child branch', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Parent branch', exact: true }).click();
	await page.getByRole('button', { name: 'Parent branch', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Merge into parent' }).click();
	merge = page.getByRole('dialog', { name: 'Merge Parent branch into Main' });
	await expect(merge.getByText('No conflicts require resolution.')).toBeVisible();
	await merge.getByRole('button', { name: 'Merge into Main' }).click();

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Child branch', exact: true }).click();
	await page.getByRole('button', { name: 'Child branch', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Merge into parent' }).click();
	merge = page.getByRole('dialog', { name: 'Merge Child branch into Main' });
	await expect(merge.getByText(`Base ${originalBaseId}`, { exact: true })).toBeVisible();
	await merge.getByRole('button', { name: 'Merge into Main' }).click();

	await page.goto(`/app/games/${project}`);
	await expect(page.getByLabel('Game Description')).toHaveValue('Nested child edit');
});

test('resumes one merge across every durable journal boundary', async ({ page }) => {
	test.setTimeout(120_000);
	const project = 'branch-merge-recovery';
	const progress = [
		'journal:prepared',
		'members:flushed',
		'journal:members-applied',
		'root:flushed',
		'journal:root-published',
		'checkpoint:flushed',
		'journal:checkpoint-recorded',
		'history:flushed',
		'journal:history-finalized'
	];
	await page.addInitScript((points) => {
		(
			window as typeof window & {
				__DIGITABLE_E2E_MERGE_PROGRESS__?: (progress: string) => Promise<void>;
			}
		).__DIGITABLE_E2E_MERGE_PROGRESS__ = async (point) => {
			const seen = JSON.parse(sessionStorage.getItem('merge-progress') ?? '[]') as string[];
			const next = points.find((candidate) => !seen.includes(candidate));
			if (point !== next) return;
			sessionStorage.setItem('merge-progress', JSON.stringify([...seen, point]));
			await new Promise<void>(() => undefined);
		};
	}, progress);
	await seedProject(page, project);

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	await page.getByLabel('Game Description').fill('Recovered branch description');
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('button', { name: 'New' }).click();
	await page.getByPlaceholder('deck name').fill('cards');
	await page.getByRole('button', { name: 'Create new deck' }).click();
	await expect(page).toHaveURL(new RegExp(`/app/games/${project}/decks/cards/editor`));
	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Merge into parent' }).click();
	const merge = page.getByRole('dialog', { name: 'Merge Branch 1 into Main' });
	await expect(merge.getByText('No conflicts require resolution.')).toBeVisible();
	await merge.getByRole('button', { name: 'Merge into Main' }).click();

	for (const point of progress) {
		await expect
			.poll(() =>
				page.evaluate(() => {
					const seen = JSON.parse(sessionStorage.getItem('merge-progress') ?? '[]') as string[];
					return seen.at(-1);
				})
			)
			.toBe(point);
		await page.reload();
	}

	await expect(page.getByRole('button', { name: 'Main', exact: true })).toBeVisible();
	await page.goto(`/app/games/${project}`);
	await expect(page.getByLabel('Game Description')).toHaveValue('Recovered branch description');
	await page.goto(`/app/games/${project}/decks/cards/editor`);
	await expect(page.getByRole('toolbar', { name: 'Layout editor toolbar' })).toBeVisible();
	expect(await opfsEntryExists(page, `/${project}/.automerge/pending-branch-operation.json`)).toBe(
		false
	);
	await page.getByRole('button', { name: 'History', exact: true }).click();
	await expect(
		page.getByRole('group', { name: 'Checkpoint Merge Branch 1', exact: true })
	).toHaveCount(1);
});

test('renames colliding additions and converges both tabs on the merged structure', async ({
	context,
	page
}) => {
	test.setTimeout(90_000);
	const project = 'branch-collision-merge';
	await seedProject(page, project);

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('button', { name: 'New' }).click();
	await page.getByPlaceholder('deck name').fill('cards');
	await page.getByRole('button', { name: 'Create new deck' }).click();
	await expect(page).toHaveURL(new RegExp(`/app/games/${project}/decks/cards/editor`));

	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Main', exact: true }).click();
	await page.goto(`/app/games/${project}`);
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('button', { name: 'New' }).click();
	await page.getByPlaceholder('deck name').fill('cards');
	await page.getByRole('button', { name: 'Create new deck' }).click();
	await expect(page).toHaveURL(new RegExp(`/app/games/${project}/decks/cards/editor`));

	const peer = await context.newPage();
	await peer.goto(`/app/games/${project}`);
	await expect(peer.getByRole('button', { name: 'Main', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Branch 1', exact: true }).click();
	await expect(peer.getByRole('button', { name: 'Branch 1', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Merge into parent' }).click();
	const merge = page.getByRole('dialog', { name: 'Merge Branch 1 into Main' });
	for (const [label, path] of [
		['Multiple members use components/cards/front.svg', 'components/branch-cards/front.svg'],
		['Multiple members use components/cards/back.svg', 'components/branch-cards/back.svg']
	] as const) {
		const conflict = merge.getByRole('group', { name: label, exact: true });
		await expect(conflict).toBeVisible();
		await conflict.getByRole('radio', { name: 'Rename' }).check();
		await conflict.getByLabel('New branch path').fill(path);
	}
	const asset = merge.getByRole('group', {
		name: 'Multiple members use assets/placeholder.svg',
		exact: true
	});
	await asset.getByRole('radio', { name: 'Keep Parent' }).check();
	const component = merge.getByRole('group', {
		name: 'Multiple components are named cards',
		exact: true
	});
	await component.getByRole('radio', { name: 'Rename' }).check();
	await component.getByLabel('New component name').fill('branch-cards');
	await merge.getByRole('button', { name: 'Merge into Main' }).click();

	await expect(page.getByRole('button', { name: 'Main', exact: true })).toBeVisible();
	await expect(peer.getByRole('button', { name: 'Main', exact: true })).toBeVisible();
	for (const current of [page, peer]) {
		await current.goto(`/app/games/${project}/decks/cards/editor`);
		await expect(current.getByRole('toolbar', { name: 'Layout editor toolbar' })).toBeVisible();
		await current.goto(`/app/games/${project}/decks/branch-cards/editor`);
		await expect(current.getByRole('toolbar', { name: 'Layout editor toolbar' })).toBeVisible();
	}
});

test('uses one project-global checkout across tabs', async ({ context, page }) => {
	const project = 'branch-multi-tab';
	await openOpfsSeedPage(page);
	await writeOpfsText(
		page,
		`/${project}/game.json`,
		`${JSON.stringify({
			name: 'Branch multi tab',
			minPlayers: 1,
			maxPlayers: 4,
			description: 'Shared main',
			tags: []
		})}\n`
	);
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games');
	await migrateProjectsIfPrompted(page);
	await page.goto(`/app/games/${project}`);
	await expect(page.getByText('Edit Board Game')).toBeVisible();

	const peer = await context.newPage();
	await peer.goto(`/app/games/${project}`);
	await expect(peer.getByText('Edit Board Game')).toBeVisible();

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	await expect(page.getByRole('button', { name: 'Branch 1', exact: true })).toBeVisible();
	await expect(peer.getByRole('button', { name: 'Branch 1', exact: true })).toBeVisible();

	await page.getByLabel('Game Description').fill('Shared branch');
	await expect(peer.getByLabel('Game Description')).toHaveValue('Shared branch');

	await peer.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await peer.getByRole('menuitem', { name: 'Main', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Main', exact: true })).toBeVisible();
	await expect(peer.getByText('Edit Board Game')).toBeVisible();
	await expect(peer.getByLabel('Game Description')).toHaveValue('Shared main');
});

test('forks a writable branch from a historical project checkpoint', async ({ page }) => {
	const project = 'branch-from-history';
	await openOpfsSeedPage(page);
	await writeOpfsText(
		page,
		`/${project}/game.json`,
		`${JSON.stringify({
			name: 'Branch from history',
			minPlayers: 1,
			maxPlayers: 4,
			description: 'Historical value',
			tags: []
		})}\n`
	);
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games');
	await migrateProjectsIfPrompted(page);
	await page.goto(`/app/games/${project}`);
	await expect(page.getByText('Edit Board Game')).toBeVisible();

	await page.getByLabel('Game Description').fill('Latest value');
	await page.waitForTimeout(1_000);
	await page.getByRole('button', { name: 'History', exact: true }).click();
	const latest = page.getByRole('group', { name: 'Checkpoint Updated game description' }).first();
	await expect(latest).toBeVisible();
	await latest.getByRole('button', { name: 'View' }).click();
	await expect(page.getByText('Viewing historical checkpoint · Read only')).toBeVisible();
	await page.getByRole('button', { name: /^History/ }).click();
	const initial = page.getByRole('group', { name: 'Checkpoint Initial project' });
	await expect(initial).toBeVisible();
	await initial.getByRole('button', { name: 'Compare from here' }).click();
	await expect(page.getByText(/changed files?\./)).toBeVisible();
	await expect(page.getByRole('listitem').filter({ hasText: 'game.json' })).toBeVisible();
	await initial.getByRole('button', { name: 'Branch from here' }).click();

	await expect(page.getByRole('button', { name: 'Branch 1', exact: true })).toBeVisible();
	await expect(page.getByLabel('Game Description')).toHaveValue('Historical value');
	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Main', exact: true }).click();
	await expect(page.getByLabel('Game Description')).toHaveValue('Latest value');
});
