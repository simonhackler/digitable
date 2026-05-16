import { expect, test, type Page } from '@playwright/test';
import { readOpfsText, seedProjects } from './helpers/opfs';

async function openWesternSvgEditor(page: Page) {
	await seedProjects(page);
	await page.getByRole('main').getByText('western-cards').click();
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.goto('/app/games/western-cards/decks/western/editor?e2e');
	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/western\/editor/);
	await page.waitForFunction(() => {
		const global = window as Window & {
			__svgEditorApi?: unknown;
		};
		return Boolean(global.__svgEditorApi);
	});
}

async function editorSvg(page: Page) {
	await page.waitForFunction(() => {
		const global = window as Window & {
			__svgEditorApi?: { getSvg: () => string } | null;
		};
		return Boolean(global.__svgEditorApi);
	});
	return page.evaluate(() => {
		const global = window as Window & {
			__svgEditorApi?: { getSvg: () => string } | null;
		};
		return global.__svgEditorApi!.getSvg();
	});
}

async function selectEffectZone(page: Page) {
	await page.evaluate(() => {
		const global = window as Window & {
			__svgEditorApi?: {
				selectElementById: (id: string) => void;
			} | null;
		};
		global.__svgEditorApi!.selectElementById('effect_zone');
	});
}

async function selectElement(page: Page, id: string) {
	await page.evaluate((id) => {
		const global = window as Window & {
			__svgEditorApi?: {
				selectElementById: (id: string) => void;
			} | null;
		};
		global.__svgEditorApi!.selectElementById(id);
	}, id);
}

async function treeIdForElement(page: Page, elementId: string) {
	return page.evaluate((elementId) => {
		const global = window as Window & {
			__svgEditorController?: {
				elementTree: Array<{
					id: string;
					elementRef?: Element;
					children?: unknown[];
				}>;
			};
		};
		const visit = (
			nodes: Array<{ id: string; elementRef?: Element; children?: unknown[] }>
		): string | null => {
			for (const node of nodes) {
				if (node.elementRef?.getAttribute('id') === elementId) return node.id;
				const childId = visit(
					(node.children ?? []) as Array<{
						id: string;
						elementRef?: Element;
						children?: unknown[];
					}>
				);
				if (childId) return childId;
			}
			return null;
		};
		return visit(global.__svgEditorController?.elementTree ?? []);
	}, elementId);
}

async function editEffectZoneText(page: Page) {
	await page.evaluate(() => {
		const global = window as Window & {
			__svgEditorApi?: {
				getElementById: (id: string) => Element | null;
				_unsafe?: {
					rawCanvas: () => {
						textActions?: {
							select?: (target: Element, x: number, y: number) => void;
						};
					} | null;
				};
			} | null;
		};
		const api = global.__svgEditorApi!;
		const text = api.getElementById('effect_zone');
		if (!text) throw new Error('effect_zone not found');
		api._unsafe?.rawCanvas()?.textActions?.select?.(text, 0, 0);
	});
	await expect
		.poll(() =>
			page.locator('#text_multiline').evaluate((input) => getComputedStyle(input).display)
		)
		.toBe('block');
}

test('navigation preserves multiline svg template text between data and svg editors', async ({
	page
}) => {
	await seedProjects(page);
	const frontPath = '/western-cards/system/western/front.svg';
	const originalFront = await readOpfsText(page, frontPath);
	expect(originalFront).toContain('data-svgedit-multiline="true"');
	expect(originalFront).toContain('data-svgedit-raw-text="Sfds f"');
	expect(originalFront).toContain('<tspan');

	await page.getByRole('main').getByText('western-cards').click();
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.goto('/app/games/western-cards/decks/western/editor?e2e');
	const editorLoadedFront = await editorSvg(page);
	expect(editorLoadedFront).toContain('data-svgedit-multiline="true"');
	expect(editorLoadedFront).toContain('data-svgedit-raw-text="Sfds f"');
	expect(editorLoadedFront).toContain('<tspan');

	await page.goto('/app/games/western-cards/decks/western/data');
	await page.locator('tbody > tr > td:nth-child(8)').first().dblclick();
	await page.getByRole('textbox').fill('preserve multiline e2e');
	await page.keyboard.press('Enter');
	await expect(page.getByText('Saved')).toBeVisible();
	await page.goto('/app/games/western-cards/decks/western/editor?e2e');
	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/western\/editor/);
	await page.waitForTimeout(1000);

	const roundTrippedEditorFront = await editorSvg(page);
	expect(roundTrippedEditorFront).toContain('data-svgedit-multiline="true"');
	expect(roundTrippedEditorFront).toContain('data-svgedit-raw-text="Sfds f"');
	expect(roundTrippedEditorFront).toContain('<tspan');

	const roundTrippedFront = await readOpfsText(page, frontPath);
	expect(roundTrippedFront).toContain('data-svgedit-multiline="true"');
	expect(roundTrippedFront).toContain('data-svgedit-raw-text="Sfds f"');
	expect(roundTrippedFront).toContain('<tspan');
});

test('typing text in svg editor persists front svg', async ({ page }) => {
	await openWesternSvgEditor(page);
	const frontPath = '/western-cards/system/western/front.svg';
	const nextText = 'saved from svg editor e2e';

	await page.evaluate(() => {
		const global = window as Window & {
			__svgEditorApi?: {
				selectElementById: (id: string) => void;
				setMode: (mode: string) => void;
			} | null;
		};
		const api = global.__svgEditorApi!;
		api.selectElementById('effect_zone');
		api.setMode('text');
	});
	await page.locator('#text_multiline').evaluate((input, value) => {
		const textarea = input as HTMLTextAreaElement;
		textarea.value = value;
		textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
	}, nextText);
	await expect.poll(() => editorSvg(page)).toContain(nextText);
	await page.waitForTimeout(1000);

	const savedFront = await readOpfsText(page, frontPath);
	expect(savedFront).toContain(nextText);
	expect(savedFront).toContain(`data-svgedit-raw-text="${nextText}"`);
});

test('entering multiline text edit preserves changed text alignment', async ({ page }) => {
	await openWesternSvgEditor(page);
	await selectEffectZone(page);

	await page.getByRole('button', { name: 'Align text right' }).click();
	await expect(page.getByRole('button', { name: 'Align text right' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect
		.poll(() =>
			page.evaluate(() => {
				const text = document.querySelector('#effect_zone');
				const line = text?.querySelector('tspan');
				return Number(line?.getAttribute('x') ?? 0) > Number(text?.getAttribute('x') ?? 0);
			})
		)
		.toBe(true);

	await editEffectZoneText(page);
	await expect
		.poll(() =>
			page.locator('#text_multiline').evaluate((input) => getComputedStyle(input).textAlign)
		)
		.toBe('right');
	await expect(page.getByRole('button', { name: 'Align text right' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.locator('#text_multiline').focus();
	await page.keyboard.press('Control+A');
	await page.keyboard.type('typed while right aligned');
	await expect
		.poll(() =>
			page.evaluate(() => {
				const text = document.querySelector('#effect_zone');
				const line = text?.querySelector('tspan');
				return Number(line?.getAttribute('x') ?? 0) > Number(text?.getAttribute('x') ?? 0);
			})
		)
		.toBe(true);
	await expect
		.poll(() =>
			page.evaluate(() => document.querySelector('#effect_zone')?.getAttribute('text-align'))
		)
		.toBe('right');
	await expect(page.getByRole('button', { name: 'Align text right' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('typing after changing multiline alignment in edit mode keeps new alignment', async ({
	page
}) => {
	await openWesternSvgEditor(page);
	await editEffectZoneText(page);

	await page.getByRole('button', { name: 'Align text center' }).click();
	await expect(page.getByRole('button', { name: 'Align text center' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.locator('#text_multiline').focus();
	await page.keyboard.press('Control+A');
	await page.keyboard.type('xxxx xxxx');

	await expect
		.poll(() =>
			page.evaluate(() => document.querySelector('#effect_zone')?.getAttribute('text-align'))
		)
		.toBe('center');
});

test('rotation input changes selected element rotation', async ({ page }) => {
	await openWesternSvgEditor(page);
	await selectElement(page, 'dice_image');

	const rotationInput = page.getByLabel('Rotation');
	await expect(rotationInput).toBeVisible();
	await expect
		.poll(async () => (await rotationInput.boundingBox())?.width ?? 0)
		.toBeGreaterThan(40);
	await rotationInput.fill('27');
	await rotationInput.press('Enter');

	await expect
		.poll(() =>
			page.evaluate(() => document.querySelector('#dice_image')?.getAttribute('transform') ?? '')
		)
		.toContain('rotate(27');
});

test('structure tree edit accepts h and l and commits text on Enter', async ({ page }) => {
	await openWesternSvgEditor(page);
	await selectEffectZone(page);

	const treeId = await treeIdForElement(page, 'effect_zone');
	expect(treeId).toBeTruthy();
	await page.locator(`[data-row-id="${treeId}"] button[aria-label="Rename element"]`).click();
	const input = page.locator('[data-structure-tree] input').first();
	await expect(input).toBeVisible();

	await input.fill('hello hill');
	await input.press('Enter');

	await expect
		.poll(() => page.evaluate(() => document.querySelector('#effect_zone')?.textContent ?? ''))
		.toContain('hello hill');
	await expect
		.poll(() =>
			page.evaluate(() => document.querySelector('#effect_zone')?.getAttribute('display'))
		)
		.not.toBe('none');
	await expect
		.poll(() =>
			page.evaluate(() => document.querySelector('#effect_zone')?.getAttribute('data-locked'))
		)
		.not.toBe('true');
});
