import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedProjectFiles, useBrowserStorage, writeOpfsText } from './helpers/opfs';
import { pixiState, waitForPixi } from './helpers/pixi';

const here = dirname(fileURLToPath(import.meta.url));
const westernSetupFixtureDir = join(here, 'fixtures/western-cards-setup');

async function seedWesternSetupVisualProject(page: Page) {
	await page.setViewportSize({ width: 1200, height: 800 });
	await page.goto('/app/games');
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
				'71412f2b-80a5-48af-aa7d-68a525a1c872'
			].toSorted(),
			handCardIds: []
		});

});
