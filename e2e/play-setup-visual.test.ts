import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	openOpfsSeedPage,
	seedProjectFiles,
	useBrowserStorage,
	writeOpfsText
} from './helpers/opfs';
import { pixiContentBounds, pixiSlotPoint, pixiState, waitForPixi } from './helpers/pixi';

const here = dirname(fileURLToPath(import.meta.url));
const westernSetupFixtureDir = join(here, 'fixtures/western-cards-setup');

async function seedWesternSetupVisualProject(page: Page) {
	await page.setViewportSize({ width: 1200, height: 800 });
	await openOpfsSeedPage(page);
	await seedProjectFiles(page, 'western-cards');
	await writeOpfsText(
		page,
		'/western-cards/setup/table.svg',
		await readFile(join(westernSetupFixtureDir, 'table.svg'), 'utf8')
	);
	await useBrowserStorage(page);
}

test('local play renders copied western table setup', async ({ page }) => {
	test.setTimeout(60_000);
	await seedWesternSetupVisualProject(page);

	await page.goto('/app/games/western-cards/play?e2e=1');
	await waitForPixi(page);
	await expect
		.poll(
			async () => {
				const state = await pixiState(page);
				return {
					visibleStackIds: state.visibleStackIds.toSorted(),
					visibleBoardCardIds: state.visibleBoardCardIds.toSorted(),
					handCardIds: state.handCardIds
				};
			},
			{ timeout: 20_000 }
		)
		.toEqual({
			visibleStackIds: ['5b5bf734-861d-4e33-8c7a-a04c7e9b5492'],
			visibleBoardCardIds: [
				'5f408ad5-6799-4258-b4bd-c7c8a570c97b',
				'c6da04fb-1955-43e1-adbc-7f4fda4b83cf',
				'824db35c-0f48-4c01-b955-de6a83c1aa29'
			].toSorted(),
			handCardIds: []
		});

	const slotCenter = await pixiSlotPoint(page, '4175838d-2b1d-4d6e-8602-00d7c0a9d6b8');
	const slotCardBounds = await pixiContentBounds(page, 'c6da04fb-1955-43e1-adbc-7f4fda4b83cf');
	expect(Math.abs(slotCardBounds.centerX - slotCenter.x)).toBeLessThanOrEqual(2);
	expect(Math.abs(slotCardBounds.centerY - slotCenter.y)).toBeLessThanOrEqual(2);

	const gridSlotCenter = await pixiSlotPoint(page, '7898b02a-0640-459f-b5ef-ae3731000f56', 2);
	const gridSlotCardBounds = await pixiContentBounds(page, '824db35c-0f48-4c01-b955-de6a83c1aa29');
	expect(Math.abs(gridSlotCardBounds.centerX - gridSlotCenter.x)).toBeLessThanOrEqual(2);
	expect(Math.abs(gridSlotCardBounds.centerY - gridSlotCenter.y)).toBeLessThanOrEqual(2);
});
