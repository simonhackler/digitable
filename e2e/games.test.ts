import { expect, test, type Page } from '@playwright/test';
import {
	opfsEntryExists,
	readOpfsText,
	saveOpfsStoragePreference,
	seedProjects,
	writeOpfsText
} from './helpers/opfs';

test.describe.configure({ mode: 'serial' });

async function showDeckInSidebar(page: Page, deckName: string) {
	const deckLink = page.getByRole('link', { name: deckName, exact: true });
	if (!(await deckLink.isVisible())) {
		await page.getByRole('button', { name: 'Decks' }).click();
	}
	await expect(deckLink).toBeVisible();
}

test('create new game and delete it', async ({ page }) => {
	const gameName = 'Create Game Test';
	const gameDescription = 'A quick test game description that is long enough for validation.';

	await seedProjects(page);

	await page.getByRole('button', { name: 'Create Game' }).first().click();
	await page.getByRole('textbox', { name: 'Gamename' }).fill(gameName);
	await page.getByRole('button', { name: 'Create', exact: true }).click();

	await expect(page).toHaveURL(/\/app\/games\/Create_Game_Test/);
	await expect(page.getByText('Create New Board Game')).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Game Name' })).toHaveValue(gameName);

	await page.getByRole('textbox', { name: 'Game Description' }).fill(gameDescription);
	await page.getByRole('button', { name: 'Fantasy', exact: true }).click();
	await page.getByRole('main').getByRole('button', { name: 'Create', exact: true }).click();

	await expect(page.getByText('Game created successfully!')).toBeVisible();
	await page.reload();
	await expect(page).toHaveURL(/\/app\/games\/Create_Game_Test/);
	await expect(page.getByText('Edit Board Game')).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Game Name' })).toHaveValue(gameName);
	await expect(page.getByRole('textbox', { name: 'Game Description' })).toHaveValue(
		gameDescription
	);
	await expect(page.getByRole('button', { name: 'Fantasy', exact: true })).toBeDisabled();
	await page.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('textbox', { name: 'Enter "Create Game Test" to' }).fill(gameName);
	await page.getByRole('button', { name: 'Delete' }).nth(1).click();
	await expect(page).toHaveURL(/\/app\/games$/);
	await page.waitForTimeout(1000);
});

test('created game appears in the games overview and can create a deck', async ({ page }) => {
	const gameName = 'Overview Create Test';
	const folderName = 'Overview_Create_Test';
	const deckName = 'new_game_deck';
	const gameDescription = 'A created game should appear on the overview immediately after saving.';
	const secondGameName = 'Second Overview Test';
	const secondFolderName = 'Second_Overview_Test';
	const secondGameDescription =
		'A second created game should also appear on the overview after saving.';

	await seedProjects(page);

	await page.getByRole('button', { name: 'Create Game' }).first().click();
	await page.getByRole('textbox', { name: 'Gamename' }).fill(gameName);
	await page.getByRole('button', { name: 'Create', exact: true }).click();

	await expect(page).toHaveURL(new RegExp(`/app/games/${folderName}`));
	await page.getByRole('textbox', { name: 'Game Description' }).fill(gameDescription);
	await page.getByRole('button', { name: 'Strategy', exact: true }).click();
	await page.getByRole('main').getByRole('button', { name: 'Create', exact: true }).click();
	await expect(page.getByText('Game created successfully!')).toBeVisible();

	await page.goto('/app/games');
	await expect(page.getByRole('main').getByText(folderName)).toBeVisible();

	await page.getByRole('main').getByText(folderName).click();
	await expect(page).toHaveURL(new RegExp(`/app/games/${folderName}`));
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('button', { name: 'New' }).click();
	await page.getByPlaceholder('deck name').fill(deckName);
	await expect(page.getByRole('button', { name: 'Create new deck' })).toBeEnabled();
	await page.getByRole('button', { name: 'Create new deck' }).click();

	await expect(page).toHaveURL(new RegExp(`/app/games/${folderName}/decks/${deckName}/editor`));
	await expect(page.getByRole('link', { name: deckName, exact: true })).toBeVisible();

	await page.goto('/app/games');
	await page.getByRole('button', { name: 'Create Game' }).first().click();
	await page.getByRole('textbox', { name: 'Gamename' }).fill(secondGameName);
	await page.getByRole('button', { name: 'Create', exact: true }).click();

	await expect(page).toHaveURL(new RegExp(`/app/games/${secondFolderName}`));
	await page.getByRole('textbox', { name: 'Game Description' }).fill(secondGameDescription);
	await page.getByRole('button', { name: 'Strategy', exact: true }).click();
	await page.getByRole('main').getByRole('button', { name: 'Create', exact: true }).click();
	await expect(page.getByText('Game created successfully!')).toBeVisible();

	await page.goto('/app/games');
	await expect(page.getByRole('main').getByText(secondFolderName)).toBeVisible();
});

test('migrates legacy projects and stores the workspace digitable version', async ({ page }) => {
	await page.goto('/app/games');
	await page.setContent('<!doctype html><html><body><h1>Workspace seed</h1></body></html>');
	await writeOpfsText(
		page,
		'/.digitable.json',
		JSON.stringify({
			schemaVersion: 1,
			lastOpenedAppVersion: 'test-version',
			updatedAt: '2026-05-16T12:00:00.000Z'
		})
	);
	await writeOpfsText(
		page,
		'/legacy-game/game.json',
		JSON.stringify({
			name: 'Legacy Game',
			minPlayers: 1,
			maxPlayers: 4,
			description: 'A legacy project that needs the layout migration.',
			tags: ['E2E']
		})
	);
	await writeOpfsText(
		page,
		'/legacy-game/system/cards/front.svg',
		'<svg xmlns="http://www.w3.org/2000/svg"><image href="../../files/card.png"/><image href="/files/card.png"/></svg>'
	);
	await writeOpfsText(
		page,
		'/legacy-game/system/cards/data.csv',
		'image\nfiles/card.png\n../../files/card.png\n/files/card.png\n'
	);
	await writeOpfsText(page, '/legacy-game/files/card.png', 'image-bytes');
	await saveOpfsStoragePreference(page);

	await page.goto('/app/games');
	await expect(page.getByRole('heading', { name: 'Migrate Projects' })).toBeVisible();
	await page.getByRole('button', { name: 'Migrate projects' }).click();

	await expect(page.getByRole('heading', { name: 'Board Games' })).toBeVisible();
	await expect(page.getByRole('main').getByText('legacy-game')).toBeVisible();
	await expect(await opfsEntryExists(page, '/legacy-game/components/cards/front.svg')).toBe(true);
	await expect(await opfsEntryExists(page, '/legacy-game/assets/card.png')).toBe(true);
	await expect(await readOpfsText(page, '/legacy-game/components/cards/front.svg')).toContain(
		'../../assets/card.png'
	);
	await expect(await readOpfsText(page, '/legacy-game/components/cards/data.csv')).toContain(
		'assets/card.png'
	);
	await expect(JSON.parse(await readOpfsText(page, '/.digitable.json'))).toMatchObject({
		digitableVersion: '0.0.1'
	});
});

test('create new deck and delete it', async ({ page }) => {
	const deckName = 'e2e_deck';

	await seedProjects(page);

	await page.getByRole('main').getByText('western-cards').click();
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('button', { name: 'New' }).click();

	await expect(page.getByRole('img', { name: 'Portrait card preview' })).toBeVisible();
	await page.getByPlaceholder('deck name').fill(deckName);
	await page.getByRole('button', { name: 'Create new deck' }).click();

	await expect(page).toHaveURL(new RegExp(`/app/games/western-cards/decks/${deckName}/editor`));
	await expect(page.getByRole('link', { name: deckName, exact: true })).toBeVisible();
	await page.reload();
	await expect(page).toHaveURL(new RegExp(`/app/games/western-cards/decks/${deckName}/editor`));
	await page.getByRole('button', { name: 'Decks' }).click();
	await expect(page.getByRole('link', { name: deckName, exact: true })).toBeVisible();
	await page.getByRole('button', { name: `More for ${deckName}` }).click();
	await page.getByRole('menuitem', { name: 'Delete' }).click();
	await expect(page.getByRole('link', { name: deckName, exact: true })).not.toBeVisible();
	await expect(page).toHaveURL(new RegExp(`/app/games/western-cards$`));
});

test('rename deck preserves files, validates names, and persists after reload', async ({
	page
}) => {
	const originalDeckName = 'rename_source_deck';
	const renamedDeckName = 'rename_target_deck';
	const dataCsv = 'name,count\nScout,3\n';

	await seedProjects(page);

	await page.getByRole('main').getByText('western-cards').click();
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('button', { name: 'New' }).click();
	await page.getByPlaceholder('deck name').fill(originalDeckName);
	await page.getByRole('button', { name: 'Create new deck' }).click();

	await expect(page).toHaveURL(
		new RegExp(`/app/games/western-cards/decks/${originalDeckName}/editor`)
	);
	await writeOpfsText(page, `/western-cards/components/${originalDeckName}/data.csv`, dataCsv);

	await page.goto('/app/games/western-cards');
	await showDeckInSidebar(page, originalDeckName);
	await page.getByRole('link', { name: originalDeckName, exact: true }).click();
	await expect(page).toHaveURL(
		new RegExp(`/app/games/western-cards/decks/${originalDeckName}/editor`)
	);
	await showDeckInSidebar(page, originalDeckName);
	await page.getByRole('button', { name: `More for ${originalDeckName}` }).click();
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	await page.getByRole('textbox', { name: 'Deck name' }).fill('bad deck');
	await page.getByRole('button', { name: 'Rename deck' }).click();
	await expect(page.getByRole('alert')).toContainText('letters, numbers, underscores, and hyphens');
	await expect(page.getByRole('link', { name: originalDeckName, exact: true })).toBeVisible();

	await page.getByRole('textbox', { name: 'Deck name' }).fill('western');
	await page.getByRole('button', { name: 'Rename deck' }).click();
	await expect(page.getByRole('alert')).toContainText('already exists');
	await expect(page.getByRole('link', { name: originalDeckName, exact: true })).toBeVisible();

	await page.getByRole('textbox', { name: 'Deck name' }).fill(renamedDeckName);
	await page.getByRole('button', { name: 'Rename deck' }).click();

	await expect(page).toHaveURL(
		new RegExp(`/app/games/western-cards/decks/${renamedDeckName}/editor`)
	);
	await expect(page.getByRole('link', { name: renamedDeckName, exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: originalDeckName, exact: true })).not.toBeVisible();
	await expect(await opfsEntryExists(page, `/western-cards/components/${originalDeckName}`)).toBe(
		false
	);
	await expect(
		await readOpfsText(page, `/western-cards/components/${renamedDeckName}/data.csv`)
	).toBe(dataCsv);
	await expect(
		await opfsEntryExists(page, `/western-cards/components/${renamedDeckName}/front.svg`)
	).toBe(true);
	await expect(
		await opfsEntryExists(page, `/western-cards/components/${renamedDeckName}/back.svg`)
	).toBe(true);

	await page.reload();
	await expect(page).toHaveURL(
		new RegExp(`/app/games/western-cards/decks/${renamedDeckName}/editor`)
	);
	await page.getByRole('button', { name: 'Decks' }).click();
	await expect(page.getByRole('link', { name: renamedDeckName, exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: originalDeckName, exact: true })).not.toBeVisible();
});

test('create new game from project switcher', async ({ page }) => {
	const gameName = 'Switcher Create Test';
	const folderName = 'Switcher_Create_Test';
	const gameDescription = 'A game created from the project switcher keeps the creator on metadata.';

	await seedProjects(page);
	await page.getByRole('main').getByText('western-cards').click();

	await page.getByRole('button', { name: /western-cards/ }).click();
	await page.getByRole('menuitem', { name: 'New Game' }).click();
	await page.getByRole('textbox', { name: 'Gamename' }).fill(gameName);
	await page.getByRole('button', { name: 'Create', exact: true }).click();

	await expect(page).toHaveURL(new RegExp(`/app/games/${folderName}`));
	await expect(page.getByText('Create New Board Game')).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Game Name' })).toHaveValue(gameName);

	await page.getByRole('textbox', { name: 'Game Description' }).fill(gameDescription);
	await page.getByRole('button', { name: 'Strategy', exact: true }).click();
	await page.getByRole('main').getByRole('button', { name: 'Create', exact: true }).click();
	await expect(page.getByText('Game created successfully!')).toBeVisible();

	await page.goto('/app/games');
	await expect(page.getByRole('main').getByText(folderName)).toBeVisible();
});

test('layout route no longer renders the layout editor', async ({ page }) => {
	await seedProjects(page);

	const response = await page.goto('/app/games/western-cards/decks/western/layout');
	expect(response?.status()).toBe(404);
	await expect(page.getByRole('button', { name: 'Upload' })).not.toBeVisible();
});
