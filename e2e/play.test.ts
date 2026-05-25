import { expect, test, type Page } from '@playwright/test';
import { seedProjectFiles, useBrowserStorage, writeOpfsText } from './helpers/opfs';
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
		`  <g id="${escapeSvgAttribute(input.id)}" data-digitable-kind="placement" data-digitable-type="${input.type}" data-deck-name="${escapeSvgAttribute(input.deckName)}"${cardAttr}${deckAttr} data-label="${escapeSvgAttribute(input.label)}" data-svgedit-resizable="false" transform="translate(${visualX} ${visualY}) rotate(0 55 75)">`,
		'    <rect x="0" y="0" width="110" height="150" rx="10"/>',
		'  </g>'
	].join('\n');
}

async function writeWesternTableSetup(
	page: Page,
	input: {
		deckCardIds: string[];
		cardPlacements?: { id: string; label: string; cardId: string; x: number; y: number }[];
		acceptedCardIds?: string[];
		slotContents?: { type: 'card'; deckName: string; cardId: string }[];
	}
) {
	const deckCardIds = input.deckCardIds.map((id) => `western:${id}`);
	const placements = [
		placementSvg({
			id: 'setup-deck',
			type: 'deck',
			deckName: 'western',
			cardIds: deckCardIds,
			x: 155,
			y: 155,
			label: 'western'
		}),
		...(input.cardPlacements ?? []).map((placement) =>
			placementSvg({
				id: placement.id,
				type: 'card',
				deckName: 'western',
				cardId: placement.cardId,
				x: placement.x,
				y: placement.y,
				label: placement.label
			})
		)
	].join('\n');
	const slotContents = escapeSvgAttribute(JSON.stringify(input.slotContents ?? []));
	const acceptedCardIds = escapeSvgAttribute(JSON.stringify(input.acceptedCardIds ?? []));
	await writeOpfsText(
		page,
		'/western-cards/setup/table.svg',
		[
			'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700" role="img" aria-label="Digitable table setup" data-digitable-table="true" data-preset-id="custom">',
			placements,
			`  <g id="setup-slot" data-digitable-kind="slot" data-label="Slot" data-accepted-deck-names="[]" data-accepted-card-ids="${acceptedCardIds}" data-slot-layout-mode="horizontal-flex" data-slot-visible-count="2" data-slot-gap="16" data-slot-card-size="content-card" data-slot-contents="${slotContents}" data-svgedit-resizable="false" transform="translate(500 220)">`,
			'    <rect x="0" y="0" width="236" height="150" rx="12"/>',
			'  </g>',
			'</svg>'
		].join('\n')
	);
}

test('local play initializes visible items from table setup', async ({ page }) => {
	test.setTimeout(60_000);
	const deckCardIds = [
		'71412f2b-80a5-48af-aa7d-68a525a1c872',
		'c6da04fb-1955-43e1-adbc-7f4fda4b83cf'
	];
	const slotCardId = '5f408ad5-6799-4258-b4bd-c7c8a570c97b';
	const tableCardId = '69ebca03-541e-4649-a256-1c7c28aaf86b';

	await seedPixiProject(page, 'western-cards');
	await writeWesternTableSetup(page, {
		deckCardIds: [...deckCardIds, slotCardId, tableCardId],
		cardPlacements: [
			{
				id: 'setup-table-card',
				label: 'Peek',
				cardId: `western:${tableCardId}`,
				x: 360,
				y: 155
			}
		],
		slotContents: [{ type: 'card', deckName: 'western', cardId: `western:${slotCardId}` }]
	});

	await page.goto('/app/games/western-cards/play?e2e=1');
	await waitForPixi(page);

	await expect
		.poll(
			async () => {
				const state = await pixiState(page);
				return {
					visibleStackIds: state.visibleStackIds,
					visibleBoardCardIds: state.visibleBoardCardIds.toSorted(),
					handCardCount: state.handCardIds.length
				};
			},
			{ timeout: 20_000 }
		)
		.toEqual({
			visibleStackIds: ['setup-deck'],
			visibleBoardCardIds: [slotCardId, tableCardId].toSorted(),
			handCardCount: 0
		});
});

test('local play surface is fixed to the viewport and resizes with its container', async ({
	page
}) => {
	test.setTimeout(60_000);
	await openPixiProject(page, 'western-cards');
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

test('local play keeps card back renderable after flipping', async ({ page }) => {
	test.setTimeout(60_000);
	const tableCardId = '85e1518e-0fad-4fb8-b2c0-67a872cd7d92';

	await seedPixiProject(page, 'western-cards');
	await writeWesternTableSetup(page, {
		deckCardIds: ['71412f2b-80a5-48af-aa7d-68a525a1c872'],
		cardPlacements: [
			{
				id: 'setup-table-card',
				label: 'Switch',
				cardId: `western:${tableCardId}`,
				x: 360,
				y: 155
			}
		]
	});

	await page.goto('/app/games/western-cards/play?e2e=1');
	await waitForPixi(page);
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

test('local setup slot accepts matching hand cards', async ({ page }) => {
	test.setTimeout(60_000);
	const drawCardId = 'c6da04fb-1955-43e1-adbc-7f4fda4b83cf';
	await seedPixiProject(page, 'western-cards');
	await writeWesternTableSetup(page, {
		deckCardIds: ['71412f2b-80a5-48af-aa7d-68a525a1c872', drawCardId],
		acceptedCardIds: [`western:${drawCardId}`]
	});

	await page.goto('/app/games/western-cards/play?e2e=1');
	await waitForPixi(page);
	await expect
		.poll(async () => (await pixiState(page)).visibleStackIds, { timeout: 20_000 })
		.toContain('setup-deck');
	await pixiClick(page, 'setup-deck');
	await page.keyboard.press('d');

	await expect.poll(async () => (await pixiState(page)).handCardIds).toContain(drawCardId);
	await pixiDragTo(page, drawCardId, await pixiSlotPoint(page, 'setup-slot'));
	await expect.poll(async () => (await pixiState(page)).handCardIds).toEqual([]);
	await expect.poll(async () => (await pixiState(page)).visibleBoardCardIds).toContain(drawCardId);
});

test('local setup can stack a hand card back onto its deck', async ({ page }) => {
	test.setTimeout(60_000);
	const drawCardId = '5f408ad5-6799-4258-b4bd-c7c8a570c97b';
	await seedPixiProject(page, 'western-cards');
	await writeWesternTableSetup(page, {
		deckCardIds: [
			'71412f2b-80a5-48af-aa7d-68a525a1c872',
			'c6da04fb-1955-43e1-adbc-7f4fda4b83cf',
			drawCardId
		]
	});

	await page.goto('/app/games/western-cards/play?e2e=1');
	await waitForPixi(page);
	await expect
		.poll(async () => (await pixiState(page)).visibleStackIds, { timeout: 20_000 })
		.toContain('setup-deck');
	await pixiClick(page, 'setup-deck');
	await page.keyboard.press('d');

	await expect.poll(async () => (await pixiState(page)).handCardIds).toContain(drawCardId);
	await pixiDragTo(page, drawCardId, await pixiPoint(page, 'setup-deck'));
	await expect.poll(async () => (await pixiState(page)).handCardIds).toEqual([]);
	await expect.poll(async () => (await pixiState(page)).visibleBoardCardIds).toContain(drawCardId);
	await pixiDragTo(page, drawCardId, await pixiPoint(page, 'setup-deck'), { key: 'Shift' });
	await expect.poll(async () => (await pixiState(page)).visibleStackIds).toContain('setup-deck');
	await expect.poll(async () => (await pixiState(page)).visibleBoardCardIds).not.toContain(drawCardId);
});

test('local setup slot rejects nonmatching hand cards', async ({ page }) => {
	test.setTimeout(60_000);
	const rejectedCardId = 'c6da04fb-1955-43e1-adbc-7f4fda4b83cf';
	await seedPixiProject(page, 'western-cards');
	await writeWesternTableSetup(page, {
		deckCardIds: ['71412f2b-80a5-48af-aa7d-68a525a1c872', rejectedCardId],
		acceptedCardIds: ['western:71412f2b-80a5-48af-aa7d-68a525a1c872']
	});

	await page.goto('/app/games/western-cards/play?e2e=1');
	await waitForPixi(page);
	await expect
		.poll(async () => (await pixiState(page)).visibleStackIds, { timeout: 20_000 })
		.toContain('setup-deck');
	await pixiClick(page, 'setup-deck');
	await page.keyboard.press('d');

	await expect.poll(async () => (await pixiState(page)).handCardIds).toContain(rejectedCardId);
	await pixiDragTo(page, rejectedCardId, await pixiSlotPoint(page, 'setup-slot'));
	await expect.poll(async () => (await pixiState(page)).handCardIds).toContain(rejectedCardId);
});

test('local setup hand drag keeps the played card under the cursor', async ({ page }) => {
	test.setTimeout(60_000);
	const drawCardId = 'c6da04fb-1955-43e1-adbc-7f4fda4b83cf';
	await seedPixiProject(page, 'western-cards');
	await writeWesternTableSetup(page, {
		deckCardIds: ['71412f2b-80a5-48af-aa7d-68a525a1c872', drawCardId],
		acceptedCardIds: [`western:${drawCardId}`]
	});

	await page.goto('/app/games/western-cards/play?e2e=1');
	await waitForPixi(page);
	await expect
		.poll(async () => (await pixiState(page)).visibleStackIds, { timeout: 20_000 })
		.toContain('setup-deck');
	await pixiClick(page, 'setup-deck');
	await page.keyboard.press('d');
	await expect.poll(async () => (await pixiState(page)).handCardIds).toContain(drawCardId);

	const startPoint = await pixiPoint(page, drawCardId);
	const targetPoint = await pixiSlotPoint(page, 'setup-slot');
	const canvasBox = await page.locator('canvas').boundingBox();
	if (!canvasBox) throw new Error('Canvas is not visible');

	await page.mouse.move(canvasBox.x + startPoint.x, canvasBox.y + startPoint.y);
	await page.mouse.down();
	await page.mouse.move(canvasBox.x + targetPoint.x, canvasBox.y + targetPoint.y, { steps: 12 });
	await page.mouse.move(canvasBox.x + targetPoint.x, canvasBox.y + targetPoint.y);

	await expect.poll(async () => (await pixiState(page)).handCardIds).toEqual([]);
	const draggedContentBounds = await pixiContentBounds(page, drawCardId);
	expect(targetPoint.x).toBeGreaterThanOrEqual(draggedContentBounds.x);
	expect(targetPoint.x).toBeLessThanOrEqual(draggedContentBounds.x + draggedContentBounds.width);
	expect(targetPoint.y).toBeGreaterThanOrEqual(draggedContentBounds.y);
	expect(targetPoint.y).toBeLessThanOrEqual(draggedContentBounds.y + draggedContentBounds.height);

	await page.mouse.up();
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

test('playtest invite imports the project and opens playable cards', async ({ page }) => {
	test.setTimeout(90_000);

	await signUp(page);
	await page.goto(appPath('/games'));
	await seedProjectFiles(page, 'pixi-play-smoke');
	await useBrowserStorage(page);
	await expect(page.getByRole('main').getByText('pixi-play-smoke')).toBeVisible();

	const inviteUrl = await startPlaytestAndGetInvite(page, 'pixi-play-smoke');

	await page.evaluate(() => localStorage.setItem('storage-preference', 'directory'));
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

test('playtest invitees share private room state', async ({ page, browser }) => {
	test.setTimeout(120_000);
	const secondContext = await browser.newContext({
		baseURL: test.info().project.use.baseURL as string | undefined
	});
	const secondPage = await secondContext.newPage();

	try {
		await signUp(page);
		await page.goto(appPath('/games'));
		await seedProjectFiles(page, 'pixi-play-smoke');
		await useBrowserStorage(page);
		await expect(page.getByRole('main').getByText('pixi-play-smoke')).toBeVisible();

		const inviteUrl = await startPlaytestAndGetInvite(page, 'pixi-play-smoke');

		await page.goto(`${inviteUrl}?e2e=1`);
		await expect(page).toHaveURL(/\/app\/playtests\/[0-9a-f-]+\?e2e=1$/);
		await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
		await waitForPixi(page);

		await signUp(secondPage);
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
		await page.goto(appPath('/games'));
		await seedProjectFiles(page, 'pixi-play-smoke');
		await useBrowserStorage(page);
		await expect(page.getByRole('main').getByText('pixi-play-smoke')).toBeVisible();

		const inviteUrl = await startPlaytestAndGetInvite(page, 'pixi-play-smoke');

		await signUp(secondPage);
		await secondPage.goto(`${inviteUrl}?e2e=1`);
		await expect(secondPage).toHaveURL(/\/app\/playtests\/[0-9a-f-]+\?e2e=1$/);
		await waitForPixi(secondPage);

		await secondPage.getByRole('button', { name: 'Playtest notes' }).click();
		await secondPage
			.getByRole('textbox', { name: 'Playtest note' })
			.fill('This worked well.\n<script>alert("xss")</script>');
		await secondPage.keyboard.press('Escape');
		await expect(
			secondPage.getByRole('button', { name: 'Playtest notes with unsent changes' })
		).toBeVisible();
		await secondPage.getByRole('button', { name: 'Playtest notes with unsent changes' }).click();
		await expect(secondPage.getByRole('textbox', { name: 'Playtest note' })).toContainText(
			'This worked well.'
		);
		await secondPage.getByRole('button', { name: 'Submit note' }).click();
		await expect(secondPage.getByText('Submitted')).toBeVisible();
		await secondPage.keyboard.press('Escape');
		await expect(secondPage.getByRole('button', { name: 'Playtest notes' })).toBeVisible();

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
