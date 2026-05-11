import type { Application } from 'pixi.js';
import type { BoardGameItemNew } from '$lib/pixi/item';
import type { HandContainer } from './HandContainer';

export interface PlayE2EState {
	visibleStackIds: string[];
	visibleBoardCardIds: string[];
	handCardIds: string[];
}

interface BoundsSnapshot {
	x: number;
	y: number;
	width: number;
	height: number;
	centerX: number;
	centerY: number;
}

interface PlayE2EBridge {
	state: () => PlayE2EState;
	bounds: (id: string) => BoundsSnapshot | null;
	clickPoint: (id: string) => { x: number; y: number } | null;
}

declare global {
	interface Window {
		__PIXI_E2E__?: PlayE2EBridge;
	}
}

function toBoundsSnapshot(app: Application, item: BoardGameItemNew): BoundsSnapshot {
	app.render();

	const pixiBounds = item.getBounds();
	const rect = 'rectangle' in pixiBounds ? pixiBounds.rectangle : pixiBounds;
	const canvasRect = app.canvas.getBoundingClientRect();
	const scaleX = canvasRect.width / app.screen.width;
	const scaleY = canvasRect.height / app.screen.height;

	const x = rect.x * scaleX;
	const y = rect.y * scaleY;
	const width = rect.width * scaleX;
	const height = rect.height * scaleY;

	return {
		x,
		y,
		width,
		height,
		centerX: x + width / 2,
		centerY: y + height / 2
	};
}

export function installPlayE2EBridge(
	app: Application,
	boardGameItems: Map<string, BoardGameItemNew>,
	handContainer: HandContainer
) {
	const bridge: PlayE2EBridge = {
		state() {
			const visibleStackIds: string[] = [];
			const visibleBoardCardIds: string[] = [];
			const handCardIds: string[] = [];

			for (const [id, item] of boardGameItems.entries()) {
				if (handContainer.hasItem(item)) {
					handCardIds.push(id);
					continue;
				}

				if (!item.visible || !item.renderable) {
					continue;
				}

				if (item.clientStack) {
					visibleStackIds.push(id);
				} else {
					visibleBoardCardIds.push(id);
				}
			}

			return {
				visibleStackIds,
				visibleBoardCardIds,
				handCardIds
			};
		},
		bounds(id) {
			const item = boardGameItems.get(id);
			if (!item || !item.visible || !item.renderable) return null;
			return toBoundsSnapshot(app, item);
		},
		clickPoint(id) {
			const bounds = bridge.bounds(id);
			if (!bounds) return null;
			return {
				x: bounds.centerX,
				y: bounds.centerY
			};
		}
	};

	window.__PIXI_E2E__ = bridge;

	return {
		clear() {
			delete window.__PIXI_E2E__;
		}
	};
}
