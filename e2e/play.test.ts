import { expect, test, type Page } from '@playwright/test';
import {
	openOpfsSeedPage,
	saveOpfsStoragePreference,
	seedProjectFiles,
	writeOpfsText
} from './helpers/opfs';
import {
	pixiBounds,
	pixiClick,
	pixiContentBounds,
	pixiDragTo,
	pixiPoint,
	pixiSlotPoint,
	pixiState,
	waitForPixi
} from './helpers/pixi';

const playtestAppOrigin = process.env.PLAYTEST_APP_ORIGIN ?? '';

function appPath(pathname: string) {
	return `${playtestAppOrigin}/app${pathname}`;
}

async function openPixiProject(page: Page, projectSlug: string) {
	await seedPixiProject(page, projectSlug);
	await page.goto(`/app/games/${projectSlug}/play?e2e=1`);
	await waitForPixi(page);
}

async function seedPixiProject(page: Page, projectSlug: string) {
	await openOpfsSeedPage(page);
	await seedProjectFiles(page, projectSlug);
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games');
	await expect(page.getByRole('heading', { name: 'Board Games' })).toBeVisible();
	await expect(page.getByRole('main').getByText(projectSlug)).toBeVisible();
}

async function openPixiSmokeTest(page: Page) {
	await openPixiProject(page, 'pixi-play-smoke');
}

async function playSurfaceMetrics(page: Page) {
	return page.evaluate(() => {
		const canvas = document.querySelector('canvas');
		const parent = canvas?.parentElement;
		if (!canvas || !parent) return null;
		const canvasRect = canvas.getBoundingClientRect();
		const parentRect = parent.getBoundingClientRect();
		const doc = document.documentElement;
		return {
			canvasHeight: canvasRect.height,
			canvasWidth: canvasRect.width,
			documentHeight: doc.scrollHeight,
			documentWidth: doc.scrollWidth,
			parentHeight: parentRect.height,
			parentWidth: parentRect.width,
			viewportHeight: window.innerHeight,
			viewportWidth: window.innerWidth
		};
	});
}

async function expectPlaySurfaceFitsViewport(page: Page) {
	await expect
		.poll(async () => {
			const metrics = await playSurfaceMetrics(page);
			if (!metrics) return null;
			return {
				canvasMatchesParent:
					Math.abs(metrics.canvasWidth - metrics.parentWidth) <= 1 &&
					Math.abs(metrics.canvasHeight - metrics.parentHeight) <= 1,
				hasHorizontalOverflow: metrics.documentWidth > metrics.viewportWidth + 1,
				hasVerticalOverflow: metrics.documentHeight > metrics.viewportHeight + 1
			};
		})
		.toEqual({
			canvasMatchesParent: true,
			hasHorizontalOverflow: false,
			hasVerticalOverflow: false
		});
}

async function pixiAspectRatio(page: Page, id: string) {
	const bounds = await pixiBounds(page, id);
	return bounds.width / bounds.height;
}

function escapeSvgAttribute(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function placementSvg(input: {
	id: string;
	type: 'deck' | 'card';
	deckName: string;
	label: string;
	x: number;
	y: number;
	rotation?: number;
	cardIds?: string[];
	cardId?: string;
}) {
	const visualX = input.x - 55;
	const visualY = input.y - 75;
	const cardAttr =
		input.type === 'card' ? ` data-card-id="${escapeSvgAttribute(input.cardId ?? '')}"` : '';
	const deckAttr =
		input.type === 'deck'
			? ` data-card-ids="${escapeSvgAttribute(JSON.stringify(input.cardIds ?? []))}"`
			: '';
	return [
		`  <g id="${escapeSvgAttribute(input.id)}" data-digitable-kind="placement" data-digitable-type="${input.type}" data-deck-name="${escapeSvgAttribute(input.deckName)}"${cardAttr}${deckAttr} data-label="${escapeSvgAttribute(input.label)}" data-svgedit-resizable="false" transform="translate(${visualX} ${visualY}) rotate(${input.rotation ?? 0} 55 75)">`,
		'    <rect x="0" y="0" width="110" height="150" rx="10"/>',
		'  </g>'
	].join('\n');
}

const setupPlayProjectSlug = 'setup-play-smoke';
const setupPlayDeckName = 'western';

const setupPlayCards = {
	initDeck: 'init-deck-card',
	initSlot: 'init-slot-card',
	initTable: 'init-table-card',
	rotationTable: 'rotation-table-card',
	rotationSlot: 'rotation-slot-card',
	cameraFiller: 'camera-filler-card',
	cameraDraw: 'camera-draw-card',
	flipTable: 'flip-table-card',
	acceptFiller: 'accept-filler-card',
	acceptDraw: 'accept-draw-card',
	stackFillerOne: 'stack-filler-one-card',
	stackFillerTwo: 'stack-filler-two-card',
	stackDraw: 'stack-draw-card',
	rejectFiller: 'reject-filler-card',
	rejectDraw: 'reject-draw-card',
	rejectAcceptedOther: 'reject-accepted-other-card',
	dragFiller: 'drag-filler-card',
	dragDraw: 'drag-draw-card'
} as const;

function setupPlayCardId(cardId: string) {
	return `${setupPlayDeckName}:${cardId}`;
}

function setupSlotCellTargetId(slotId: string, cellIndex = 0) {
	return `${slotId}:cell:${cellIndex}`;
}

function setupSlotSvg(input: {
	id: string;
	label: string;
	x: number;
	y: number;
	rotation?: number;
	acceptedCardIds?: string[];
	slotContents?: { type: 'card'; deckName: string; cardId: string }[];
}) {
	const slotContents = escapeSvgAttribute(JSON.stringify(input.slotContents ?? []));
	const acceptedCardIds = escapeSvgAttribute(JSON.stringify(input.acceptedCardIds ?? []));
	return [
		`  <g id="${escapeSvgAttribute(input.id)}" data-digitable-kind="slot" data-label="${escapeSvgAttribute(input.label)}" data-accepted-deck-names="[]" data-accepted-card-ids="${acceptedCardIds}" data-slot-layout-mode="horizontal-flex" data-slot-visible-count="2" data-slot-gap="16" data-slot-card-size="content-card" data-slot-contents="${slotContents}" data-svgedit-resizable="false" transform="translate(${input.x} ${input.y}) rotate(${input.rotation ?? 0} 118 75)">`,
		'    <rect x="0" y="0" width="236" height="150" rx="12"/>',
		'  </g>'
	].join('\n');
}

function sharedSetupTableSvg() {
	const c = setupPlayCards;
	const deckPlacement = (id: string, label: string, x: number, y: number, cardIds: string[]) =>
		placementSvg({
			id,
			type: 'deck',
			deckName: setupPlayDeckName,
			cardIds: cardIds.map(setupPlayCardId),
			x,
			y,
			label
		});
	const cardPlacement = (
		id: string,
		label: string,
		cardId: string,
		x: number,
		y: number,
		rotation = 0
	) =>
		placementSvg({
			id,
			type: 'card',
			deckName: setupPlayDeckName,
			cardId: setupPlayCardId(cardId),
			x,
			y,
			rotation,
			label
		});

	return [
		'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700" role="img" aria-label="Digitable table setup" data-digitable-table="true" data-preset-id="custom">',
		deckPlacement('init-deck', 'Initial deck', 120, 120, [c.initDeck, c.initSlot, c.initTable]),
		cardPlacement('init-table-card', 'Initial table card', c.initTable, 330, 120, 90),
		cardPlacement('rotation-table-card', 'Rotation card', c.rotationTable, 330, 340),
		cardPlacement('flip-table-card', 'Flip card', c.flipTable, 600, 120),
		deckPlacement('camera-deck', 'Camera deck', 120, 340, [c.cameraFiller, c.cameraDraw]),
		deckPlacement('accept-deck', 'Accept deck', 120, 560, [c.acceptFiller, c.acceptDraw]),
		deckPlacement('stack-back-deck', 'Stack back deck', 960, 340, [
			c.stackFillerOne,
			c.stackFillerTwo,
			c.stackDraw
		]),
		deckPlacement('reject-deck', 'Reject deck', 820, 560, [c.rejectFiller, c.rejectDraw]),
		deckPlacement('drag-deck', 'Drag deck', 820, 120, [c.dragFiller, c.dragDraw]),
		setupSlotSvg({
			id: 'init-slot',
			label: 'Initial slot',
			x: 500,
			y: 255,
			rotation: 90,
			slotContents: [
				{ type: 'card', deckName: setupPlayDeckName, cardId: setupPlayCardId(c.initSlot) }
			]
		}),
		setupSlotSvg({
			id: 'rotation-slot',
			label: 'Rotation slot',
			x: 650,
			y: 255,
			rotation: 90,
			slotContents: [
				{ type: 'card', deckName: setupPlayDeckName, cardId: setupPlayCardId(c.rotationSlot) }
			]
		}),
		setupSlotSvg({
			id: 'accept-slot',
			label: 'Accept slot',
			x: 260,
			y: 450,
			acceptedCardIds: [setupPlayCardId(c.acceptDraw)]
		}),
		setupSlotSvg({
			id: 'reject-slot',
			label: 'Reject slot',
			x: 650,
			y: 450,
			acceptedCardIds: [setupPlayCardId(c.rejectAcceptedOther)]
		}),
		setupSlotSvg({
			id: 'drag-slot',
			label: 'Drag slot',
			x: 650,
			y: 40,
			acceptedCardIds: [setupPlayCardId(c.dragDraw)]
		}),
		'</svg>'
	].join('\n');
}

async function writeSharedSetupPlayProject(page: Page) {
	await openOpfsSeedPage(page);

	const cardRows = Object.entries(setupPlayCards).map(
		([label, id]) => `${id},${label.replace(/[A-Z]/g, (match) => ` ${match}`).trim()}`
	);
	await writeOpfsText(
		page,
		`/${setupPlayProjectSlug}/game.json`,
		JSON.stringify(
			{
				name: 'Setup Play Smoke',
				minPlayers: 1,
				maxPlayers: 4,
				description: 'Minimal fixture project for setup play E2E coverage.',
				tags: ['E2E', 'Pixi']
			},
			null,
			'\t'
		)
	);
	await writeOpfsText(page, `/${setupPlayProjectSlug}/rules.md`, '# Setup Play Smoke\n');
	await writeOpfsText(
		page,
		`/${setupPlayProjectSlug}/system/${setupPlayDeckName}/front.svg`,
		[
			'<svg xmlns="http://www.w3.org/2000/svg" width="63mm" height="88mm" viewBox="0 0 63 88">',
			' <rect width="63" height="88" fill="#f7efd9"/>',
			' <rect x="4" y="4" width="55" height="80" rx="4" fill="#fffdf7" stroke="#2f2419" stroke-width="2"/>',
			' <text id="label" x="31.5" y="44" text-anchor="middle" font-family="sans-serif" font-size="6" fill="#2f2419">Card</text>',
			'</svg>'
		].join('\n')
	);
	await writeOpfsText(
		page,
		`/${setupPlayProjectSlug}/system/${setupPlayDeckName}/back.svg`,
		[
			'<svg xmlns="http://www.w3.org/2000/svg" width="63mm" height="88mm" viewBox="0 0 63 88">',
			' <rect width="63" height="88" fill="#2f2419"/>',
			' <rect x="4" y="4" width="55" height="80" rx="4" fill="#5a4633" stroke="#f7efd9" stroke-width="2"/>',
			' <text id="label" x="31.5" y="44" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#f7efd9">Back</text>',
			'</svg>'
		].join('\n')
	);
	await writeOpfsText(
		page,
		`/${setupPlayProjectSlug}/system/${setupPlayDeckName}/data.csv`,
		['id,label', ...cardRows].join('\n')
	);
	await writeOpfsText(page, `/${setupPlayProjectSlug}/setup/table.svg`, sharedSetupTableSvg());
	await saveOpfsStoragePreference(page);
	await page.goto('/app/games');
	await expect(page.getByRole('heading', { name: 'Board Games' })).toBeVisible();
	await expect(page.getByRole('main').getByText(setupPlayProjectSlug)).toBeVisible();
}

async function withSetupPlayProject(page: Page, run: (page: Page) => Promise<void>) {
	await writeSharedSetupPlayProject(page);
	await page.goto(`/app/games/${setupPlayProjectSlug}/play?e2e=1`);
	await waitForPixi(page);
	await run(page);
}

test('local play blocks when table setup is missing', async ({ page }) => {
	const projectSlug = 'missing-setup-play';
	await openOpfsSeedPage(page);
	await writeOpfsText(
		page,
		`/${projectSlug}/game.json`,
		JSON.stringify(
			{
				name: 'Missing Setup Play',
				minPlayers: 1,
				maxPlayers: 4,
				description: 'Fixture project without a table setup.',
				tags: ['E2E', 'Pixi']
			},
			null,
			'\t'
		)
	);
	await writeOpfsText(page, `/${projectSlug}/rules.md`, '# Missing Setup Play\n');
	await writeOpfsText(
		page,
		`/${projectSlug}/system/western/front.svg`,
		'<svg xmlns="http://www.w3.org/2000/svg" width="63mm" height="88mm" viewBox="0 0 63 88"><rect width="63" height="88" fill="#f7efd9"/></svg>'
	);
	await writeOpfsText(
		page,
		`/${projectSlug}/system/western/back.svg`,
		'<svg xmlns="http://www.w3.org/2000/svg" width="63mm" height="88mm" viewBox="0 0 63 88"><rect width="63" height="88" fill="#2f2419"/></svg>'
	);
	await writeOpfsText(page, `/${projectSlug}/system/western/data.csv`, 'id,label\ncard-1,Card\n');
	await saveOpfsStoragePreference(page);

	await page.goto(`/app/games/${projectSlug}/play?e2e=1`);
	await expect(page.getByRole('heading', { name: 'Table setup required' })).toBeVisible();
	await expect(page.getByText('setup/table.svg')).toBeVisible();
});

test.describe('setup-play-smoke local setup play project', () => {
	test('local play initializes visible items from table setup', async ({ page }) => {
		test.setTimeout(60_000);
		const c = setupPlayCards;

		await withSetupPlayProject(page, async (page) => {
			await expect
				.poll(
					async () => {
						const state = await pixiState(page);
						return {
							hasInitDeck: state.visibleStackIds.includes('init-deck'),
							hasSlotCard: state.visibleBoardCardIds.includes(c.initSlot),
							hasTableCard: state.visibleBoardCardIds.includes(c.initTable),
							tableCardRotation: state.rotations[c.initTable],
							handCardCount: state.handCardIds.length
						};
					},
					{ timeout: 20_000 }
				)
				.toEqual({
					hasInitDeck: true,
					hasSlotCard: true,
					hasTableCard: true,
					tableCardRotation: { state: 90, visual: 90 },
					handCardCount: 0
				});
		});
	});

	test('local play rotates a selected board card with q and e', async ({ page }) => {
		test.setTimeout(60_000);
		const c = setupPlayCards;
		const tableCardId = c.rotationTable;
		const slotCardId = c.rotationSlot;

		await withSetupPlayProject(page, async (page) => {
			await expect
				.poll(async () => (await pixiState(page)).visibleBoardCardIds, { timeout: 20_000 })
				.toContain(tableCardId);
			await pixiClick(page, tableCardId);
			const beforeContentBounds = await pixiContentBounds(page, tableCardId);
			await page.keyboard.press('E');

			await expect
				.poll(async () => {
					const state = await pixiState(page);
					return state.rotations[tableCardId];
				})
				.toEqual({ state: 90, visual: 90 });
			const rotatedContentBounds = await pixiContentBounds(page, tableCardId);
			const rotatedItemBounds = await pixiBounds(page, tableCardId);
			expect(
				Math.abs(rotatedContentBounds.centerX - beforeContentBounds.centerX)
			).toBeLessThanOrEqual(2);
			expect(
				Math.abs(rotatedContentBounds.centerY - beforeContentBounds.centerY)
			).toBeLessThanOrEqual(2);
			expect(
				Math.abs(rotatedItemBounds.centerX - rotatedContentBounds.centerX)
			).toBeLessThanOrEqual(6);
			expect(
				Math.abs(rotatedItemBounds.centerY - rotatedContentBounds.centerY)
			).toBeLessThanOrEqual(6);

			await page.keyboard.press('Q');
			await expect
				.poll(async () => {
					const state = await pixiState(page);
					return state.rotations[tableCardId];
				})
				.toEqual({ state: 0, visual: 0 });

			await page.keyboard.press('E');
			await page.keyboard.press('E');
			await expect
				.poll(async () => {
					const state = await pixiState(page);
					return state.rotations[tableCardId];
				})
				.toEqual({ state: 180, visual: 180 });
			const rotatedPoint = await pixiPoint(page, tableCardId);
			await pixiDragTo(page, tableCardId, { x: rotatedPoint.x + 120, y: rotatedPoint.y + 70 });
			await expect
				.poll(async () => {
					const state = await pixiState(page);
					return state.rotations[tableCardId];
				})
				.toEqual({ state: 180, visual: 180 });

			const slotPoint = await pixiPoint(page, slotCardId);
			await page.locator('canvas').dblclick({ position: slotPoint });
			await expect
				.poll(async () => {
					const state = await pixiState(page);
					return state.rotations[slotCardId];
				})
				.toEqual({ state: 90, visual: 90 });
			await page.keyboard.press('E');
			await expect
				.poll(async () => {
					const state = await pixiState(page);
					return state.rotations[slotCardId];
				})
				.toEqual({ state: 90, visual: 90 });
		});
	});

	test('local setup camera rotation is used when playing a hand card', async ({ page }) => {
		test.setTimeout(60_000);
		const drawCardId = setupPlayCards.cameraDraw;

		await withSetupPlayProject(page, async (page) => {
			await expect
				.poll(async () => (await pixiState(page)).visibleStackIds, { timeout: 20_000 })
				.toContain('camera-deck');
			await page.getByRole('button', { name: 'Rotate camera right' }).click();
			await expect.poll(async () => (await pixiState(page)).cameraRotation).toBe(90);

			await pixiClick(page, 'camera-deck');
			await page.keyboard.press('d');
			await expect.poll(async () => (await pixiState(page)).handCardIds).toContain(drawCardId);
			await pixiDragTo(page, drawCardId, { x: 640, y: 320 });

			await expect
				.poll(async () => {
					const state = await pixiState(page);
					return {
						playedCardIsVisible: state.visibleBoardCardIds.includes(drawCardId),
						handCardIds: state.handCardIds,
						rotation: state.rotations[drawCardId]
					};
				})
				.toEqual({
					playedCardIsVisible: true,
					handCardIds: [],
					rotation: { state: 270, visual: 270 }
				});
		});
	});

	test('local play keeps card back renderable after flipping', async ({ page }) => {
		test.setTimeout(60_000);
		const tableCardId = setupPlayCards.flipTable;

		await withSetupPlayProject(page, async (page) => {
			await expect
				.poll(async () => (await pixiState(page)).visibleBoardCardIds, { timeout: 20_000 })
				.toContain(tableCardId);
			await expect.poll(async () => pixiAspectRatio(page, tableCardId)).toBeCloseTo(110 / 150, 1);

			await expect
				.poll(async () => {
					const face = (await pixiState(page)).cardFaces[tableCardId];
					return face
						? {
								isFaceUp: face.isFaceUp,
								frontVisible: face.frontVisible,
								frontRenderable: face.frontRenderable,
								backVisible: face.backVisible,
								backRenderable: face.backRenderable,
								hasBackBounds: face.backWidth > 0 && face.backHeight > 0
							}
						: null;
				})
				.toEqual({
					isFaceUp: true,
					frontVisible: true,
					frontRenderable: true,
					backVisible: true,
					backRenderable: false,
					hasBackBounds: true
				});

			await pixiClick(page, tableCardId);
			await page.keyboard.press('F');
			await expect.poll(async () => pixiAspectRatio(page, tableCardId)).toBeCloseTo(110 / 150, 1);

			await expect
				.poll(async () => {
					const face = (await pixiState(page)).cardFaces[tableCardId];
					return face
						? {
								isFaceUp: face.isFaceUp,
								frontVisible: face.frontVisible,
								frontRenderable: face.frontRenderable,
								backVisible: face.backVisible,
								backRenderable: face.backRenderable,
								hasBackBounds: face.backWidth > 0 && face.backHeight > 0
							}
						: null;
				})
				.toEqual({
					isFaceUp: false,
					frontVisible: true,
					frontRenderable: false,
					backVisible: true,
					backRenderable: true,
					hasBackBounds: true
				});
		});
	});

	test('local setup stacks singular board cards only with shift', async ({ page }) => {
		test.setTimeout(60_000);
		const sourceCardId = setupPlayCards.rotationTable;
		const targetCardId = setupPlayCards.flipTable;

		await withSetupPlayProject(page, async (page) => {
			let initialStackCount = 0;
			await expect
				.poll(
					async () => {
						const state = await pixiState(page);
						initialStackCount = state.visibleStackIds.length;
						return {
							sourceVisible: state.visibleBoardCardIds.includes(sourceCardId),
							targetVisible: state.visibleBoardCardIds.includes(targetCardId)
						};
					},
					{ timeout: 20_000 }
				)
				.toEqual({
					sourceVisible: true,
					targetVisible: true
				});

			const targetPoint = await pixiPoint(page, targetCardId);
			await pixiDragTo(page, sourceCardId, targetPoint);
			await expect
				.poll(async () => {
					const state = await pixiState(page);
					return {
						sourceVisible: state.visibleBoardCardIds.includes(sourceCardId),
						targetVisible: state.visibleBoardCardIds.includes(targetCardId),
						stackCount: state.visibleStackIds.length
					};
				})
				.toEqual({
					sourceVisible: true,
					targetVisible: true,
					stackCount: initialStackCount
				});

			await pixiDragTo(page, sourceCardId, targetPoint, { key: 'Shift' });
			await expect
				.poll(async () => {
					const state = await pixiState(page);
					return {
						sourceVisible: state.visibleBoardCardIds.includes(sourceCardId),
						targetVisible: state.visibleBoardCardIds.includes(targetCardId),
						stackCount: state.visibleStackIds.length
					};
				})
				.toEqual({
					sourceVisible: false,
					targetVisible: false,
					stackCount: initialStackCount + 1
				});
		});
	});

	test('local setup slot accepts matching hand cards', async ({ page }) => {
		test.setTimeout(60_000);
		const drawCardId = setupPlayCards.acceptDraw;

		await withSetupPlayProject(page, async (page) => {
			await expect
				.poll(async () => (await pixiState(page)).visibleStackIds, { timeout: 20_000 })
				.toContain('accept-deck');
			await pixiClick(page, 'accept-deck');
			await page.keyboard.press('d');

			await expect.poll(async () => (await pixiState(page)).handCardIds).toContain(drawCardId);
			await pixiDragTo(page, drawCardId, await pixiSlotPoint(page, 'accept-slot'));
			await expect.poll(async () => (await pixiState(page)).handCardIds).toEqual([]);
			await expect
				.poll(async () => (await pixiState(page)).visibleBoardCardIds)
				.toContain(drawCardId);
		});
	});

	test('local setup can stack a hand card back onto its deck', async ({ page }) => {
		test.setTimeout(60_000);
		const drawCardId = setupPlayCards.stackDraw;

		await withSetupPlayProject(page, async (page) => {
			await expect
				.poll(async () => (await pixiState(page)).visibleStackIds, { timeout: 20_000 })
				.toContain('stack-back-deck');
			await pixiClick(page, 'stack-back-deck');
			await page.keyboard.press('d');

			await expect.poll(async () => (await pixiState(page)).handCardIds).toContain(drawCardId);
			const handContentBounds = await pixiContentBounds(page, drawCardId);
			expect(handContentBounds.width).toBeGreaterThan(70);
			expect(handContentBounds.height).toBeGreaterThan(100);
			await pixiDragTo(page, drawCardId, await pixiPoint(page, 'stack-back-deck'));
			await expect.poll(async () => (await pixiState(page)).handCardIds).toEqual([]);
			await expect
				.poll(async () => (await pixiState(page)).visibleBoardCardIds)
				.toContain(drawCardId);
			await pixiDragTo(page, drawCardId, await pixiPoint(page, 'stack-back-deck'), {
				key: 'Shift'
			});
			await expect
				.poll(async () => (await pixiState(page)).visibleStackIds)
				.toContain('stack-back-deck');
			await expect
				.poll(async () => (await pixiState(page)).visibleBoardCardIds)
				.not.toContain(drawCardId);
		});
	});

	test('local setup slot rejects nonmatching hand cards', async ({ page }) => {
		test.setTimeout(60_000);
		const rejectedCardId = setupPlayCards.rejectDraw;

		await withSetupPlayProject(page, async (page) => {
			await expect
				.poll(async () => (await pixiState(page)).visibleStackIds, { timeout: 20_000 })
				.toContain('reject-deck');
			await pixiClick(page, 'reject-deck');
			await page.keyboard.press('d');

			await expect.poll(async () => (await pixiState(page)).handCardIds).toContain(rejectedCardId);
			await pixiDragTo(page, rejectedCardId, await pixiSlotPoint(page, 'reject-slot'));
			await expect.poll(async () => (await pixiState(page)).handCardIds).toContain(rejectedCardId);
		});
	});

	test('local setup hand drag keeps the played card under the cursor', async ({ page }) => {
		test.setTimeout(60_000);
		const drawCardId = setupPlayCards.dragDraw;

		await withSetupPlayProject(page, async (page) => {
			await expect
				.poll(async () => (await pixiState(page)).visibleStackIds, { timeout: 20_000 })
				.toContain('drag-deck');
			await pixiClick(page, 'drag-deck');
			await page.keyboard.press('d');
			await expect.poll(async () => (await pixiState(page)).handCardIds).toContain(drawCardId);

			const startPoint = await pixiPoint(page, drawCardId);
			const targetPoint = await pixiSlotPoint(page, 'drag-slot');
			const canvasBox = await page.locator('canvas').boundingBox();
			if (!canvasBox) throw new Error('Canvas is not visible');

			await page.mouse.move(canvasBox.x + startPoint.x, canvasBox.y + startPoint.y);
			await page.mouse.down();
			await page.mouse.move(canvasBox.x + targetPoint.x, canvasBox.y + targetPoint.y, {
				steps: 12
			});
			await page.mouse.move(canvasBox.x + targetPoint.x, canvasBox.y + targetPoint.y);

			await expect.poll(async () => (await pixiState(page)).handCardIds).toEqual([]);
			const draggedContentBounds = await pixiContentBounds(page, drawCardId);
			expect(draggedContentBounds.width).toBeLessThanOrEqual(140);
			expect(draggedContentBounds.height).toBeLessThanOrEqual(180);
			expect(draggedContentBounds.width / draggedContentBounds.height).toBeCloseTo(110 / 150, 1);
			expect(targetPoint.x).toBeGreaterThanOrEqual(draggedContentBounds.x);
			expect(targetPoint.x).toBeLessThanOrEqual(
				draggedContentBounds.x + draggedContentBounds.width
			);
			expect(targetPoint.y).toBeGreaterThanOrEqual(draggedContentBounds.y);
			expect(targetPoint.y).toBeLessThanOrEqual(
				draggedContentBounds.y + draggedContentBounds.height
			);

			await page.mouse.up();
		});
	});

	test('local setup hand card stays in hand until dragged upward', async ({ page }) => {
		test.setTimeout(60_000);
		const drawCardId = setupPlayCards.dragDraw;

		await withSetupPlayProject(page, async (page) => {
			await expect
				.poll(async () => (await pixiState(page)).visibleStackIds, { timeout: 20_000 })
				.toContain('drag-deck');
			await pixiClick(page, 'drag-deck');
			await page.keyboard.press('d');
			await expect.poll(async () => (await pixiState(page)).handCardIds).toContain(drawCardId);
			const handContentBounds = await pixiContentBounds(page, drawCardId);
			expect(handContentBounds.height).toBeLessThanOrEqual(170);
			expect(handContentBounds.width).toBeLessThanOrEqual(140);

			const startPoint = await pixiPoint(page, drawCardId);
			const canvasBox = await page.locator('canvas').boundingBox();
			if (!canvasBox) throw new Error('Canvas is not visible');

			await page.mouse.move(canvasBox.x + startPoint.x, canvasBox.y + startPoint.y);
			await page.mouse.down();
			await page.mouse.move(canvasBox.x + startPoint.x + 24, canvasBox.y + startPoint.y);
			await page.mouse.up();

			await expect.poll(async () => (await pixiState(page)).handCardIds).toContain(drawCardId);
		});
	});
});

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

async function readFeedbackMarkdownFiles(page: Page, projectSlug: string) {
	return page.evaluate(async (projectSlug) => {
		const storage = navigator.storage as StorageManager & {
			getDirectory: () => Promise<FileSystemDirectoryHandle>;
		};
		const root = await storage.getDirectory();

		try {
			let dir = await root.getDirectoryHandle(projectSlug);
			dir = await dir.getDirectoryHandle('feedback');
			const files: string[] = [];

			async function collectMarkdown(directory: FileSystemDirectoryHandle) {
				for await (const [name, handle] of directory.entries()) {
					if (handle.kind === 'directory') {
						await collectMarkdown(handle);
					} else if (name.endsWith('.md')) {
						const file = await handle.getFile();
						files.push(await file.text());
					}
				}
			}

			await collectMarkdown(dir);
			return files;
		} catch {
			return [];
		}
	}, projectSlug);
}

async function readFeedbackMarkdownFilePaths(page: Page, projectSlug: string) {
	return page.evaluate(async (projectSlug) => {
		const storage = navigator.storage as StorageManager & {
			getDirectory: () => Promise<FileSystemDirectoryHandle>;
		};
		const root = await storage.getDirectory();

		try {
			let dir = await root.getDirectoryHandle(projectSlug);
			dir = await dir.getDirectoryHandle('feedback');
			const paths: string[] = [];

			async function collectMarkdown(directory: FileSystemDirectoryHandle, currentPath = '') {
				for await (const [name, handle] of directory.entries()) {
					const nextPath = currentPath ? `${currentPath}/${name}` : name;
					if (handle.kind === 'directory') {
						await collectMarkdown(handle, nextPath);
					} else if (name.endsWith('.md')) {
						paths.push(nextPath);
					}
				}
			}

			await collectMarkdown(dir);
			return paths;
		} catch {
			return [];
		}
	}, projectSlug);
}

async function signUp(page: Page) {
	const email = `playtest-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

	await page.goto(appPath('/sign-up'), { waitUntil: 'networkidle' });
	await page.getByLabel('Name').fill('Playtest E2E');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery-staple');
	await page.getByLabel('Confirm password').fill('correct-horse-battery-staple');
	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/app\/games$/, { timeout: 20_000 });
}

async function startPlaytestAndGetInvite(page: Page, projectSlug: string) {
	await page.goto(appPath(`/games/${projectSlug}`));
	await page.getByRole('link', { name: 'Playtests' }).click();
	await expect(page).toHaveURL(new RegExp(`/app/games/${projectSlug}/playtests`));
	await expect(page.getByRole('heading', { name: 'Playtests' })).toBeVisible();
	await page.getByRole('button', { name: 'Start playtest' }).click();
	const inviteInput = page.getByLabel('Playtest invite link');
	await expect(inviteInput).toHaveValue(/\/app\/playtests\/[0-9a-f-]+/);
	await expect(page.getByRole('link', { name: 'Open' }).first()).toHaveAttribute(
		'href',
		/\/app\/playtests\/[0-9a-f-]+$/
	);
	return inviteInput.inputValue();
}

async function openAnonymousPlaytestInvite(page: Page, inviteUrl: string) {
	await page.goto(`${inviteUrl}?e2e=1`);
	await expect(page).toHaveURL(/\/app\/playtests\/[0-9a-f-]+\/join\?next=/);
	await expect(page.getByRole('heading', { name: 'Join this playtest' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
		'href',
		/\/sign-in\?next=%2Fapp%2Fplaytests%2F[0-9a-f-]+%3Fe2e%3D1$/
	);
	await expect(page.getByRole('link', { name: 'Continue as anonymous user' })).toHaveAttribute(
		'href',
		/\/app\/legal\/accept\?anonymous=playtest&next=%2Fapp%2Fplaytests%2F[0-9a-f-]+%3Fe2e%3D1$/
	);
	await page.getByRole('link', { name: 'Continue as anonymous user' }).click();
	await expect(page).toHaveURL(/\/app\/legal\/accept\?anonymous=playtest&next=/);
	await expect(
		page.getByRole('heading', { name: 'Review the current legal documents.' })
	).toBeVisible();
	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page).toHaveURL(/\/app\/playtests\/[0-9a-f-]+\?e2e=1$/, { timeout: 20_000 });
	await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
	await waitForPixi(page);
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

test('single-card source opens as a loose board card', async ({ page }) => {
	test.setTimeout(60_000);
	await openPixiProject(page, 'pixi-play-single-card');

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
			visibleStacks: 0,
			visibleBoardCards: 1,
			handCards: 0
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

test('western-cards play mode loads within budget and keeps the surface fixed to the viewport', async ({
	page
}) => {
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

	await test.step('play surface stays fixed to the viewport while resizing', async () => {
		await expect(page.locator('canvas')).toBeVisible({ timeout: 20_000 });
		await expectPlaySurfaceFitsViewport(page);

		const before = await playSurfaceMetrics(page);
		expect(before).not.toBeNull();
		await page.evaluate(() => {
			const playSurface = document.querySelector('canvas')?.parentElement;
			if (playSurface) playSurface.style.width = 'calc(100% - 120px)';
		});

		await expect
			.poll(async () => {
				const after = await playSurfaceMetrics(page);
				if (!before || !after) return false;
				return Math.abs(after.canvasWidth - before.canvasWidth) > 20;
			})
			.toBe(true);
		await expectPlaySurfaceFitsViewport(page);
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

test('playtest invite imports the project and opens playable cards', async ({ page }) => {
	test.setTimeout(90_000);

	await signUp(page);
	await seedPixiProject(page, 'pixi-play-smoke');

	const inviteUrl = await startPlaytestAndGetInvite(page, 'pixi-play-smoke');

	await page.evaluate(() => localStorage.setItem('storage-preference', 'directory'));
	await page.goto(`${inviteUrl}?e2e=1`);
	await expect(page).toHaveURL(/\/app\/playtests\/[0-9a-f-]+\?e2e=1$/);
	await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
	await waitForPixi(page);
	await page.goto(`${inviteUrl}?e2e=1`);
	await expect(page).toHaveURL(/\/app\/playtests\/[0-9a-f-]+\?e2e=1$/);
	await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
	await waitForPixi(page);
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('storage-preference')))
		.toBe('directory');

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

	await page.goto(appPath('/games'));
	await expect(page.getByRole('main').getByText('pixi-play-smoke')).toBeVisible();
	await expect(page.getByRole('main').getByText(/-playtest-[0-9a-f]{8}/)).toHaveCount(0);
});

test('anonymous playtest invitee accepts legal terms and reopens the invite', async ({
	page,
	browser
}) => {
	test.setTimeout(120_000);
	const inviteeContext = await browser.newContext({
		baseURL: test.info().project.use.baseURL as string | undefined
	});
	const inviteePage = await inviteeContext.newPage();

	try {
		await signUp(page);
		await page.goto(appPath('/games'));
		await seedProjectFiles(page, 'pixi-play-smoke');
		await useBrowserStorage(page);
		await expect(page.getByRole('main').getByText('pixi-play-smoke')).toBeVisible();

		const inviteUrl = await startPlaytestAndGetInvite(page, 'pixi-play-smoke');

		await openAnonymousPlaytestInvite(inviteePage, inviteUrl);
		await inviteePage.goto(`${inviteUrl}?e2e=1`);
		await expect(inviteePage).toHaveURL(/\/app\/playtests\/[0-9a-f-]+\?e2e=1$/);
		await waitForPixi(inviteePage);
	} finally {
		await inviteeContext.close();
	}
});

test('playtest invitees share private room state', async ({ page, browser }) => {
	test.setTimeout(120_000);
	const secondContext = await browser.newContext({
		baseURL: test.info().project.use.baseURL as string | undefined
	});
	const secondPage = await secondContext.newPage();

	try {
		await signUp(page);
		await seedPixiProject(page, 'pixi-play-smoke');

		const inviteUrl = await startPlaytestAndGetInvite(page, 'pixi-play-smoke');

		await page.goto(`${inviteUrl}?e2e=1`);
		await expect(page).toHaveURL(/\/app\/playtests\/[0-9a-f-]+\?e2e=1$/);
		await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
		await waitForPixi(page);

		await openAnonymousPlaytestInvite(secondPage, inviteUrl);

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

test('playtest invitees sync fixed slot parenting when another player moves a card', async ({
	page,
	browser
}) => {
	test.setTimeout(120_000);
	const secondContext = await browser.newContext({
		baseURL: test.info().project.use.baseURL as string | undefined
	});
	const secondPage = await secondContext.newPage();
	const cardId = setupPlayCards.dragDraw;
	const slotTargetId = setupSlotCellTargetId('drag-slot');

	try {
		await signUp(page);
		await writeSharedSetupPlayProject(page);

		const inviteUrl = await startPlaytestAndGetInvite(page, setupPlayProjectSlug);

		await page.goto(`${inviteUrl}?e2e=1`);
		await expect(page).toHaveURL(/\/app\/playtests\/[0-9a-f-]+\?e2e=1$/);
		await waitForPixi(page);

		await signUp(secondPage);
		await secondPage.goto(`${inviteUrl}?e2e=1`);
		await expect(secondPage).toHaveURL(/\/app\/playtests\/[0-9a-f-]+\?e2e=1$/);
		await waitForPixi(secondPage);

		await expect
			.poll(async () => (await pixiState(page)).visibleStackIds, { timeout: 20_000 })
			.toContain('drag-deck');
		await pixiClick(page, 'drag-deck');
		await page.keyboard.press('d');
		await expect.poll(async () => (await pixiState(page)).handCardIds).toContain(cardId);
		await pixiDragTo(page, cardId, await pixiSlotPoint(page, 'drag-slot'));

		await expect
			.poll(
				async () => {
					const state = await pixiState(secondPage);
					return {
						visible: state.visibleBoardCardIds.includes(cardId),
						parentId: state.parentIds[cardId]
					};
				},
				{ timeout: 20_000 }
			)
			.toEqual({
				visible: true,
				parentId: slotTargetId
			});

		await pixiDragTo(secondPage, cardId, await pixiPoint(secondPage, setupPlayCards.rotationTable));

		await expect
			.poll(
				async () => {
					const firstState = await pixiState(page);
					const secondState = await pixiState(secondPage);
					return {
						firstParentId: firstState.parentIds[cardId],
						secondParentId: secondState.parentIds[cardId]
					};
				},
				{ timeout: 20_000 }
			)
			.toEqual({
				firstParentId: 'table',
				secondParentId: 'table'
			});
	} finally {
		await secondContext.close();
	}
});

test('playtest invitee notes are imported into the creator game feedback folder', async ({
	page,
	browser
}) => {
	test.setTimeout(120_000);
	const secondContext = await browser.newContext({
		baseURL: test.info().project.use.baseURL as string | undefined
	});
	const secondPage = await secondContext.newPage();

	try {
		await signUp(page);
		await seedPixiProject(page, 'pixi-play-smoke');

		const inviteUrl = await startPlaytestAndGetInvite(page, 'pixi-play-smoke');

		await openAnonymousPlaytestInvite(secondPage, inviteUrl);

		await secondPage.getByRole('button', { name: 'Playtest notes' }).click();
		await secondPage
			.getByRole('textbox', { name: 'Playtest note' })
			.fill('This worked well.\n<script>alert("xss")</script>');
		const feedbackPost = secondPage.waitForResponse(
			(response) =>
				response.request().method() === 'POST' &&
				/\/api\/playtests\/[0-9a-f-]+\/feedback$/.test(new URL(response.url()).pathname)
		);
		await secondPage.getByRole('button', { name: 'Submit note' }).click();
		expect((await feedbackPost).ok()).toBe(true);

		await page.goto(appPath('/games/pixi-play-smoke'));
		await expect
			.poll(async () => readFeedbackMarkdownFiles(page, 'pixi-play-smoke'), { timeout: 5_000 })
			.toEqual([]);

		await page.goto(appPath('/games/pixi-play-smoke/playtests'));
		await expect(page.getByText('Playtest note')).toBeVisible({ timeout: 20_000 });
		await expect(page.getByText('This worked well.')).toBeVisible();
		await expect(page.getByText('Imported 1 feedback note')).toBeVisible({ timeout: 20_000 });
		await expect(page.getByRole('button', { name: 'Refresh feedback' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Import new feedback' })).toHaveCount(0);
		await expect
			.poll(async () => readFeedbackMarkdownFilePaths(page, 'pixi-play-smoke'))
			.toContainEqual(
				expect.stringMatching(
					/^playtest-session-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{8}\//
				)
			);

		await expect
			.poll(
				async () =>
					(await readFeedbackMarkdownFiles(page, 'pixi-play-smoke')).find((note) =>
						note.includes('This worked well.')
					) ?? '',
				{ timeout: 20_000 }
			)
			.toContain('This worked well.\n&lt;script&gt;alert("xss")&lt;/script&gt;');
		await expect
			.poll(
				async () =>
					(await readFeedbackMarkdownFiles(page, 'pixi-play-smoke')).find((note) =>
						note.includes('This worked well.')
					) ?? ''
			)
			.not.toContain('@example.com');
		await expect
			.poll(
				async () =>
					(await readFeedbackMarkdownFiles(page, 'pixi-play-smoke')).find((note) =>
						note.includes('This worked well.')
					) ?? ''
			)
			.not.toContain('authorEmail');
	} finally {
		await secondContext.close();
	}
});
