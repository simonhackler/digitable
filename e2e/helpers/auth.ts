import { expect, type APIResponse, type Browser, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const password = 'correct-horse-battery-staple';
const authStateDir = path.resolve('test-results/.auth');
const storageStatePromises = new Map<string, Promise<string>>();

type AuthRole = 'owner' | 'invitee';

function randomEmail(role: AuthRole, workerIndex: number) {
	return `playtest-${role}-worker-${workerIndex}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

function baseURLFromTestInfo(testInfo: TestInfo) {
	const baseURL = testInfo.project.use.baseURL;
	if (typeof baseURL !== 'string' || baseURL.length === 0) {
		throw new Error('Expected Playwright baseURL to be configured for auth setup');
	}
	return baseURL;
}

async function responseText(response: APIResponse) {
	return `${response.status()} ${response.statusText()}: ${await response.text()}`;
}

async function createAuthenticatedStorageState(
	browser: Browser,
	testInfo: TestInfo,
	role: AuthRole
) {
	await mkdir(authStateDir, { recursive: true });

	const baseURL = baseURLFromTestInfo(testInfo);
	const storageStatePath = path.join(authStateDir, `worker-${testInfo.workerIndex}-${role}.json`);
	const context = await browser.newContext({ baseURL });
	const page = await context.newPage();
	const email = randomEmail(role, testInfo.workerIndex);

	try {
		const signUpResponse = await page.request.post('/api/auth/sign-up/email', {
			data: {
				name: `Playtest ${role}`,
				email,
				password
			}
		});

		expect(signUpResponse.ok(), await responseText(signUpResponse)).toBe(true);

		const policyResponse = await page.request.post('/api/legal/accept-current');
		expect(policyResponse.ok(), await responseText(policyResponse)).toBe(true);

		await context.storageState({ path: storageStatePath });
		return storageStatePath;
	} finally {
		await context.close();
	}
}

async function authenticatedStorageState(browser: Browser, testInfo: TestInfo, role: AuthRole) {
	const key = `${baseURLFromTestInfo(testInfo)}:${testInfo.workerIndex}:${role}`;
	const cached = storageStatePromises.get(key);
	if (cached) {
		return cached;
	}

	const created = createAuthenticatedStorageState(browser, testInfo, role);
	storageStatePromises.set(key, created);
	return created;
}

export async function newAuthenticatedPage(
	browser: Browser,
	testInfo: TestInfo,
	role: AuthRole = 'owner'
) {
	const baseURL = baseURLFromTestInfo(testInfo);
	const storageState = await authenticatedStorageState(browser, testInfo, role);
	const context = await browser.newContext({ baseURL, storageState });
	const page = await context.newPage();

	return { context, page };
}
