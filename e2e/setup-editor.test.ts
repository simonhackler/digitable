import { expect, test } from '@playwright/test';
import { readOpfsText, seedProjects } from './helpers/opfs';

type SvgEditorWindow = Window & {
	__svgEditorApi?: {
		getSvg: () => string;
	};
	__svgEditorController?: {
		selectTreeElement: (id: string) => void;
		api?: {
			_unsafe?: {
				rawCanvas: () => {
					moveSelectedElements?: (dx: number, dy: number, undoable?: boolean) => void;
				} | null;
			};
		} | null;
	};
};

test('table setup editor saves json and svg', async ({ page }) => {
	await seedProjects(page);
	await page.goto('/app/games/western-cards/setup?e2e');
	await expect(page.getByRole('heading', { name: 'Table setup' })).toBeVisible();
	await expect(page.getByRole('status')).toContainText('Loaded');

	await page.getByLabel('Preset').selectOption('two-player');
	await page.getByRole('button', { name: 'Add component' }).click();
	await page.getByRole('button', { name: /^western deck$/ }).click();
	await page.waitForFunction(() => Boolean((window as SvgEditorWindow).__svgEditorApi));
	await page.getByLabel('Component label').fill('Draw deck');
	await expect
		.poll(() =>
			page.evaluate(() => {
				const global = window as SvgEditorWindow;
				return global.__svgEditorApi?.getSvg() ?? '';
			})
		)
		.toContain('Draw deck');

	const placementId = await page.evaluate(() => {
		const global = window as SvgEditorWindow;
		const svg = global.__svgEditorApi!.getSvg();
		const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
		const placement =
			doc.querySelector('[data-label="Draw deck"]') ??
			Array.from(doc.querySelectorAll('g')).find((group) =>
				group.textContent?.includes('Draw deck')
			);
		return placement?.getAttribute('id');
	});
	expect(placementId).toBeTruthy();
	await page.evaluate((placementId) => {
		const global = window as SvgEditorWindow;
		const controller = global.__svgEditorController!;
		controller.selectTreeElement(placementId!);
		controller.api!._unsafe!.rawCanvas()!.moveSelectedElements!(120, 80, true);
	}, placementId);
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					document
						.querySelector('#selectorGrip_resize_se')
						?.parentElement?.getAttribute('display') ?? ''
			)
		)
		.toBe('none');

	await page.getByRole('button', { name: 'Add slot' }).click();
	await page.getByLabel('Slot label').fill('Ace slot');
	await page.getByRole('checkbox').first().click();

	await expect(page.getByRole('status')).toContainText('Autosaved');

	const json = JSON.parse(await readOpfsText(page, '/western-cards/setup/table.json'));
	expect(json.table).toEqual({
		presetId: 'two-player',
		width: 1200,
		height: 700
	});
	expect(json.placements).toEqual([
		expect.objectContaining({
			type: 'deck',
			deckName: 'western',
			label: 'Draw deck',
			rotation: 0,
			cardIds: expect.arrayContaining([expect.any(String)]),
			x: expect.any(Number),
			y: expect.any(Number)
		})
	]);
	expect(json.placements[0].x).toBeGreaterThan(160);
	expect(json.placements[0].y).toBeGreaterThan(160);
	expect(json.slots).toEqual([
		expect.objectContaining({
			label: 'Ace slot',
			acceptedDeckNames: expect.arrayContaining([expect.any(String)])
		})
	]);

	const svg = await readOpfsText(page, '/western-cards/setup/table.svg');
	expect(svg).toContain('viewBox="0 0 1200 700"');
	expect(svg).toContain('Ace slot');
	expect(svg).toContain('Draw deck');
	expect(svg).toContain('<image');
	expect(svg).toContain('data:image/svg+xml');
	expect(svg).toContain('data-locked="true" pointer-events="none"');
	expect(svg).toContain('data-svgedit-resizable="false"');

	await page.reload();
	await expect(page.getByRole('status')).toContainText('Loaded');
	await expect(page.getByText('Ace slot').first()).toBeVisible();
});
