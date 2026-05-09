import { expect, test } from '@playwright/test';
import * as path from 'node:path';
import { fullOpfsSeed } from './helpers/opfs';

test.describe.configure({ mode: 'parallel' });

test('create new game and delete it', async ({ page }) => {
	const here = path.dirname(test.info().file); // absolute dir of THIS test file
	const projectsDir = path.resolve(here, '../projects');
	const gameName = 'Create Game Test';
	const gameDescription = 'A quick test game description that is long enough for validation.';

	await page.goto('/app/games');
	await fullOpfsSeed(page, projectsDir);

	await page.getByRole('button', { name: 'Use Browser' }).first().click();
	await page.getByRole('button', { name: 'Use Browser storage' }).click();
	await expect(page.getByRole('heading', { name: 'Board Games' })).toBeVisible();

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
	const here = path.dirname(test.info().file); // absolute dir of THIS test file
	const projectsDir = path.resolve(here, '../projects');
	const gameName = 'Overview Create Test';
	const folderName = 'Overview_Create_Test';
	const deckName = 'new_game_deck';
	const gameDescription = 'A created game should appear on the overview immediately after saving.';
	const secondGameName = 'Second Overview Test';
	const secondFolderName = 'Second_Overview_Test';
	const secondGameDescription =
		'A second created game should also appear on the overview after saving.';

	await page.goto('/app/games');
	await fullOpfsSeed(page, projectsDir);

	await page.getByRole('button', { name: 'Use Browser' }).first().click();
	await page.getByRole('button', { name: 'Use Browser storage' }).click();
	await expect(page.getByRole('heading', { name: 'Board Games' })).toBeVisible();

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

	await expect(page).toHaveURL(new RegExp(`/app/games/${folderName}/decks/${deckName}/data`));
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

test('create new deck and delete it', async ({ page }) => {
	const here = path.dirname(test.info().file); // absolute dir of THIS test file
	const projectsDir = path.resolve(here, '../projects');
	const deckName = 'e2e_deck';

	await page.goto('/app/games');
	await fullOpfsSeed(page, projectsDir);

	await page.getByRole('button', { name: 'Use Browser' }).first().click();
	await page.getByRole('button', { name: 'Use Browser storage' }).click();

	await page.getByRole('main').getByText('western-cards').click();
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('button', { name: 'New' }).click();

	await page.getByPlaceholder('deck name').fill(deckName);
	await page.getByRole('button', { name: 'Create new deck' }).click();

	await expect(page).toHaveURL(new RegExp(`/app/games/western-cards/decks/${deckName}/data`));
	await expect(page.getByRole('link', { name: deckName, exact: true })).toBeVisible();
	await page.reload();
	await expect(page).toHaveURL(new RegExp(`/app/games/western-cards/decks/${deckName}/data`));
	await page.getByRole('button', { name: 'Decks' }).click();
	await expect(page.getByRole('link', { name: deckName, exact: true })).toBeVisible();
	await page.getByRole('button', { name: `More for ${deckName}` }).click();
	await page.getByRole('menuitem', { name: 'Delete' }).click();
	await expect(page.getByRole('link', { name: deckName, exact: true })).not.toBeVisible();
	await expect(page).toHaveURL(new RegExp(`/app/games/western-cards$`));
});
