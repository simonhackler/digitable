import { expect, test } from '@playwright/test';
import {
	migrateProjectsIfPrompted,
	openOpfsSeedPage,
	saveOpfsStoragePreference,
	writeOpfsText
} from './helpers/opfs';

test.setTimeout(60_000);

test('keeps branch edits isolated and opens complete historical checkpoints read-only', async ({
	page
}) => {
	const project = 'branch-checkpoints';
	await openOpfsSeedPage(page);
	await writeOpfsText(
		page,
		`/${project}/game.json`,
		`${JSON.stringify({
			name: 'Branch checkpoints',
			minPlayers: 1,
			maxPlayers: 4,
			description: 'Main description',
			tags: []
		})}\n`
	);
	await writeOpfsText(page, `/${project}/rules.md`, '# Original rules\n');
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games');
	await migrateProjectsIfPrompted(page);
	await page.goto(`/app/games/${project}`);
	await expect(page.getByText('Edit Board Game')).toBeVisible();

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	await expect(page.getByRole('button', { name: 'Branch 1', exact: true })).toBeVisible();

	const description = page.getByLabel('Game Description');
	await description.fill('Branch description');
	await expect(description).toHaveValue('Branch description');

	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Main', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Main', exact: true })).toBeVisible();
	await expect(page.getByLabel('Game Description')).toHaveValue('Main description');

	await page.getByRole('button', { name: /^History/ }).click();
	const initial = page.getByText('Initial project').first();
	await expect(initial).toBeVisible();
	await page
		.getByRole('dialog', { name: 'Main history' })
		.getByRole('button', { name: 'View' })
		.click();
	await expect(page.getByText('Viewing historical checkpoint · Read only')).toBeVisible();
	await expect(page.getByLabel('Game Description')).toBeDisabled();
	await page.getByRole('link', { name: 'Rules', exact: true }).click();
	await expect(page).toHaveURL(/checkpoint=/);
	const rules = page.getByRole('textbox', { name: 'Game rules editor' });
	await expect(rules).toContainText('Original rules');
	await expect(rules).toHaveAttribute('aria-readonly', 'true');
});

test('merges a branch into its parent and checks the parent out', async ({ page }) => {
	const project = 'branch-merge';
	await openOpfsSeedPage(page);
	await writeOpfsText(
		page,
		`/${project}/game.json`,
		`${JSON.stringify({
			name: 'Branch merge',
			minPlayers: 1,
			maxPlayers: 4,
			description: 'Before merge',
			tags: []
		})}\n`
	);
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games');
	await migrateProjectsIfPrompted(page);
	await page.goto(`/app/games/${project}`);
	await expect(page.getByText('Edit Board Game')).toBeVisible();

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	await expect(page.getByRole('button', { name: 'Branch 1', exact: true })).toBeVisible();
	await page.getByLabel('Game Description').fill('After merge');

	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Merge into parent' }).click();

	await expect(page.getByRole('button', { name: 'Main', exact: true })).toBeVisible();
	await expect(page.getByLabel('Game Description')).toHaveValue('After merge');
});

test('uses one project-global checkout across tabs', async ({ context, page }) => {
	const project = 'branch-multi-tab';
	await openOpfsSeedPage(page);
	await writeOpfsText(
		page,
		`/${project}/game.json`,
		`${JSON.stringify({
			name: 'Branch multi tab',
			minPlayers: 1,
			maxPlayers: 4,
			description: 'Shared main',
			tags: []
		})}\n`
	);
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games');
	await migrateProjectsIfPrompted(page);
	await page.goto(`/app/games/${project}`);
	await expect(page.getByText('Edit Board Game')).toBeVisible();

	const peer = await context.newPage();
	await peer.goto(`/app/games/${project}`);
	await expect(peer.getByText('Edit Board Game')).toBeVisible();

	await page.getByRole('button', { name: 'Main', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Create branch' }).click();
	await expect(page.getByRole('button', { name: 'Branch 1', exact: true })).toBeVisible();
	await expect(peer.getByRole('button', { name: 'Branch 1', exact: true })).toBeVisible();

	await page.getByLabel('Game Description').fill('Shared branch');
	await expect(peer.getByLabel('Game Description')).toHaveValue('Shared branch');

	await peer.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await peer.getByRole('menuitem', { name: 'Main', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Main', exact: true })).toBeVisible();
	await expect(peer.getByText('Edit Board Game')).toBeVisible();
	await expect(peer.getByLabel('Game Description')).toHaveValue('Shared main');
});

test('forks a writable branch from a historical project checkpoint', async ({ page }) => {
	const project = 'branch-from-history';
	await openOpfsSeedPage(page);
	await writeOpfsText(
		page,
		`/${project}/game.json`,
		`${JSON.stringify({
			name: 'Branch from history',
			minPlayers: 1,
			maxPlayers: 4,
			description: 'Historical value',
			tags: []
		})}\n`
	);
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games');
	await migrateProjectsIfPrompted(page);
	await page.goto(`/app/games/${project}`);
	await expect(page.getByText('Edit Board Game')).toBeVisible();

	await page.getByLabel('Game Description').fill('Latest value');
	await page.waitForTimeout(1_000);
	await page.getByRole('button', { name: 'History', exact: true }).click();
	const latest = page.getByRole('group', { name: 'Checkpoint Project edit' }).first();
	await expect(latest).toBeVisible();
	await latest.getByRole('button', { name: 'View' }).click();
	await expect(page.getByText('Viewing historical checkpoint · Read only')).toBeVisible();
	await page.getByRole('button', { name: /^History/ }).click();
	const initial = page.getByRole('group', { name: 'Checkpoint Initial project' });
	await expect(initial).toBeVisible();
	await initial.getByRole('button', { name: 'Compare from here' }).click();
	await expect(page.getByText(/changed files?\./)).toBeVisible();
	await expect(page.getByRole('listitem').filter({ hasText: 'game.json' })).toBeVisible();
	await initial.getByRole('button', { name: 'Branch from here' }).click();

	await expect(page.getByRole('button', { name: 'Branch 1', exact: true })).toBeVisible();
	await expect(page.getByLabel('Game Description')).toHaveValue('Historical value');
	await page.getByRole('button', { name: 'Branch 1', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Main', exact: true }).click();
	await expect(page.getByLabel('Game Description')).toHaveValue('Latest value');
});
