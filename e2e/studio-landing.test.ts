import { expect, test } from '@playwright/test';

test('create now opens the game workspace without signup', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('link', { name: 'Create now' }).click({ noWaitAfter: true });

	await page.waitForURL(/\/app\/games$/);
	await expect(page.getByText('Get started by picking a folder to store your projects')).toBeVisible();

	await page.getByRole('button', { name: 'Use Browser' }).first().click();
	await page.getByRole('button', { name: 'Use Browser storage' }).click();

	await expect(page.getByRole('heading', { name: 'Board Games' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create Game' }).first()).toBeVisible();
});
