import { expect, test, type Page } from '@playwright/test';
import { readOpfsText, seedProjects, writeOpfsText } from './helpers/opfs';

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

test('navigation preserves multiline svg template text between spreadsheet and layout editors', async ({
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

test('typing text in layout editor persists front svg', async ({ page }) => {
	await openWesternSvgEditor(page);
	const frontPath = '/western-cards/system/western/front.svg';
	const nextText = 'saved from layout editor e2e';

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

test('project image hrefs preview in svg editor without saving blob urls', async ({ page }) => {
	await seedProjects(page);
	await writeOpfsText(
		page,
		'/western-cards/files/dice_6.png',
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="green"/></svg>'
	);
	await page.goto('/app/games/western-cards/decks/western/editor?e2e');
	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/western\/editor/);
	await page.waitForFunction(() => {
		const global = window as Window & {
			__svgEditorApi?: unknown;
		};
		return Boolean(global.__svgEditorApi);
	});

	await expect
		.poll(() =>
			page.evaluate(() => {
				const image = document.querySelector('#dice_image');
				return image?.getAttribute('href') ?? image?.getAttribute('xlink:href') ?? '';
			})
		)
		.toMatch(/^blob:/);

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
	await page.locator('#text_multiline').evaluate((input) => {
		const textarea = input as HTMLTextAreaElement;
		textarea.value = 'image preview save e2e';
		textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
	});
	await page.waitForTimeout(1000);

	const savedFront = await readOpfsText(page, '/western-cards/system/western/front.svg');
	const diceImageTag = savedFront.match(/<image\b(?=[^>]*\bid="dice_image")[^>]*>/)?.[0] ?? '';
	expect(diceImageTag).toContain('href="../../files/dice_6.png"');
	expect(diceImageTag).not.toContain('blob:');
	expect(savedFront).not.toContain('data-digitable-original-href');
});

test('image sidebar tool adds and changes project images without broken resource URLs', async ({
	page
}) => {
	const failedImageResponses: string[] = [];
	page.on('response', (response) => {
		if (response.status() < 400) return;
		const url = response.url();
		if (
			url.includes('/files/') ||
			url.includes('editor-choice.svg') ||
			url.includes('Svg-Editor-Upload.svg')
		) {
			failedImageResponses.push(url);
		}
	});

	await seedProjects(page);
	await writeOpfsText(
		page,
		'/western-cards/files/editor-choice.svg',
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="purple"/></svg>'
	);
	await writeOpfsText(
		page,
		'/western-cards/files/editor-choice-alt.svg',
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="teal"/></svg>'
	);
	await writeOpfsText(page, '/western-cards/files/notes.txt', 'not an image');
	await page.goto('/app/games/western-cards/decks/western/editor?e2e');
	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/western\/editor/);
	await page.waitForFunction(() => {
		const global = window as Window & {
			__svgEditorApi?: unknown;
		};
		return Boolean(global.__svgEditorApi);
	});

	await expect(page.getByRole('button', { name: 'Add Image' })).not.toBeVisible();
	await page.getByRole('button', { name: 'Image', exact: true }).click();
	await expect(page.getByRole('button', { name: /editor-choice\.svg/ })).toBeVisible();
	await expect(page.getByText('notes.txt')).not.toBeVisible();
	await page.getByRole('button', { name: /editor-choice\.svg/ }).click();
	await page.getByRole('button', { name: 'Apply' }).click();

	const insertedHrefHandle = await page.waitForFunction(() => {
		const image = document.querySelector(
			'image[data-digitable-original-href="../../files/editor-choice.svg"]'
		);
		return image?.getAttribute('href') ?? image?.getAttribute('xlink:href') ?? '';
	});
	const insertedHref = await insertedHrefHandle.jsonValue();
	expect(insertedHref).toMatch(/^data:/);
	await expect
		.poll(() =>
			page.evaluate((href) => fetch(href).then((response) => response.text()), insertedHref)
		)
		.toContain('purple');
	await expect
		.poll(() => readOpfsText(page, '/western-cards/system/western/front.svg'))
		.toContain('href="../../files/editor-choice.svg"');
	await expect(page.getByLabel('File')).toHaveValue('../../files/editor-choice.svg');

	await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect
		.poll(() => readOpfsText(page, '/western-cards/system/western/front.svg'))
		.not.toContain('href="../../files/editor-choice.svg"');
	await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled();
	await page.getByRole('button', { name: 'Redo' }).click();
	await expect
		.poll(() => readOpfsText(page, '/western-cards/system/western/front.svg'))
		.toContain('href="../../files/editor-choice.svg"');

	await expect(page.getByRole('button', { name: 'Change Image' })).toBeVisible();
	await page.getByRole('button', { name: 'Change Image' }).click();
	await page.getByLabel('Upload').setInputFiles({
		name: 'Svg Editor Upload.svg',
		mimeType: 'image/svg+xml',
		buffer: Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="gold"/></svg>'
		)
	});

	const changedHrefHandle = await page.waitForFunction(() => {
		const image = document.querySelector(
			'image[data-digitable-original-href="../../files/uploads/Svg-Editor-Upload.svg"]'
		);
		return image?.getAttribute('href') ?? image?.getAttribute('xlink:href') ?? '';
	});
	const changedHref = await changedHrefHandle.jsonValue();
	expect(changedHref).toMatch(/^data:image\/svg\+xml/);
	await expect
		.poll(() =>
			page.evaluate((href) => fetch(href).then((response) => response.text()), changedHref)
		)
		.toContain('<circle');
	await expect
		.poll(() => readOpfsText(page, '/western-cards/system/western/front.svg'))
		.toContain('href="../../files/uploads/Svg-Editor-Upload.svg"');
	await expect(page.getByLabel('File')).toHaveValue('../../files/uploads/Svg-Editor-Upload.svg');
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect
		.poll(() => readOpfsText(page, '/western-cards/system/western/front.svg'))
		.toContain('href="../../files/editor-choice.svg"');
	await expect
		.poll(() => readOpfsText(page, '/western-cards/system/western/front.svg'))
		.not.toContain('href="../../files/uploads/Svg-Editor-Upload.svg"');
	await expect(page.getByLabel('File')).toHaveValue('../../files/editor-choice.svg');
	await page.getByLabel('File').fill('editor-choice-alt.svg');
	await page.getByLabel('File').press('Enter');
	const typedHrefHandle = await page.waitForFunction(() => {
		const image = document.querySelector(
			'image[data-digitable-original-href="../../files/editor-choice-alt.svg"]'
		);
		return image?.getAttribute('href') ?? image?.getAttribute('xlink:href') ?? '';
	});
	const typedHref = await typedHrefHandle.jsonValue();
	expect(typedHref).toMatch(/^data:/);
	await expect
		.poll(() => page.evaluate((href) => fetch(href).then((response) => response.text()), typedHref))
		.toContain('teal');
	await expect
		.poll(() => readOpfsText(page, '/western-cards/system/western/front.svg'))
		.toContain('href="../../files/editor-choice-alt.svg"');
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect
		.poll(() => readOpfsText(page, '/western-cards/system/western/front.svg'))
		.toContain('href="../../files/editor-choice.svg"');
	const savedFront = await readOpfsText(page, '/western-cards/system/western/front.svg');
	expect(savedFront).not.toContain('data:image');
	expect(savedFront).not.toContain('data-digitable-original-href');
	const uploaded = await readOpfsText(page, '/western-cards/files/uploads/Svg-Editor-Upload.svg');
	expect(uploaded).toContain('<circle');
	expect(failedImageResponses).toEqual([]);
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
