import { expect, test } from '@playwright/test';
import {
	openOpfsSeedPage,
	readOpfsText,
	saveOpfsStoragePreference,
	writeOpfsFiles,
	writeOpfsText
} from './helpers/opfs';

test('returns to the games overview from a deleted project', async ({ page }) => {
	await openOpfsSeedPage(page);
	const metadata = JSON.stringify({
		name: 'Example',
		minPlayers: 1,
		maxPlayers: 4,
		description: 'Available game',
		tags: []
	});
	await writeOpfsFiles(page, {
		'/deleted/game.json': metadata,
		'/remaining/game.json': metadata
	});
	await saveOpfsStoragePreference(page);
	await page.evaluate(async () => {
		const root = await navigator.storage.getDirectory();
		await root.removeEntry('deleted', { recursive: true });
	});
	await page.goto('/app/games/deleted');
	await page.getByRole('link', { name: 'Back to games', exact: true }).click();
	await expect(page).toHaveURL(/\/app\/games$/);
	await expect(page.getByRole('heading', { name: 'Board Games', exact: true })).toBeVisible();
	await page.getByText('remaining', { exact: true }).click();
	await expect(page.getByLabel('Game Description')).toHaveValue('Available game');
});

test('opens and migrates the requested project independently, then reconciles a cold reopen', async ({
	page
}) => {
	await openOpfsSeedPage(page);
	const metadata = (name: string) =>
		JSON.stringify({ name, minPlayers: 1, maxPlayers: 4, description: name, tags: ['test'] });
	await writeOpfsFiles(page, {
		'/first/game.json': metadata('First'),
		'/first/rules.md': '# Original rules\n',
		'/first/system/cards/data.csv': 'id,title\ncard,Example\n',
		'/second/game.json': metadata('Second'),
		'/second/rules.md': '# Second rules\n'
	});
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games/first');
	await expect(page.getByLabel('Game Description')).toHaveValue('First');
	await expect(async () => {
		expect(JSON.parse(await readOpfsText(page, '/first/.digitable.json')).digitableVersion).toBe(
			'0.0.1'
		);
	}).toPass();
	expect(await readOpfsText(page, '/first/components/cards/data.csv')).toContain('Example');
	await page.getByRole('link', { name: 'Rules', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Game rules editor' })).toContainText(
		'Original rules'
	);
	await page.getByRole('button', { name: /first/ }).first().click();
	await page.getByRole('menuitem', { name: /second/ }).click();
	await expect(page.getByLabel('Game Description')).toHaveValue('Second');
	await writeOpfsText(page, '/first/rules.md', '# Changed while closed\n');
	await page.goto('/app/games/first/rules');
	await expect(page.getByRole('textbox', { name: 'Game rules editor' })).toContainText(
		'Changed while closed'
	);
});

test('details and rules remain usable while an unrelated asset document is unavailable', async ({
	page
}) => {
	await openOpfsSeedPage(page);
	await writeOpfsFiles(page, {
		'/partial/game.json': JSON.stringify({
			name: 'Partial',
			minPlayers: 1,
			maxPlayers: 4,
			description: 'Available metadata',
			tags: []
		}),
		'/partial/rules.md': '# Available rules\n',
		'/partial/assets/unavailable.png': 'asset bytes',
		'/other/game.json': JSON.stringify({
			name: 'Other',
			minPlayers: 1,
			maxPlayers: 4,
			description: 'Other project',
			tags: []
		})
	});
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games/partial');
	await expect(page.getByLabel('Game Description')).toHaveValue('Available metadata');
	await page
		.getByRole('button', { name: /partial/ })
		.first()
		.click();
	await page.getByRole('menuitem', { name: /other/ }).click();
	await expect(page.getByLabel('Game Description')).toHaveValue('Other project');

	// Remove a real stored document after durable close. The remaining project must still open.
	await page.evaluate(async () => {
		const root = await navigator.storage.getDirectory();
		const project = await root.getDirectoryHandle('partial');
		const automerge = await project.getDirectoryHandle('.automerge');
		const config = JSON.parse(
			await (await (await automerge.getFileHandle('config.json')).getFile()).text()
		);
		const projection = Object.values(config.projections).find(
			(value) => (value as { path: string }).path === 'assets/unavailable.png'
		) as { url: string };
		const key = Array.from(
			new TextEncoder().encode(projection.url.slice('automerge:'.length)),
			(byte) => byte.toString(16).padStart(2, '0')
		).join('');
		const storage = await automerge.getDirectoryHandle('storage');
		const shard = await storage.getDirectoryHandle(key.slice(0, 2));
		await shard.removeEntry(key, { recursive: true });
	});
	await page.goto('/app/games/partial');
	await expect(page.getByLabel('Game Description')).toHaveValue('Available metadata');
	await page.getByRole('link', { name: 'Rules', exact: true }).click();
	const editor = page.getByRole('textbox', { name: 'Game rules editor' });
	await expect(editor).toContainText('Available rules');
	await editor.fill('Edited while the asset is unavailable');
	await expect(async () => {
		expect(await readOpfsText(page, '/partial/rules.md')).toContain(
			'Edited while the asset is unavailable'
		);
	}).toPass();
});
