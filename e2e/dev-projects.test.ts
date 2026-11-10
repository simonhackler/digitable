import { expect, test } from '@playwright/test';

test('opens the worktree projects folder without asking for a folder', async ({ page }) => {
	await page.goto('/app/games');
	await expect(page.getByRole('heading', { name: 'Board Games' })).toBeVisible();
	await expect(page.getByText('pixi-play-single-card', { exact: true })).toBeVisible();
	await expect(page.getByText('Get started by picking a folder')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Change Projects Folder' })).toBeVisible();

	const content = await page.evaluate(async () => {
		const path = `dev-projects-e2e-${crypto.randomUUID()}.txt`;
		const url = new URL('/app/api/dev-projects', location.origin);
		url.searchParams.set('path', path);
		try {
			url.searchParams.set('operation', 'write');
			const written = await fetch(url, {
				method: 'POST',
				body: new File(['Saved in this worktree'], path, { type: 'text/plain' })
			});
			if (!written.ok) throw new Error(await written.text());
			url.searchParams.set('operation', 'read');
			const read = await fetch(url);
			if (!read.ok) throw new Error(await read.text());
			return await read.text();
		} finally {
			await fetch(url, { method: 'DELETE' });
		}
	});
	expect(content).toBe('Saved in this worktree');
});

test('opens a worktree project without optional Automerge files', async ({ page }) => {
	const name = `dev-projects-e2e-${crypto.randomUUID()}`;
	await page.goto('/app/games');
	await page.evaluate(async (name) => {
		const source = await fetch(
			'/app/api/dev-projects?operation=read&path=pixi-play-single-card/game.json'
		);
		if (!source.ok) throw new Error(await source.text());
		const target = new URL('/app/api/dev-projects', location.origin);
		target.searchParams.set('operation', 'write');
		target.searchParams.set('path', `${name}/game.json`);
		const written = await fetch(target, { method: 'POST', body: await source.blob() });
		if (!written.ok) throw new Error(await written.text());
	}, name);

	try {
		await page.goto(`/app/games/${name}`);
		await expect(page.locator('main')).toContainText('Edit Board Game');
	} finally {
		await page.goto('/app/games');
		await page.evaluate(async (name) => {
			const target = new URL('/app/api/dev-projects', location.origin);
			target.searchParams.set('path', name);
			const removed = await fetch(target, { method: 'DELETE', headers: { 'X-Recursive': 'true' } });
			if (!removed.ok) throw new Error(await removed.text());
		}, name);
	}
});
