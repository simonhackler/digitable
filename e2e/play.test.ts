import { expect, test, type Page } from '@playwright/test';
import * as path from 'node:path';
import { seedOPFS, walkDirectory } from './helpers/opfs';
import { pixiClick, pixiDragTo, pixiState, waitForPixi } from './helpers/pixi';

async function openPixiSmokeTest(page: Page) {
	const here = path.dirname(test.info().file);
	const projectDir = path.resolve(here, '../projects/pixi-play-smoke');
	const mappings = await walkDirectory(projectDir, '/pixi-play-smoke');

	await page.goto('/app/games');
	await seedOPFS(page, mappings);

	await page.getByRole('button', { name: 'Use Browser' }).first().click();
	await page.getByRole('button', { name: 'Use Browser storage' }).click();
	await expect(page.getByRole('heading', { name: 'Board Games' })).toBeVisible();
	await expect(page.getByRole('main').getByText('pixi-play-smoke')).toBeVisible();
	await page.goto('/app/games/pixi-play-smoke/play?e2e=1');
	await waitForPixi(page);
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
