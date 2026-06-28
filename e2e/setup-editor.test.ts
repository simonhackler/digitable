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
					getSelectedElements?: () => Element[];
					moveSelectedElements?: (dx: number, dy: number, undoable?: boolean) => void;
					selectOnly?: (elements: Element[], showGrips?: boolean) => void;
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

async function expectSetupElementPresentOnce(
	page: Page,
	expectedKind: 'placement' | 'slot',
	expectedId: string
) {
	await expect
		.poll(() =>
			page.evaluate(
				({ id, kind }) => {
					const global = window as SvgEditorWindow;
					const svg = global.__svgEditorApi?.getSvg() ?? '';
					const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
					const matchingCount = Array.from(
						doc.querySelectorAll(`[data-digitable-kind="${kind}"]`)
					).filter((element) => element.getAttribute('id') === id).length;
					return {
						exists: Boolean(global.__svgEditorApi?.getElementById?.(id)),
						matchingCount
					};
				},
				{ id: expectedId, kind: expectedKind }
			)
		)
		.toEqual({ exists: true, matchingCount: 1 });
}

test('table setup editor saves semantic svg', async ({ page }) => {
	test.setTimeout(60_000);
	const pointerEventSanitizeWarnings: string[] = [];
	page.on('console', (message) => {
		const text = message.text();
		if (text.includes('[sanitize] attribute pointer-events')) {
			pointerEventSanitizeWarnings.push(text);
		}
	});

	await seedProjects(page);
	await page.goto('/app/games/western-cards/setup?e2e');
	await expect(page.getByRole('heading', { name: 'Table' })).toBeVisible();
	await expect(page.getByRole('status')).toContainText('Loaded');

	await page.getByRole('button', { name: 'ResizeTable' }).click();
	const resizeDialog = page.getByRole('dialog', { name: 'ResizeTable' });
	await resizeDialog.getByLabel('Preset').selectOption('two-player');
	await resizeDialog.getByRole('button', { name: 'Apply' }).click();
	await expect(resizeDialog).not.toBeVisible();
	await page.waitForFunction(() => Boolean((window as SvgEditorWindow).__svgEditorController));
	await page.evaluate(() => {
		const global = window as SvgEditorWindow;
		global.__setupEditorControllerBefore = global.__svgEditorController;
	});
	await page.getByRole('button', { name: 'Add component' }).click();
	const existingPlacementIds = await page.evaluate(() => {
		const global = window as SvgEditorWindow;
		const svg = global.__svgEditorApi?.getSvg() ?? '';
		const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
		return Array.from(doc.querySelectorAll('[data-digitable-kind="placement"]')).map(
			(element) => element.getAttribute('id') ?? ''
		);
	});
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
		.waitForFunction((knownIds) => {
			const global = window as SvgEditorWindow;
			const svg = global.__svgEditorApi?.getSvg() ?? '';
			const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
			const selectedRoot =
				global.__svgEditorController?.api?._unsafe
					?.rawCanvas()
					?.getSelectedElements?.()[0]
					?.closest?.('[data-digitable-kind="placement"]')
					?.getAttribute('id') ?? '';
			if (selectedRoot && !knownIds.includes(selectedRoot)) return selectedRoot;
			return (
				Array.from(doc.querySelectorAll('[data-digitable-kind="placement"]'))
					.map((element) => element.getAttribute('id') ?? '')
					.find((id) => id && !knownIds.includes(id)) ?? ''
			);
		}, existingPlacementIds)
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
	const placementShuffleCheckbox = page.getByRole('checkbox', { name: 'Shuffle stack at start' });
	if (!(await placementShuffleCheckbox.isChecked())) {
		await placementShuffleCheckbox.click();
	}
	await expect
		.poll(() =>
			page.evaluate(() => {
				const global = window as SvgEditorWindow;
				return global.__svgEditorApi?.getSvg() ?? '';
			})
		)
		.toContain('data-initial-shuffle="true"');
	await page.evaluate((placementId) => {
		(window as SvgEditorWindow).__svgEditorController?.selectTreeElement(placementId);
	}, placementId);
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

	const existingSlotIds = await page.evaluate(() => {
		const global = window as SvgEditorWindow;
		const svg = global.__svgEditorApi?.getSvg() ?? '';
		const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
		return Array.from(doc.querySelectorAll('[data-digitable-kind="slot"]')).map(
			(element) => element.getAttribute('id') ?? ''
		);
	});
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
	const slotId = await page.evaluate((knownIds) => {
		const global = window as SvgEditorWindow;
		const svg = global.__svgEditorApi!.getSvg();
		const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
		const selectedRoot =
			global.__svgEditorController?.api?._unsafe
				?.rawCanvas()
				?.getSelectedElements?.()[0]
				?.closest?.('[data-digitable-kind="slot"]')
				?.getAttribute('id') ?? '';
		if (selectedRoot && !knownIds.includes(selectedRoot)) return selectedRoot;
		return (
			Array.from(doc.querySelectorAll('[data-digitable-kind="slot"]'))
				.map((element) => element.getAttribute('id') ?? '')
				.find((id) => id && !knownIds.includes(id)) ?? ''
		);
	}, existingSlotIds);
	expect(slotId).toBeTruthy();
	await expectSelectedOverlayAligned(page, 'slot', slotId);
	await page.evaluate((slotId) => {
		const global = window as SvgEditorWindow;
		const slot = global.__svgEditorApi!.getElementById!(slotId)!;
		const slotText = slot.querySelector('text')!;
		global.__svgEditorController!.api!._unsafe!.rawCanvas()!.selectOnly!([slotText], true);
	}, slotId);
	await expect
		.poll(() =>
			page.evaluate(() => {
				const selected =
					(window as SvgEditorWindow)
						.__svgEditorController!.api!._unsafe!.rawCanvas()!
						.getSelectedElements?.() ?? [];
				return {
					id: selected[0]?.getAttribute('id'),
					kind: selected[0]?.getAttribute('data-digitable-kind'),
					tag: selected[0]?.tagName
				};
			})
		)
		.toEqual({ id: slotId, kind: 'slot', tag: 'g' });
	const slotTextPoint = await page.evaluate((slotId) => {
		const global = window as SvgEditorWindow;
		const slot = global.__svgEditorApi!.getElementById!(slotId)!;
		const text = slot.querySelector('text') as SVGGraphicsElement;
		const rect = text.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	}, slotId);
	await page.mouse.dblclick(slotTextPoint.x, slotTextPoint.y);
	await page.keyboard.type('Edited');
	await expect
		.poll(() =>
			page.evaluate(() => {
				const svg = (window as SvgEditorWindow).__svgEditorApi!.getSvg();
				return svg.includes('Edited');
			})
		)
		.toBe(false);
	await expect
		.poll(() =>
			page.evaluate((slotId) => {
				const global = window as SvgEditorWindow;
				const slot = global.__svgEditorApi!.getElementById!(slotId)!;
				return {
					selected: global
						.__svgEditorController!.api!._unsafe!.rawCanvas()!
						.getSelectedElements?.()[0]
						?.getAttribute('id'),
					text: slot.querySelector('text')?.textContent
				};
			}, slotId)
		)
		.toEqual({ selected: slotId, text: expect.stringMatching(/^Slot \d+$/) });
	await page.getByRole('checkbox', { name: 'western', exact: true }).click();
	await expectSetupElementPresentOnce(page, 'slot', slotId);
	await expectSelectedOverlayAligned(page, 'slot', slotId);
	await page.getByLabel('Slot layout').selectOption('horizontal-flex');
	await page.getByLabel('Slot item count').fill('2');
	await page.getByLabel('Slot spacing').fill('12');
	await page.getByRole('button', { name: 'Add content' }).click();
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /^western deck$/ })
		.click();
	await expect(page.getByRole('checkbox', { name: 'Shuffle western at start' })).toBeVisible();
	await page.getByRole('checkbox', { name: 'Shuffle western at start' }).click();
	await page.getByRole('button', { name: 'Add content' }).click();
	await page
		.getByRole('dialog')
		.locator('.rounded-md', { has: page.getByRole('button', { name: /^western deck$/ }) })
		.getByRole('button')
		.nth(1)
		.click();
	await expect(page.getByText('2/2')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Add content' })).toBeDisabled();

	await expect(page.getByRole('status')).toContainText('Autosaved', { timeout: 15_000 });

	let svg = '';
	await expect
		.poll(async () => {
			try {
				svg = await readOpfsText(page, '/western-cards/setup/table.svg');
				return (
					svg.includes('viewBox="0 0 1200 700"') &&
					svg.includes('data-slot-layout-mode="horizontal-flex"')
				);
			} catch {
				return false;
			}
		})
		.toBe(true);
	const savedSetup = await page.evaluate(
		({ svg, placementId, slotId }) => {
			const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
			const root = doc.documentElement;
			const placement = root.querySelector(`#${CSS.escape(placementId)}`);
			const slot = root.querySelector(`#${CSS.escape(slotId)}`);
			const slotRect = slot?.querySelector('rect');
			return {
				table: {
					presetId: root.getAttribute('data-preset-id'),
					viewBox: root.getAttribute('viewBox')
				},
				placement: {
					type: placement?.getAttribute('data-digitable-type'),
					deckName: placement?.getAttribute('data-deck-name'),
					label: placement?.getAttribute('data-label'),
					initialShuffle: placement?.getAttribute('data-initial-shuffle'),
					cardIds: JSON.parse(placement?.getAttribute('data-card-ids') ?? '[]') as string[]
				},
				slot: {
					label: slot?.getAttribute('data-label'),
					acceptedDeckNames: JSON.parse(
						slot?.getAttribute('data-accepted-deck-names') ?? '[]'
					) as string[],
					width: Number(slotRect?.getAttribute('width')),
					height: Number(slotRect?.getAttribute('height')),
					layoutMode: slot?.getAttribute('data-slot-layout-mode'),
					visibleCount: Number(slot?.getAttribute('data-slot-visible-count')),
					gap: Number(slot?.getAttribute('data-slot-gap')),
					contents: JSON.parse(slot?.getAttribute('data-slot-contents') ?? '[]') as Array<{
						type: string;
						deckName: string;
						cardId?: string;
					}>
				}
			};
		},
		{ svg, placementId, slotId }
	);
	expect(savedSetup.table).toEqual({
		presetId: 'two-player',
		viewBox: '0 0 1200 700'
	});
	expect(savedSetup.placement).toEqual(
		expect.objectContaining({
			type: 'deck',
			deckName: 'western',
			label: 'Draw deck',
			initialShuffle: 'true',
			cardIds: expect.arrayContaining([expect.any(String)])
		})
	);
	expect(savedSetup.slot).toEqual(
		expect.objectContaining({
			label: expect.stringMatching(/^Slot \d+$/),
			acceptedDeckNames: ['western'],
			width: 138,
			height: 88,
			layoutMode: 'horizontal-flex',
			visibleCount: 2,
			gap: 12,
			contents: [
				{ type: 'deck', deckName: 'western', shuffle: true },
				expect.objectContaining({ type: 'card', deckName: 'western' })
			]
		})
	);
	expect(svg).toContain('viewBox="0 0 1200 700"');
	expect(svg).toContain('data-initial-shuffle="true"');
	expect(svg).not.toContain('#166534');
	expect(svg).not.toContain('#bbf7d0');
	expect(svg).toContain(savedSetup.slot.label ?? '');
	expect(svg).toContain('Draw deck');
	expect(svg).toContain('data-slot-layout-mode="horizontal-flex"');
	expect(svg).toContain('data-slot-contents');
	expect(svg).toContain('<image');
	expect(svg).toContain('data:image/svg+xml');
	expect(svg).toContain('data-deck-stack="true"');
	expect(svg).toContain('data-locked="true"');
	expect(svg).toContain('data-svgedit-resizable="false"');
	expect(svg).not.toContain('pointer-events="none"');
	expect(pointerEventSanitizeWarnings).toEqual([]);

	await page.reload();
	await expect(page.getByRole('status')).toContainText('Loaded');
	await page.waitForFunction(
		(id) => Boolean((window as SvgEditorWindow).__svgEditorApi?.getElementById?.(id)),
		placementId
	);
	await page.evaluate((id) => {
		(window as SvgEditorWindow).__svgEditorController?.selectTreeElement(id);
	}, placementId);
	await expect(page.getByRole('checkbox', { name: 'Shuffle stack at start' })).toBeChecked();
	await page.waitForFunction(
		(id) => Boolean((window as SvgEditorWindow).__svgEditorApi?.getElementById?.(id)),
		slotId
	);
	await page.evaluate((id) => {
		(window as SvgEditorWindow).__svgEditorController?.selectTreeElement(id);
	}, slotId);
	await expect(page.getByLabel('Slot layout')).toHaveValue('horizontal-flex');
	await expect(page.getByRole('checkbox', { name: 'Shuffle western at start' })).toBeChecked();
	await expect(page.getByText('2/2')).toBeVisible();
	expect(pointerEventSanitizeWarnings).toEqual([]);
});

test('table setup components stay non-resizable after double click', async ({ page }) => {
	await seedProjects(page);
	const placementId = 'locked-deck';
	await writeOpfsText(
		page,
		'/western-cards/setup/table.svg',
		[
			'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700" role="img" aria-label="Digitable table setup" data-digitable-table="true" data-preset-id="two-player">',
			`  <g id="${placementId}" data-digitable-kind="placement" data-digitable-type="deck" data-deck-name="western" data-card-ids='["western:c6da04fb-1955-43e1-adbc-7f4fda4b83cf"]' data-label="western" data-svgedit-resizable="false" transform="translate(240 180) rotate(0 55 75)">`,
			'    <rect x="14" y="14" width="110" height="150" rx="10" fill="#0f172a" fill-opacity="0.28" stroke="#0f172a" stroke-opacity="0.45" stroke-width="2" data-deck-stack="true" data-svgedit-resizable="false" data-locked="true"/>',
			'    <rect x="7" y="7" width="110" height="150" rx="10" fill="#f8fafc" stroke="#334155" stroke-opacity="0.65" stroke-width="2" data-deck-stack="true" data-svgedit-resizable="false" data-locked="true"/>',
			'    <rect x="0" y="0" width="110" height="150" rx="10" fill="#fef3c7" stroke="#92400e" stroke-width="2" data-svgedit-resizable="false" data-locked="true"/>',
			'    <text x="55" y="82" fill="#111827" font-family="system-ui, sans-serif" font-size="18" font-weight="700" text-anchor="middle" data-svgedit-resizable="false" data-locked="true" style="pointer-events:none;user-select:none">western</text>',
			'  </g>',
			'</svg>'
		].join('\n')
	);

	await page.goto('/app/games/western-cards/setup?e2e');
	await expect(page.getByRole('status')).toContainText('Loaded');
	await page.waitForFunction(
		(id) => Boolean((window as SvgEditorWindow).__svgEditorApi?.getElementById?.(id)),
		placementId
	);
	await page.evaluate((id) => {
		(window as SvgEditorWindow).__svgEditorController?.selectTreeElement(id);
	}, placementId);
	await expect
		.poll(() =>
			page.evaluate((id) => {
				const global = window as SvgEditorWindow;
				const selected =
					global.__svgEditorController?.api?._unsafe?.rawCanvas()?.getSelectedElements?.() ?? [];
				return selected[0]?.getAttribute('id') === id;
			}, placementId)
		)
		.toBe(true);

	const placementPoint = await page.evaluate((id) => {
		const global = window as SvgEditorWindow;
		const placement = global.__svgEditorApi!.getElementById!(id) as SVGGraphicsElement;
		const rect = placement.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	}, placementId);
	await page.mouse.dblclick(placementPoint.x, placementPoint.y);

	await expect
		.poll(() =>
			page.evaluate((id) => {
				const global = window as SvgEditorWindow;
				const selected =
					global.__svgEditorController?.api?._unsafe?.rawCanvas()?.getSelectedElements?.() ?? [];
				const selectedElement = selected[0] ?? null;
				return {
					display:
						document
							.querySelector('#selectorGrip_resize_se')
							?.parentElement?.getAttribute('display') ?? '',
					id: selectedElement?.getAttribute('id'),
					kind: selectedElement?.getAttribute('data-digitable-kind'),
					resizable: selectedElement?.getAttribute('data-svgedit-resizable'),
					tag: selectedElement?.tagName,
					expectedId: id
				};
			}, placementId)
		)
		.toEqual({
			display: 'none',
			id: placementId,
			kind: 'placement',
			resizable: 'false',
			tag: 'g',
			expectedId: placementId
		});

	const beforeResize = await page.evaluate((id) => {
		return (window as SvgEditorWindow).__svgEditorApi?.getElementById?.(id)?.outerHTML ?? '';
	}, placementId);
	const resizeGripPoint = await page.evaluate(() => {
		const grip = document.querySelector('#selectorGrip_resize_se');
		if (!(grip instanceof SVGGraphicsElement)) return null;
		// Recreate the broken state where resize handles become visible for a locked setup item.
		grip.parentElement?.removeAttribute('display');
		const rect = grip.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	});
	expect(resizeGripPoint).toBeTruthy();
	await page.mouse.move(resizeGripPoint!.x, resizeGripPoint!.y);
	await page.mouse.down();
	await page.mouse.move(resizeGripPoint!.x + 80, resizeGripPoint!.y + 60);
	await page.mouse.up();
	await expect
		.poll(() =>
			page.evaluate((id) => {
				return (window as SvgEditorWindow).__svgEditorApi?.getElementById?.(id)?.outerHTML ?? '';
			}, placementId)
		)
		.toBe(beforeResize);

	await page.getByRole('tab', { name: 'Inspector' }).click();
	await expect(page.locator('#inspector-width')).toBeDisabled();
	await expect(page.locator('#inspector-height')).toBeDisabled();
});

test('table setup resizes the table canvas without scaling contents', async ({ page }) => {
	await seedProjects(page);
	const slotId = 'resize-slot';
	await writeOpfsText(
		page,
		'/western-cards/setup/table.svg',
		[
			'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700" role="img" aria-label="Digitable table setup" data-digitable-table="true" data-preset-id="two-player">',
			`  <g id="${slotId}" data-digitable-kind="slot" data-label="Resize slot" data-accepted-deck-names="[]" data-accepted-card-ids="[]" data-slot-layout-mode="free" transform="translate(140 160)">`,
			'    <rect x="0" y="0" width="240" height="320" rx="14" fill="#dbeafe" fill-opacity="0.32" stroke="#2563eb" stroke-width="4" stroke-dasharray="14 10"/>',
			'    <text x="16" y="32" fill="#1e3a8a" font-family="system-ui, sans-serif" font-size="28" font-weight="700" data-svgedit-resizable="false" data-locked="true" style="pointer-events:none;user-select:none">Resize slot</text>',
			'  </g>',
			'</svg>'
		].join('\n')
	);

	await page.goto('/app/games/western-cards/setup?e2e');
	await expect(page.getByRole('status')).toContainText('Loaded');
	await page.waitForFunction(
		(id) => Boolean((window as SvgEditorWindow).__svgEditorApi?.getElementById?.(id)),
		slotId
	);
	await page.getByRole('button', { name: 'ResizeTable' }).click();
	const dialog = page.getByRole('dialog', { name: 'ResizeTable' });
	await dialog.getByLabel('Preset').selectOption('six-player');
	await expect(dialog.getByLabel('Table width')).toHaveValue('1800');
	await expect(dialog.getByLabel('Table height')).toHaveValue('1000');
	await dialog.getByLabel('Table width').fill('1600');
	await dialog.getByLabel('Table height').fill('900');
	await dialog.getByRole('button', { name: 'Apply' }).click();

	await expect
		.poll(() =>
			page.evaluate((id) => {
				const global = window as SvgEditorWindow;
				const svg = global.__svgEditorApi?.getSvg() ?? '';
				const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
				const root = doc.documentElement;
				const slot = global.__svgEditorApi?.getElementById?.(id);
				const rect = slot?.querySelector('rect');
				return {
					width: root.getAttribute('width'),
					height: root.getAttribute('height'),
					presetId: root.getAttribute('data-preset-id'),
					slotTransform: slot?.getAttribute('transform'),
					slotRect: {
						x: rect?.getAttribute('x'),
						y: rect?.getAttribute('y'),
						width: rect?.getAttribute('width'),
						height: rect?.getAttribute('height')
					}
				};
			}, slotId)
		)
		.toEqual({
			width: '1600',
			height: '900',
			presetId: 'custom',
			slotTransform: 'translate(140 160)',
			slotRect: {
				x: '0',
				y: '0',
				width: '240',
				height: '320'
			}
		});

	await expect(page.getByRole('status')).toContainText('Autosaved', { timeout: 15_000 });
	const svg = await readOpfsText(page, '/western-cards/setup/table.svg');
	const saved = await page.evaluate(
		({ svg, slotId }) => {
			const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
			const root = doc.documentElement;
			const slot = root.querySelector(`#${CSS.escape(slotId)}`);
			const rect = slot?.querySelector('rect');
			return {
				width: root.getAttribute('width'),
				height: root.getAttribute('height'),
				viewBox: root.getAttribute('viewBox'),
				presetId: root.getAttribute('data-preset-id'),
				slotTransform: slot?.getAttribute('transform'),
				slotRect: {
					x: rect?.getAttribute('x'),
					y: rect?.getAttribute('y'),
					width: rect?.getAttribute('width'),
					height: rect?.getAttribute('height')
				}
			};
		},
		{ svg, slotId }
	);
	expect(saved).toEqual({
		width: '1600',
		height: '900',
		viewBox: '0 0 1600 900',
		presetId: 'custom',
		slotTransform: 'translate(140 160)',
		slotRect: {
			x: '0',
			y: '0',
			width: '240',
			height: '320'
		}
	});
});

test('table setup preserves slot rotation on autosave', async ({ page }) => {
	await seedProjects(page);

	await writeOpfsText(
		page,
		'/western-cards/setup/table.svg',
		[
			'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="Digitable table setup" data-digitable-table="true" data-preset-id="custom">',
			'  <g id="rotated-slot" data-digitable-kind="slot" data-label="Rotated slot" data-accepted-deck-names="[]" data-accepted-card-ids="[]" data-slot-layout-mode="free" transform="matrix(0.866025 0.5 -0.5 0.866025 189.737 85.096)">',
			'    <rect x="0" y="0" width="220" height="300" rx="14" fill="#dbeafe" fill-opacity="0.32" stroke="#2563eb" stroke-width="4" stroke-dasharray="14 10"/>',
			'    <text x="16" y="32" fill="#1e3a8a" font-family="system-ui, sans-serif" font-size="28" font-weight="700" data-svgedit-resizable="false" data-locked="true" style="pointer-events:none;user-select:none">Rotated slot</text>',
			'  </g>',
			'</svg>'
		].join('\n')
	);

	await page.goto('/app/games/western-cards/setup?e2e');
	await expect(page.getByRole('status')).toContainText('Loaded');
	await page.waitForFunction(() =>
		Boolean((window as SvgEditorWindow).__svgEditorApi?.getElementById?.('rotated-slot'))
	);
	await page.evaluate(() => {
		(window as SvgEditorWindow).__svgEditorController?.selectTreeElement('rotated-slot');
	});
	await page.getByRole('checkbox').first().click();
	await expect(page.getByRole('status')).toContainText('Autosaved');

	const svg = await readOpfsText(page, '/western-cards/setup/table.svg');
	const slot = await page.evaluate((svg) => {
		const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
		const slot = doc.querySelector('#rotated-slot');
		return {
			transform: slot?.getAttribute('transform'),
			acceptedDeckNames: JSON.parse(slot?.getAttribute('data-accepted-deck-names') ?? '[]')
		};
	}, svg);
	expect(slot).toEqual(
		expect.objectContaining({
			transform: 'matrix(0.866025 0.5 -0.5 0.866025 189.737 85.096)',
			acceptedDeckNames: expect.arrayContaining([expect.any(String)])
		})
	);
});
