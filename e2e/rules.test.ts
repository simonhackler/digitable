import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { openSeededProjects, readOpfsText, writeOpfsText } from './helpers/opfs';

test.describe.configure({ mode: 'serial' });

let rulesContext: BrowserContext | null = null;

async function openRules(page: Page) {
	await page.goto('/app/games/western-cards/rules');
	await expect(page.getByRole('textbox', { name: 'Game rules editor' })).toBeVisible({
		timeout: 10_000
	});
}

test.beforeAll(async ({ browser }, testInfo) => {
	rulesContext = await browser.newContext({
		baseURL: testInfo.project.use.baseURL as string | undefined
	});
	const page = await rulesContext.newPage();
	try {
		await openSeededProjects(page, { projectNames: ['western-cards', 'map'] });
	} finally {
		await page.close();
	}
});

test.afterAll(async () => {
	await rulesContext?.close();
	rulesContext = null;
});

test('rules synchronize live between mounted editors and project to markdown', async () => {
	if (!rulesContext) throw new Error('Rules context was not initialized');
	const page = await rulesContext.newPage();
	const peer = await rulesContext.newPage();
	try {
		await openRules(page);
		await openRules(peer);
		const editor = page.getByRole('textbox', { name: 'Game rules editor' });
		const peerEditor = peer.getByRole('textbox', { name: 'Game rules editor' });
		const rules = 'Live collaborative rules';

		await expect(editor).toContainText('1. Components');
		await editor.press('Control+End');
		await editor.press('Enter');
		await editor.pressSequentially(rules);
		await expect(peerEditor).toContainText(rules, { timeout: 10_000 });
		await expect.poll(() => readOpfsText(page, '/western-cards/rules.md')).toContain(rules);
		expect(await readOpfsText(page, '/western-cards/rules.md')).toContain('---');
		await editor.press('Control+Shift+ArrowLeft');
		await page
			.getByRole('toolbar', { name: 'Markdown editor toolbar' })
			.getByRole('button', { name: 'Bold' })
			.click();
		await expect.poll(() => readOpfsText(page, '/western-cards/rules.md')).toContain('**rules**');

		const externalRules = '# Rules changed outside Digitable';
		await writeOpfsText(page, '/western-cards/rules.md', externalRules);
		await expect(editor).toContainText('Rules changed outside Digitable', { timeout: 10_000 });
		await expect(peerEditor).toContainText('Rules changed outside Digitable', { timeout: 10_000 });
	} finally {
		await Promise.all([page.close(), peer.close()]);
	}
});

test('shows collaborators moving their pointer on the same rules page', async () => {
	if (!rulesContext) throw new Error('Rules context was not initialized');
	const page = await rulesContext.newPage();
	const peer = await rulesContext.newPage();
	const otherRoute = await rulesContext.newPage();
	try {
		await Promise.all([
			openRules(page),
			openRules(peer),
			otherRoute.goto('/app/games/western-cards')
		]);
		await expect(otherRoute.getByRole('textbox', { name: 'Game Name' })).toBeVisible();
		const editor = page.getByRole('textbox', { name: 'Game rules editor' });
		const box = await editor.boundingBox();
		if (!box) throw new Error('Rules editor was not visible');
		await page.mouse.move(box.x + 10, box.y + 10);
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 });
		await expect(peer.getByLabel('Collaborator cursor')).toBeVisible({ timeout: 10_000 });
		await expect(otherRoute.getByLabel('Collaborator cursor')).toHaveCount(0);

		await otherRoute.goto('/app/games/western-cards/play');
		await expect(otherRoute.getByRole('toolbar', { name: 'Play tools' })).toBeVisible();
		await expect(otherRoute.locator('[data-collaborative-cursor-layer]')).toHaveCount(0);
	} finally {
		await Promise.all([page.close(), peer.close(), otherRoute.close()]);
	}
});

test('creates a missing rules file through the project session', async () => {
	if (!rulesContext) throw new Error('Rules context was not initialized');
	const page = await rulesContext.newPage();
	try {
		await page.goto('/app/games/map/rules');
		const editor = page.getByRole('textbox', { name: 'Game rules editor' });
		await expect(editor).toBeVisible();
		await editor.fill('New map rules');
		await expect.poll(() => readOpfsText(page, '/map/rules.md')).toContain('New map rules');
	} finally {
		await page.close();
	}
});
