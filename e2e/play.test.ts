import { expect, test, type Page } from '@playwright/test';
import { seedProjectFiles, useBrowserStorage } from './helpers/opfs';
import { pixiClick, pixiDragTo, pixiPoint, pixiState, waitForPixi } from './helpers/pixi';

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
