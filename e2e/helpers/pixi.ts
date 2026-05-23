import { expect, type Page } from '@playwright/test';

export interface PixiPlayState {
	visibleStackIds: string[];
	visibleBoardCardIds: string[];
	handCardIds: string[];
	strokes: {
		id: string;
		componentId: string;
		face: 'front' | 'back';
		visible: boolean;
		parentId: string | null;
		points: number;
	}[];
}

type PixiBridgeWindow = Window & {
	__PIXI_E2E__?: {
		state: () => PixiPlayState;
		clickPoint: (id: string) => { x: number; y: number } | null;
		slotPoint: (id: string) => { x: number; y: number } | null;
	};
};

export async function pixiPoint(page: Page, id: string) {
	const point = await page.evaluate(
		(targetId) => (window as PixiBridgeWindow).__PIXI_E2E__!.clickPoint(targetId),
		id
	);
	if (!point) {
		throw new Error(`No Pixi click point found for "${id}"`);
	}
	return point;
}

export async function pixiSlotPoint(page: Page, id: string) {
	const point = await page.evaluate(
		(slotId) => (window as PixiBridgeWindow).__PIXI_E2E__!.slotPoint(slotId),
		id
	);
	if (!point) {
		throw new Error(`No Pixi slot point found for "${id}"`);
	}
	return point;
}

export async function waitForPixi(page: Page) {
	await page.waitForFunction(() => Boolean((window as PixiBridgeWindow).__PIXI_E2E__));
}

export async function pixiState(page: Page): Promise<PixiPlayState> {
	let lastError: unknown;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			await waitForPixi(page);
			return await page.evaluate(() => (window as PixiBridgeWindow).__PIXI_E2E__!.state());
		} catch (error) {
			lastError = error;
			const message = error instanceof Error ? error.message : String(error);
			if (
				!message.includes('Execution context was destroyed') &&
				!message.includes('__PIXI_E2E__')
			) {
				throw error;
			}
			await page.waitForTimeout(100);
		}
	}
	throw lastError;
}

export async function pixiClick(page: Page, id: string) {
	const point = await pixiPoint(page, id);

	await page.locator('canvas').click({
		position: {
			x: point.x,
			y: point.y
		}
	});
}

export async function pixiDragTo(page: Page, id: string, target: { x: number; y: number }) {
	const point = await pixiPoint(page, id);
	const canvas = page.locator('canvas');
	await expect(canvas).toBeVisible();
	const box = await canvas.boundingBox();

	if (!box) {
		throw new Error('Canvas is not visible');
	}

	await page.mouse.move(box.x + point.x, box.y + point.y);
	await page.mouse.down();
	await page.mouse.move(box.x + target.x, box.y + target.y, { steps: 12 });
	await page.mouse.up();
}
