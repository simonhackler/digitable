import { expect, test } from '@playwright/test';
import * as path from 'node:path';
import { fullOpfsSeed } from './helpers/opfs';

test('create new game', async ({ page }) => {
	const here = path.dirname(test.info().file); // absolute dir of THIS test file
	const projectsDir = path.resolve(here, '../projects');
	const gameName = 'Create Game Test';

	await page.goto('/games');
	await fullOpfsSeed(page, projectsDir);

	await page.getByRole('button', { name: 'Use Browser' }).nth(1).click();
	await page.getByRole('button', { name: 'Use Browser storage' }).click();
	await expect(page.getByRole('heading', { name: 'Board Games' })).toBeVisible();

	await page.getByRole('button', { name: 'Create Game' }).first().click();
	await page.getByRole('textbox', { name: 'Gamename' }).fill(gameName);
	await page.getByRole('button', { name: 'Create', exact: true }).click();

	await expect(page).toHaveURL(/\/games\/Create_Game_Test/);
	await expect(page.getByText('Create New Board Game')).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Game Name' })).toHaveValue(gameName);

	await page
		.getByRole('textbox', { name: 'Game Description' })
		.fill('A quick test game description that is long enough for validation.');
	await page.getByRole('button', { name: 'Fantasy', exact: true }).click();
	await page.getByRole('main').getByRole('button', { name: 'Create', exact: true }).click();

	await expect(page.getByText('Game created successfully!')).toBeVisible();
});

test('create new deck', async ({ page }) => {
	const here = path.dirname(test.info().file); // absolute dir of THIS test file
	const projectsDir = path.resolve(here, '../projects');
	const deckName = 'e2e_deck';

	await page.goto('/games');
	await fullOpfsSeed(page, projectsDir);

	await page.getByRole('button', { name: 'Use Browser' }).nth(1).click();
	await page.getByRole('button', { name: 'Use Browser storage' }).click();

	await page.getByRole('main').getByText('western-cards').click();
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('button', { name: 'New' }).click();

	await page.getByPlaceholder('deck name').fill(deckName);
	await page.getByRole('button', { name: 'Create new deck' }).click();

	await expect(page).toHaveURL(new RegExp(`/games/western-cards/decks/${deckName}/data`));
	await expect(page.getByRole('link', { name: deckName, exact: true })).toBeVisible();
});
