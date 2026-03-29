import { expect, test } from '@playwright/test';
import * as path from 'node:path';
import { fullOpfsSeed } from './helpers/opfs';

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
