import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';

const password = 'correct-horse-battery-staple';

test.describe.configure({ mode: 'serial' });

type DbModule = typeof import('../packages/db/src/client');
type PoliciesModule = typeof import('../packages/db/src/policies');
type SchemaModule = typeof import('../packages/db/src/schema');

let dbModule: DbModule;
let policiesModule: PoliciesModule;
let schemaModule: SchemaModule;

async function databaseUrlForRunningDevenv() {
	const postmasterPid = await readFile('.devenv/state/postgres/postmaster.pid', 'utf8');
	const [, , , port] = postmasterPid.split('\n');

	if (!port) {
		throw new Error('Could not determine the running devenv Postgres port');
	}

	return `postgres://svg_table:svg_table@127.0.0.1:${port}/svg_table`;
}

test.beforeAll(async () => {
	process.env.DATABASE_URL = await databaseUrlForRunningDevenv();

	[dbModule, policiesModule, schemaModule] = await Promise.all([
		import('../packages/db/src/client'),
		import('../packages/db/src/policies'),
		import('../packages/db/src/schema')
	]);

	const [terms, privacyPolicy] = await Promise.all([
		readFile(new URL('../packages/studio/src/lib/legal/terms.md', import.meta.url), 'utf8'),
		readFile(new URL('../packages/studio/src/lib/legal/privacy-policy.md', import.meta.url), 'utf8')
	]);

	await policiesModule.syncPolicyVersion({
		policyType: 'terms',
		version: '2026-05-13',
		content: terms,
		isCurrent: true
	});
	await policiesModule.syncPolicyVersion({
		policyType: 'privacy_policy',
		version: '2026-05-13',
		content: privacyPolicy,
		isCurrent: true
	});
});

async function signInViaAuthApi(page: import('@playwright/test').Page, email: string) {
	const response = await page.request.post('/app/api/auth/sign-in/email', {
		data: {
			email,
			password
		}
	});

	expect(response.ok()).toBe(true);
}

async function findUserByEmail(email: string) {
	const [user] = await dbModule.db
		.select()
		.from(schemaModule.user)
		.where(eq(schemaModule.user.email, email))
		.limit(1);

	return user;
}

async function userAcceptances(userId: string) {
	return dbModule.db
		.select()
		.from(schemaModule.userPolicyAcceptance)
		.where(eq(schemaModule.userPolicyAcceptance.userId, userId));
}

async function currentAppSessionUser(page: import('@playwright/test').Page) {
	const response = await page.request.get('/app/api/auth/get-session');
	expect(response.ok()).toBe(true);

	const session = (await response.json()) as {
		user?: {
			id: string;
			name?: string;
			isAnonymous?: boolean;
		};
	} | null;

	return session?.user ?? null;
}

test('sign up records current policy acceptances', async ({ page, context }) => {
	const email = `legal-ui-e2e-${Date.now()}@example.com`;

	await page.goto('/sign-up', { waitUntil: 'networkidle' });
	await expect(page.getByRole('heading', { name: 'Create your Digitable account' })).toBeVisible();

	await page.getByLabel('Name').fill('Legal UI E2E');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByLabel('Confirm password').fill(password);
	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: 'Create account' }).click();

	await expect(page).toHaveURL(/\/app\/games$/, { timeout: 20000 });

	await expect.poll(async () => findUserByEmail(email)).toBeTruthy();

	const createdUser = await findUserByEmail(email);
	if (!createdUser) {
		throw new Error('Expected sign-up to create a user');
	}

	await expect
		.poll(async () => policiesModule.getMissingCurrentPolicies(createdUser.id))
		.toHaveLength(0);
	await expect.poll(async () => userAcceptances(createdUser.id)).toHaveLength(2);

	await context.clearCookies();
	await signInViaAuthApi(page, email);
	await page.goto('/app/games');

	await expect(page).toHaveURL(/\/app\/games$/, { timeout: 20000 });
});

test('missing current policy acceptances redirect to the legal acceptance page', async ({
	page,
	request,
	context
}) => {
	const email = `legal-missing-e2e-${Date.now()}@example.com`;

	const response = await request.post('/app/api/auth/sign-up/email', {
		data: {
			name: 'Legal Missing E2E',
			email,
			password
		}
	});

	expect(response.ok()).toBe(true);
	await context.clearCookies();

	await expect.poll(async () => findUserByEmail(email)).toBeTruthy();

	const user = await findUserByEmail(email);
	if (!user) {
		throw new Error('Expected sign-up API to create a user');
	}

	await expect.poll(async () => policiesModule.getMissingCurrentPolicies(user.id)).toHaveLength(2);

	await signInViaAuthApi(page, email);
	await page.goto('/app/games');

	await expect(page).toHaveURL(/\/app\/legal\/accept$/, { timeout: 20000 });
	await expect(
		page.getByRole('heading', { name: 'Review the current legal documents.' })
	).toBeVisible();

	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: 'Continue' }).click();

	await expect(page).toHaveURL(/\/app\/games$/, { timeout: 20000 });
	await expect.poll(async () => policiesModule.getMissingCurrentPolicies(user.id)).toHaveLength(0);
	await expect.poll(async () => userAcceptances(user.id)).toHaveLength(2);
});

test('anonymous sign-in requires a name', async ({ request }) => {
	const response = await request.post('/app/api/auth/sign-in/anonymous', {
		data: {}
	});

	expect(response.status()).toBe(400);
	expect(await response.text()).toContain('Enter your name to join this playtest.');
});

test('anonymous playtest legal acceptance records current policy acceptances', async ({ page }) => {
	const playtestPath = `/app/playtests/${randomUUID()}?e2e=1`;

	await page.goto(`/app/legal/accept?anonymous=playtest&next=${encodeURIComponent(playtestPath)}`, {
		waitUntil: 'networkidle'
	});
	await expect(
		page.getByRole('heading', { name: 'Review the current legal documents.' })
	).toBeVisible();

	await page.getByLabel('Your name').fill('Legal Anonymous');
	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: 'Continue' }).click();

	await expect(page).toHaveURL(/\/app\/playtests\/[0-9a-f-]+\?e2e=1$/, { timeout: 20_000 });

	const anonymousUser = await currentAppSessionUser(page);
	expect(anonymousUser).toBeTruthy();
	expect(anonymousUser?.isAnonymous).toBe(true);
	expect(anonymousUser?.name).toBe('Legal Anonymous');

	await expect
		.poll(async () => policiesModule.getMissingCurrentPolicies(anonymousUser!.id))
		.toHaveLength(0);
	await expect.poll(async () => userAcceptances(anonymousUser!.id)).toHaveLength(2);
});
