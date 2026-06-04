import { expect, test } from '@playwright/test';

const email = `auth-e2e-${Date.now()}@example.com`;
const password = 'correct-horse-battery-staple';
const name = 'Auth E2E';

test.describe.configure({ mode: 'serial' });
test.setTimeout(60000);

test('google auth controls are hidden without provider credentials', async ({ page }) => {
	test.skip(
		Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
		'Google credentials are configured'
	);

	await page.goto('/app/sign-in', { waitUntil: 'networkidle' });
	await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeHidden();

	await page.goto('/app/sign-up', { waitUntil: 'networkidle' });
	await expect(page.getByRole('heading', { name: 'Create your Digitable account' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeHidden();
});

test('sign up creates an account and opens the app', async ({ page }) => {
	await page.goto('/app/sign-up', { waitUntil: 'networkidle' });

	await expect(page.getByRole('heading', { name: 'Create your Digitable account' })).toBeVisible();

	await page.getByLabel('Name').fill(name);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByLabel('Confirm password').fill(password);
	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: 'Create account' }).click();

	await expect(page).toHaveURL(/\/app\/games$/, { timeout: 20000 });
});

test('sign in opens the app for an existing account', async ({ page, context }) => {
	await context.clearCookies();
	await page.goto(`/app/sign-in?next=${encodeURIComponent('/app/games?source=sign-in-next')}`, {
		waitUntil: 'networkidle'
	});

	await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByLabel('Password').press('Enter');

	await expect(page).toHaveURL(/\/app\/games\?source=sign-in-next$/, { timeout: 20000 });
});
