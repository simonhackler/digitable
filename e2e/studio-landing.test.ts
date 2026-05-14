import { expect, test } from '@playwright/test';
import { useBrowserStorage } from './helpers/opfs';

test('create now opens the game workspace without signup', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('link', { name: 'Create now' }).click({ noWaitAfter: true });

	await page.waitForURL(/\/app\/games$/);
	if (!(await page.getByRole('heading', { name: 'Board Games' }).isVisible())) {
		await expect(
			page.getByText('Get started by picking a folder to store your projects')
		).toBeVisible();
		await useBrowserStorage(page);
	}

	await expect(page.getByRole('heading', { name: 'Board Games' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create Game' }).first()).toBeVisible();
});
