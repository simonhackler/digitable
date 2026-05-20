import { expect, test, type Page } from '@playwright/test';
import { readOpfsText, seedProjects, writeOpfsText } from './helpers/opfs';

type SvgEditorWindow = Window & {
	__svgEditorApi?: {
		getElementById?: (id: string) => Element | null;
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
	__setupEditorControllerBefore?: unknown;
};

async function expectSelectedOverlayAligned(
	page: Page,
	expectedKind: 'placement' | 'slot',
	expectedId: string
) {
	await expect
		.poll(async () => {
			const state = await page.evaluate(
				({ id, kind }) => {
					const global = window as SvgEditorWindow;
					const setupElement = global.__svgEditorApi?.getElementById?.(id) ?? null;
					const setupRoot = setupElement?.closest?.('[data-digitable-kind]') ?? setupElement;
					const selectedBox = setupElement?.ownerDocument.querySelector('#selectedBox0') ?? null;
					if (!setupRoot || !selectedBox) {
						return { aligned: false, kind: null, ready: false };
					}
					if (
						typeof (setupRoot as SVGGraphicsElement).getBBox !== 'function' ||
						typeof (setupRoot as SVGGraphicsElement).getScreenCTM !== 'function' ||
						typeof (selectedBox as SVGGraphicsElement).getBBox !== 'function' ||
						typeof (selectedBox as SVGGraphicsElement).getScreenCTM !== 'function'
					) {
						return { aligned: false, kind: null, ready: false };
					}

					const renderedRect = (element: SVGGraphicsElement) => {
						const bbox = element.getBBox();
						const matrix = element.getScreenCTM();
						const svgRoot = element.ownerSVGElement;
						if (!matrix || !svgRoot) return null;
						const points = [
							[bbox.x, bbox.y],
							[bbox.x + bbox.width, bbox.y],
							[bbox.x + bbox.width, bbox.y + bbox.height],
							[bbox.x, bbox.y + bbox.height]
						].map(([x, y]) => {
							const point = svgRoot.createSVGPoint();
							point.x = x;
							point.y = y;
							return point.matrixTransform(matrix);
						});
						const xs = points.map((point) => point.x);
						const ys = points.map((point) => point.y);
						return {
							height: Math.max(...ys) - Math.min(...ys),
							left: Math.min(...xs),
							top: Math.min(...ys),
							width: Math.max(...xs) - Math.min(...xs)
						};
					};

					const boxRect = renderedRect(selectedBox as SVGGraphicsElement);
					const setupRect = renderedRect(setupRoot as SVGGraphicsElement);
					if (!boxRect || !setupRect) return { aligned: false, kind: null, ready: false };
					const centerDeltaX = Math.abs(
						setupRect.left + setupRect.width / 2 - (boxRect.left + boxRect.width / 2)
					);
					const centerDeltaY = Math.abs(
						setupRect.top + setupRect.height / 2 - (boxRect.top + boxRect.height / 2)
					);
					const widthDelta = Math.abs(setupRect.width - boxRect.width);
					const heightDelta = Math.abs(setupRect.height - boxRect.height);
					const selectedKind = setupRoot.getAttribute('data-digitable-kind');
					return {
						aligned:
							selectedKind === kind &&
							centerDeltaX < 12 &&
							centerDeltaY < 12 &&
							widthDelta < 24 &&
							heightDelta < 24,
						centerDeltaX,
						centerDeltaY,
						boxRect,
						boxParentTransform: selectedBox.parentElement?.getAttribute('transform'),
						boxTransform: selectedBox.getAttribute('transform'),
						d: selectedBox.getAttribute('d'),
						heightDelta,
						kind: selectedKind,
						ready: true,
						setupParentTransform: setupRoot.parentElement?.getAttribute('transform'),
						setupRect,
						setupTransform: setupRoot.getAttribute('transform'),
						widthDelta
					};
				},
				{ id: expectedId, kind: expectedKind }
			);
			return state.aligned ? 'aligned' : JSON.stringify(state);
		})
		.toBe('aligned');
}

test('table setup editor saves json and svg', async ({ page }) => {
	const pointerEventSanitizeWarnings: string[] = [];
	page.on('console', (message) => {
		const text = message.text();
		if (text.includes('[sanitize] attribute pointer-events')) {
			pointerEventSanitizeWarnings.push(text);
		}
	});

	await seedProjects(page);
	await page.goto('/app/games/western-cards/setup?e2e');
	await expect(page.getByRole('heading', { name: 'Table setup' })).toBeVisible();
	await expect(page.getByRole('status')).toContainText('Loaded');

	await page.getByLabel('Preset').selectOption('two-player');
	await page.waitForFunction(() => Boolean((window as SvgEditorWindow).__svgEditorController));
	await page.evaluate(() => {
		const global = window as SvgEditorWindow;
		global.__setupEditorControllerBefore = global.__svgEditorController;
	});
	await page.getByRole('button', { name: 'Add component' }).click();
	await page.getByRole('button', { name: /^western deck$/ }).click();
	await expect
		.poll(() =>
			page.evaluate(() => {
				const global = window as SvgEditorWindow;
				return global.__setupEditorControllerBefore === global.__svgEditorController;
			})
		)
		.toBe(true);
	const placementId = await page
		.waitForFunction(() => {
			const global = window as SvgEditorWindow;
			const svg = global.__svgEditorApi?.getSvg() ?? '';
			const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
			return doc.querySelector('[data-digitable-kind="placement"]')?.getAttribute('id') ?? '';
		})
		.then((handle) => handle.jsonValue());
	expect(placementId).toBeTruthy();
	await expectSelectedOverlayAligned(page, 'placement', placementId);

	await page.getByLabel('Component label').fill('Draw deck');
	await expect
		.poll(() =>
			page.evaluate(() => {
				const global = window as SvgEditorWindow;
				return global.__svgEditorApi?.getSvg() ?? '';
			})
		)
		.toContain('Draw deck');
	await expectSelectedOverlayAligned(page, 'placement', placementId);

	await page.evaluate((placementId) => {
		const global = window as SvgEditorWindow;
		const controller = global.__svgEditorController!;
		controller.selectTreeElement(placementId);
		controller.api!._unsafe!.rawCanvas()!.moveSelectedElements!(120, 80, true);
	}, placementId);
	await expectSelectedOverlayAligned(page, 'placement', placementId);
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
	await expect
		.poll(() =>
			page.evaluate(() => {
				const global = window as SvgEditorWindow;
				return global.__setupEditorControllerBefore === global.__svgEditorController;
			})
		)
		.toBe(true);
	await expect(page.getByLabel('Slot label')).toHaveCount(0);
	const slotId = await page.evaluate(() => {
		const global = window as SvgEditorWindow;
		const svg = global.__svgEditorApi!.getSvg();
		const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
		return doc.querySelector('[data-digitable-kind="slot"]')?.getAttribute('id');
	});
	expect(slotId).toBeTruthy();
	await expectSelectedOverlayAligned(page, 'slot', slotId);
	await page.getByRole('checkbox').first().click();

	await expect(page.getByRole('status')).toContainText('Autosaved');

	const json = JSON.parse(await readOpfsText(page, '/western-cards/setup/table.json'));
	expect(json.table).toEqual({
		presetId: 'two-player',
		width: 1200,
		height: 700
	});
	const drawDeck = json.placements.find(
		(placement: { label?: string }) => placement.label === 'Draw deck'
	);
	expect(drawDeck).toEqual(
		expect.objectContaining({
			type: 'deck',
			deckName: 'western',
			label: 'Draw deck',
			rotation: 0,
			cardIds: expect.arrayContaining([expect.any(String)]),
			x: expect.any(Number),
			y: expect.any(Number)
		})
	);
	const configuredSlot = json.slots.find(
		(slot: { acceptedDeckNames?: string[] }) => (slot.acceptedDeckNames ?? []).length > 0
	);
	expect(configuredSlot).toEqual(
		expect.objectContaining({
			label: expect.stringMatching(/^Slot \d+$/),
			acceptedDeckNames: expect.arrayContaining([expect.any(String)])
		})
	);

	const svg = await readOpfsText(page, '/western-cards/setup/table.svg');
	expect(svg).toContain('viewBox="0 0 1200 700"');
	expect(svg).not.toContain('#166534');
	expect(svg).not.toContain('#bbf7d0');
	expect(svg).toContain(configuredSlot.label);
	expect(svg).toContain('Draw deck');
	expect(svg).toContain('<image');
	expect(svg).toContain('data:image/svg+xml');
	expect(svg).toContain('data-deck-stack="true"');
	expect(svg).toContain('data-locked="true"');
	expect(svg).toContain('data-svgedit-resizable="false"');
	expect(svg).not.toContain('pointer-events="none"');
	expect(pointerEventSanitizeWarnings).toEqual([]);

	await page.reload();
	await expect(page.getByRole('status')).toContainText('Loaded');
	await expect(page.getByText(configuredSlot.label).first()).toBeVisible();
	expect(pointerEventSanitizeWarnings).toEqual([]);
});

test('table setup add component survives a deck preview render failure', async ({ page }) => {
	await seedProjects(page);
	await writeOpfsText(
		page,
		'/western-cards/system/cool_deck/front.svg',
		'<svg xmlns="http://www.w3.org/2000/svg"><text id="bad-text">broken</text></svg>'
	);

	await page.goto('/app/games/western-cards/setup?e2e');
	await expect(page.getByRole('status')).toContainText('Loaded');

	await page.getByRole('button', { name: 'Add component' }).click();
	await expect(page.getByRole('button', { name: /^western deck$/ })).toBeVisible();
});
