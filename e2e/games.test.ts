import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { opfsEntryExists, readOpfsText, seedProjects, writeOpfsText } from './helpers/opfs';

test.describe.configure({ mode: 'serial' });

let gamesContext: BrowserContext | null = null;

async function withGamesPage(run: (page: Page) => Promise<void>) {
	if (!gamesContext) throw new Error('Games context was not initialized');
	const page = await gamesContext.newPage();
	try {
		await page.goto('/app/games');
		await run(page);
	} finally {
		await page.close();
	}
}

function gamesTest(name: string, run: (page: Page) => Promise<void>) {
	test(name, async () => {
		await withGamesPage(run);
	});
}

async function showDeckInSidebar(page: Page, deckName: string) {
	const deckLink = page.getByRole('link', { name: deckName, exact: true });
	if (!(await deckLink.isVisible())) {
		await page.getByRole('button', { name: 'Decks' }).click();
	}
	await expect(deckLink).toBeVisible();
}

test.beforeAll(async ({ browser }, testInfo) => {
	gamesContext = await browser.newContext({
		baseURL: testInfo.project.use.baseURL as string | undefined
	});
	const page = await gamesContext.newPage();
	try {
		await seedProjects(page);
	} finally {
		await page.close();
	}
});

test.afterAll(async () => {
	await gamesContext?.close();
	gamesContext = null;
});

gamesTest('create new game and delete it', async (page) => {
	const gameName = 'Create Game Test';
	const gameDescription = 'A quick test game description that is long enough for validation.';

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

gamesTest('created game appears in the games overview and can create a deck', async (page) => {
	const gameName = 'Overview Create Test';
	const folderName = 'Overview_Create_Test';
	const deckName = 'new_game_deck';
	const gameDescription = 'A created game should appear on the overview immediately after saving.';
	const secondGameName = 'Second Overview Test';
	const secondFolderName = 'Second_Overview_Test';
	const secondGameDescription =
		'A second created game should also appear on the overview after saving.';

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

gamesTest('create new deck and delete it', async (page) => {
	const deckName = 'e2e_deck';

	await page.getByRole('main').getByText('western-cards').click();
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('button', { name: 'New' }).click();

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

gamesTest(
	'rename deck preserves files, validates names, and persists after reload',
	async (page) => {
		const originalDeckName = 'rename_source_deck';
		const renamedDeckName = 'rename_target_deck';
		const dataCsv = 'name,count\nScout,3\n';

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
		await expect(page.getByRole('alert')).toContainText(
			'letters, numbers, underscores, and hyphens'
		);
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
	}
);

gamesTest('create new game from project switcher', async (page) => {
	const gameName = 'Switcher Create Test';
	const folderName = 'Switcher_Create_Test';
	const gameDescription = 'A game created from the project switcher keeps the creator on metadata.';

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

gamesTest('layout route no longer renders the layout editor', async (page) => {
	const response = await page.goto('/app/games/western-cards/decks/western/layout');
	expect(response?.status()).toBe(404);
	await expect(page.getByRole('button', { name: 'Upload' })).not.toBeVisible();
});
