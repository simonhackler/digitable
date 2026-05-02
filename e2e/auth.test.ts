import { expect, test } from '@playwright/test';

const email = `auth-e2e-${Date.now()}@example.com`;
const password = 'correct-horse-battery-staple';
const name = 'Auth E2E';

test.describe.configure({ mode: 'serial' });

test('sign up creates an account and opens the app', async ({ page }) => {
	await page.goto('/sign-up', { waitUntil: 'networkidle' });

	await expect(page.getByRole('heading', { name: 'Create your Digitable account' })).toBeVisible();

	await page.getByLabel('Name').fill(name);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByLabel('Confirm password').fill(password);
	await page.getByRole('button', { name: 'Create account' }).click();

	await expect(page).toHaveURL(/\/app\/games$/);
});

test('sign in opens the app for an existing account', async ({ page, context }) => {
	await context.clearCookies();
	await page.goto('/sign-in', { waitUntil: 'networkidle' });

	await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page).toHaveURL(/\/app\/games$/);
});
