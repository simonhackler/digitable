import { expect, test, type Page } from '@playwright/test';
import { newAuthenticatedPage } from './helpers/auth';
import { seedProjectFiles, useBrowserStorage } from './helpers/opfs';
import { pixiClick, pixiDragTo, pixiPoint, pixiState, waitForPixi } from './helpers/pixi';

const playtestAppOrigin = process.env.PLAYTEST_APP_ORIGIN ?? '';

function appPath(pathname: string) {
	return `${playtestAppOrigin}/app${pathname}`;
}

async function openPixiProject(page: Page, projectSlug: string) {
	await page.goto('/app/games');
	await seedProjectFiles(page, projectSlug);

	await useBrowserStorage(page);
	await expect(page.getByRole('heading', { name: 'Board Games' })).toBeVisible();
	await expect(page.getByRole('main').getByText(projectSlug)).toBeVisible();
	await page.goto(`/app/games/${projectSlug}/play?e2e=1`);
	await waitForPixi(page);
}

async function seedPixiProject(page: Page, projectSlug: string) {
	await page.goto('/app/games');
	await seedProjectFiles(page, projectSlug);
	await useBrowserStorage(page);
	await expect(page.getByRole('heading', { name: 'Board Games' })).toBeVisible();
	await expect(page.getByRole('main').getByText(projectSlug)).toBeVisible();
}

async function openPixiSmokeTest(page: Page) {
	await openPixiProject(page, 'pixi-play-smoke');
}

async function canvasPoint(page: Page, point: { x: number; y: number }) {
	const box = await page.locator('canvas').boundingBox();
	if (!box) {
		throw new Error('Canvas is not visible');
	}
	return {
		x: box.x + point.x,
		y: box.y + point.y
	};
}

async function drawStrokeOnItem(page: Page, id: string) {
	const point = await pixiPoint(page, id);
	const start = await canvasPoint(page, { x: point.x - 10, y: point.y - 8 });
	const end = await canvasPoint(page, { x: point.x + 10, y: point.y + 8 });

	await page.getByRole('button', { name: 'Pen tool' }).click();
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(end.x, end.y, { steps: 2 });
	await page.mouse.up();
	await page.getByRole('button', { name: 'Select tool' }).click();
}

test('card strokes are synced to the card and can be deleted', async ({ page }) => {
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

	let boardCardId: string | null = null;
	await expect
		.poll(
			async () => {
				const state = await pixiState(page);
				boardCardId = state.visibleBoardCardIds[0] ?? null;
				return state.visibleBoardCardIds.length;
			},
			{ timeout: 20_000 }
		)
		.toBe(1);

	expect(boardCardId).toBeTruthy();
	await drawStrokeOnItem(page, boardCardId!);

	let strokeId: string | null = null;
	await expect
		.poll(
			async () => {
				const state = await pixiState(page);
				strokeId = state.strokes[0]?.id ?? null;
				return state.strokes.map((stroke) => ({
					componentId: stroke.componentId,
					parentId: stroke.parentId,
					visible: stroke.visible,
					face: stroke.face,
					hasPoints: stroke.points > 1
				}));
			},
			{ timeout: 20_000 }
		)
		.toEqual([
			{
				componentId: boardCardId,
				parentId: boardCardId,
				visible: true,
				face: 'back',
				hasPoints: true
			}
		]);

	await pixiDragTo(page, boardCardId!, { x: 640, y: 220 });

	await expect
		.poll(async () => {
			const state = await pixiState(page);
			return state.strokes[0]?.parentId;
		})
		.toBe(boardCardId);

	const point = await pixiPoint(page, boardCardId!);
	const click = await canvasPoint(page, point);
	await page.mouse.click(click.x, click.y);
	await page.getByRole('button', { name: 'Delete selected stroke' }).click();

	expect(strokeId).toBeTruthy();
	await expect
		.poll(async () => {
			const state = await pixiState(page);
			return state.strokes.some((stroke) => stroke.id === strokeId);
		})
		.toBe(false);
});

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

test('western-cards play mode loads playable cards within benchmark budget', async ({ page }) => {
	test.setTimeout(90_000);
	const coldPlayBudgetMs = 45_000;

	const seedStart = performance.now();
	await seedPixiProject(page, 'western-cards');
	const seedMs = performance.now() - seedStart;
	console.log(`western-cards OPFS seed benchmark: ${Math.round(seedMs)}ms`);
	test.info().annotations.push({
		type: 'benchmark',
		description: `western-cards OPFS seed ${Math.round(seedMs)}ms`
	});

	const pageErrors: string[] = [];
	const relevantConsoleIssues: string[] = [];
	page.on('pageerror', (error) => {
		pageErrors.push(error.message);
	});
	page.on('console', (message) => {
		const text = message.text();
		if (text.includes('await_waterfall') || text.includes('Card not found in hybrid results')) {
			relevantConsoleIssues.push(text);
		}
	});

	const start = performance.now();
	await page.goto('/app/games/western-cards/play?e2e=1');
	await waitForPixi(page);

	let firstStackId: string | null = null;
	await expect
		.poll(
			async () => {
				const state = await pixiState(page);
				firstStackId = state.visibleStackIds[0] ?? null;
				return state.visibleStackIds.length;
			},
			{ timeout: coldPlayBudgetMs }
		)
		.toBeGreaterThan(0);

	expect(firstStackId).toBeTruthy();
	await pixiClick(page, firstStackId!);
	await page.keyboard.press('d');
	await expect
		.poll(async () => {
			const state = await pixiState(page);
			return state.handCardIds.length;
		})
		.toBeGreaterThan(0);

	const loadMs = performance.now() - start;
	console.log(`western-cards play load benchmark: ${Math.round(loadMs)}ms`);
	test.info().annotations.push({
		type: 'benchmark',
		description: `western-cards play load ${Math.round(loadMs)}ms`
	});
	expect(pageErrors).toEqual([]);
	expect(relevantConsoleIssues).toEqual([]);
	expect(loadMs).toBeLessThan(coldPlayBudgetMs);
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

	await pixiClick(page, handCardId!);

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

test('playtest invite imports the project and opens playable cards', async ({
	browser
}, testInfo) => {
	test.setTimeout(90_000);
	const { context, page } = await newAuthenticatedPage(browser, testInfo);

	try {
		await page.goto(appPath('/games'));
		await seedProjectFiles(page, 'pixi-play-smoke');
		await useBrowserStorage(page);
		await expect(page.getByRole('main').getByText('pixi-play-smoke')).toBeVisible();

		await page.getByRole('button', { name: 'Playtest' }).click();
		const inviteInput = page.getByLabel('Playtest invite link');
		await expect(inviteInput).toHaveValue(/\/app\/playtests\/[0-9a-f-]+/);
		const inviteUrl = await inviteInput.inputValue();

		await page.goto(`${inviteUrl}?e2e=1`);
		await expect(page).toHaveURL(/\/app\/playtests\/[0-9a-f-]+\?e2e=1$/);
		await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
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
	} finally {
		await context.close();
	}
});

test('playtest invitees share private room state', async ({ browser }, testInfo) => {
	test.setTimeout(120_000);
	const owner = await newAuthenticatedPage(browser, testInfo, 'owner');
	let invitee: Awaited<ReturnType<typeof newAuthenticatedPage>> | null = null;

	try {
		invitee = await newAuthenticatedPage(browser, testInfo, 'invitee');
		const page = owner.page;
		const secondPage = invitee.page;

		await page.goto(appPath('/games'));
		await seedProjectFiles(page, 'pixi-play-smoke');
		await useBrowserStorage(page);
		await expect(page.getByRole('main').getByText('pixi-play-smoke')).toBeVisible();

		await page.getByRole('button', { name: 'Playtest' }).click();
		const inviteInput = page.getByLabel('Playtest invite link');
		await expect(inviteInput).toHaveValue(/\/app\/playtests\/[0-9a-f-]+/);
		const inviteUrl = await inviteInput.inputValue();

		await page.goto(`${inviteUrl}?e2e=1`);
		await expect(page).toHaveURL(/\/app\/playtests\/[0-9a-f-]+\?e2e=1$/);
		await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
		await waitForPixi(page);

		await secondPage.goto(`${inviteUrl}?e2e=1`);
		await expect(secondPage).toHaveURL(/\/app\/playtests\/[0-9a-f-]+\?e2e=1$/);
		await expect(secondPage.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
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
		await invitee?.context.close();
		await owner.context.close();
	}
});
