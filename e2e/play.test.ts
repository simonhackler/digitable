import { expect, test, type Page } from '@playwright/test';
import * as path from 'node:path';
import { seedOPFS, walkDirectory } from './helpers/opfs';
import { pixiClick, pixiDragTo, pixiState, waitForPixi } from './helpers/pixi';

const playtestAppOrigin = process.env.PLAYTEST_APP_ORIGIN ?? '';

function appPath(pathname: string) {
	return `${playtestAppOrigin}/app${pathname}`;
}

async function openPixiProject(page: Page, projectSlug: string) {
	const here = path.dirname(test.info().file);
	const projectDir = path.resolve(here, `../projects/${projectSlug}`);
	const mappings = await walkDirectory(projectDir, `/${projectSlug}`);

	await page.goto('/app/games');
	await seedOPFS(page, mappings);

	await page.getByRole('button', { name: 'Use Browser' }).first().click();
	await page.getByRole('button', { name: 'Use Browser storage' }).click();
	await expect(page.getByRole('heading', { name: 'Board Games' })).toBeVisible();
	await expect(page.getByRole('main').getByText(projectSlug)).toBeVisible();
	await page.goto(`/app/games/${projectSlug}/play?e2e=1`);
	await waitForPixi(page);
}

async function openPixiSmokeTest(page: Page) {
	await openPixiProject(page, 'pixi-play-smoke');
}

async function signUp(page: Page) {
	const email = `playtest-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

	await page.goto('/sign-up', { waitUntil: 'networkidle' });
	await page.getByLabel('Name').fill('Playtest E2E');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery-staple');
	await page.getByLabel('Confirm password').fill('correct-horse-battery-staple');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/app\/games$/);
}

test('drawing from a 2-card stack keeps one card on the board', async ({ page }) => {
	test.setTimeout(60_000);
	await openPixiSmokeTest(page);
	let initialState:
		| {
				visibleStacks: number;
				visibleBoardCards: number;
				handCards: number;
				firstStackId: string | null;
		  }
		| undefined;
	await expect
		.poll(
			async () => {
				const state = await pixiState(page);
				initialState = {
					visibleStacks: state.visibleStackIds.length,
					visibleBoardCards: state.visibleBoardCardIds.length,
					handCards: state.handCardIds.length,
					firstStackId: state.visibleStackIds[0] ?? null
				};
				return initialState;
			},
			{ timeout: 20_000 }
		)
		.toEqual({
			visibleStacks: 1,
			visibleBoardCards: 0,
			handCards: 0,
			firstStackId: expect.any(String)
		});

	expect(initialState?.firstStackId).toBeTruthy();
	await pixiClick(page, initialState!.firstStackId!);
	await page.keyboard.press('d');

	await expect
		.poll(async () => {
			const state = await pixiState(page);
			return {
				visibleStacks: state.visibleStackIds.length,
				visibleBoardCards: state.visibleBoardCardIds.length,
				handCards: state.handCardIds.length
			};
		})
		.toEqual({
			visibleStacks: 0,
			visibleBoardCards: 1,
			handCards: 1
		});
});

test('drawing from a 3-card stack keeps the remaining deck visible', async ({ page }) => {
	test.setTimeout(60_000);
	await openPixiProject(page, 'pixi-play-three-card');

	let firstStackId: string | null = null;
	await expect
		.poll(
			async () => {
				const state = await pixiState(page);
				firstStackId = state.visibleStackIds[0] ?? null;
				return {
					visibleStacks: state.visibleStackIds.length,
					visibleBoardCards: state.visibleBoardCardIds.length,
					handCards: state.handCardIds.length
				};
			},
			{ timeout: 20_000 }
		)
		.toEqual({
			visibleStacks: 1,
			visibleBoardCards: 0,
			handCards: 0
		});

	expect(firstStackId).toBeTruthy();
	await pixiClick(page, firstStackId!);
	await page.keyboard.press('d');

	await expect
		.poll(
			async () => {
				const state = await pixiState(page);
				return {
					visibleStacks: state.visibleStackIds.length,
					visibleBoardCards: state.visibleBoardCardIds.length,
					handCards: state.handCardIds.length
				};
			},
			{ timeout: 20_000 }
		)
		.toEqual({
			visibleStacks: 1,
			visibleBoardCards: 0,
			handCards: 1
		});
});

test('a played card stays visible after being clicked again', async ({ page }) => {
	test.setTimeout(60_000);
	await openPixiSmokeTest(page);

	let firstStackId: string | null = null;
	await expect
		.poll(
			async () => {
				const state = await pixiState(page);
				firstStackId = state.visibleStackIds[0] ?? null;
				return state.visibleStackIds.length;
			},
			{ timeout: 20_000 }
		)
		.toBe(1);

	expect(firstStackId).toBeTruthy();
	await pixiClick(page, firstStackId!);
	await page.keyboard.press('d');

	let handCardId: string | null = null;
	await expect
		.poll(
			async () => {
				const state = await pixiState(page);
				handCardId = state.handCardIds[0] ?? null;
				return {
					visibleStacks: state.visibleStackIds.length,
					visibleBoardCards: state.visibleBoardCardIds.length,
					handCards: state.handCardIds.length
				};
			},
			{ timeout: 20_000 }
		)
		.toEqual({
			visibleStacks: 0,
			visibleBoardCards: 1,
			handCards: 1
		});

	expect(handCardId).toBeTruthy();
	await pixiDragTo(page, handCardId!, { x: 640, y: 220 });

	await expect
		.poll(
			async () => {
				const state = await pixiState(page);
				return {
					visibleBoardCardIds: state.visibleBoardCardIds,
					handCardIds: state.handCardIds
				};
			},
			{ timeout: 20_000 }
		)
		.toEqual({
			visibleBoardCardIds: [handCardId],
			handCardIds: []
		});

	await pixiClick(page, handCardId!);

	await expect
		.poll(
			async () => {
				const state = await pixiState(page);
				return {
					visibleBoardCardIds: state.visibleBoardCardIds,
					handCardIds: state.handCardIds
				};
			},
			{ timeout: 20_000 }
		)
		.toEqual({
			visibleBoardCardIds: [handCardId],
			handCardIds: []
		});
});

test('playtest invite imports the project and opens playable cards', async ({ page }) => {
	test.setTimeout(90_000);
	const here = path.dirname(test.info().file);
	const projectDir = path.resolve(here, '../projects/pixi-play-smoke');
	const mappings = await walkDirectory(projectDir, '/pixi-play-smoke');

	await signUp(page);
	await page.goto(appPath('/games'));
	await seedOPFS(page, mappings);
	await page.getByRole('button', { name: 'Use Browser' }).first().click();
	await page.getByRole('button', { name: 'Use Browser storage' }).click();
	await expect(page.getByRole('main').getByText('pixi-play-smoke')).toBeVisible();

	await page.getByRole('button', { name: 'Playtest' }).click();
	const inviteInput = page.getByLabel('Playtest invite link');
	await expect(inviteInput).toHaveValue(/\/app\/playtests\/[0-9a-f-]+/);
	const inviteUrl = await inviteInput.inputValue();

	await page.goto(`${inviteUrl}?e2e=1`);
	await expect(page).toHaveURL(/\/app\/games\/pixi-play-smoke-playtest-[0-9a-f]+\/play/);
	await waitForPixi(page);

	let firstStackId: string | null = null;
	await expect
		.poll(
			async () => {
				const state = await pixiState(page);
				firstStackId = state.visibleStackIds[0] ?? null;
				return state.visibleStackIds.length;
			},
			{ timeout: 20_000 }
		)
		.toBe(1);

	expect(firstStackId).toBeTruthy();
	await pixiClick(page, firstStackId!);
	await page.keyboard.press('d');

	let handCardId: string | null = null;
	await expect
		.poll(
			async () => {
				const state = await pixiState(page);
				handCardId = state.handCardIds[0] ?? null;
				return {
					visibleBoardCards: state.visibleBoardCardIds.length,
					handCards: state.handCardIds.length
				};
			},
			{ timeout: 20_000 }
		)
		.toEqual({
			visibleBoardCards: 1,
			handCards: 1
		});

	expect(handCardId).toBeTruthy();
	await pixiDragTo(page, handCardId!, { x: 640, y: 220 });

	await expect
		.poll(
			async () => {
				const state = await pixiState(page);
				return {
					playedCardIsVisible: state.visibleBoardCardIds.includes(handCardId!),
					handCardIds: state.handCardIds
				};
			},
			{ timeout: 20_000 }
		)
		.toEqual({
			playedCardIsVisible: true,
			handCardIds: []
		});
});

test('playtest invitees share private room state', async ({ page, browser }) => {
	test.setTimeout(120_000);
	const here = path.dirname(test.info().file);
	const projectDir = path.resolve(here, '../projects/pixi-play-smoke');
	const mappings = await walkDirectory(projectDir, '/pixi-play-smoke');
	const secondContext = await browser.newContext({
		baseURL: test.info().project.use.baseURL as string | undefined
	});
	const secondPage = await secondContext.newPage();

	try {
		await signUp(page);
		await page.goto(appPath('/games'));
		await seedOPFS(page, mappings);
		await page.getByRole('button', { name: 'Use Browser' }).first().click();
		await page.getByRole('button', { name: 'Use Browser storage' }).click();
		await expect(page.getByRole('main').getByText('pixi-play-smoke')).toBeVisible();

		await page.getByRole('button', { name: 'Playtest' }).click();
		const inviteInput = page.getByLabel('Playtest invite link');
		await expect(inviteInput).toHaveValue(/\/app\/playtests\/[0-9a-f-]+/);
		const inviteUrl = await inviteInput.inputValue();

		await page.goto(`${inviteUrl}?e2e=1`);
		await expect(page).toHaveURL(/\/app\/games\/pixi-play-smoke-playtest-[0-9a-f]+\/play/);
		await waitForPixi(page);

		await signUp(secondPage);
		await secondPage.goto(`${inviteUrl}?e2e=1`);
		await expect(secondPage).toHaveURL(/\/app\/games\/pixi-play-smoke-playtest-[0-9a-f]+\/play/);
		await waitForPixi(secondPage);

		let firstStackId: string | null = null;
		await expect
			.poll(
				async () => {
					const state = await pixiState(page);
					firstStackId = state.visibleStackIds[0] ?? null;
					return state.visibleStackIds.length;
				},
				{ timeout: 20_000 }
			)
			.toBe(1);

		expect(firstStackId).toBeTruthy();
		await pixiClick(page, firstStackId!);
		await page.keyboard.press('d');

		let handCardId: string | null = null;
		await expect
			.poll(
				async () => {
					const state = await pixiState(page);
					handCardId = state.handCardIds[0] ?? null;
					return state.handCardIds.length;
				},
				{ timeout: 20_000 }
			)
			.toBe(1);

		expect(handCardId).toBeTruthy();
		await pixiDragTo(page, handCardId!, { x: 640, y: 220 });

		await expect
			.poll(
				async () => {
					const state = await pixiState(secondPage);
					return {
						playedCardIsVisible: state.visibleBoardCardIds.includes(handCardId!),
						handCardIds: state.handCardIds
					};
				},
				{ timeout: 20_000 }
			)
			.toEqual({
				playedCardIsVisible: true,
				handCardIds: []
			});
	} finally {
		await secondContext.close();
	}
});
