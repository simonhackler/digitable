import type { Application } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { CardContainer, type BoardGameItemNew } from '$lib/pixi/item';
import type { HandContainer } from './HandContainer';
import type { StrokeLayer } from './strokes';
import type { StrokeFace } from 'boardgame-server/src/rooms/schema/stroke-schema';
import type { TableSetup } from '../../routes/games/[gameName]/setup/table-setup';
import { SETUP_PLAY_CARD_HEIGHT, SETUP_PLAY_CARD_WIDTH } from './setup-play';

export interface PlayE2EState {
	visibleStackIds: string[];
	visibleBoardCardIds: string[];
	handCardIds: string[];
	cardFaces: Record<
		string,
		{
			isFaceUp: boolean;
			frontVisible: boolean;
			frontRenderable: boolean;
			backVisible: boolean;
			backRenderable: boolean;
			backWidth: number;
			backHeight: number;
		}
	>;
	strokes: {
		id: string;
		componentId: string;
		face: StrokeFace;
		visible: boolean;
		parentId: string | null;
		points: number;
	}[];
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
	contentBounds: (id: string) => BoundsSnapshot | null;
	clickPoint: (id: string) => { x: number; y: number } | null;
	slotPoint: (id: string) => { x: number; y: number } | null;
}

declare global {
	interface Window {
		__PIXI_E2E__?: PlayE2EBridge;
	}
}

function toBoundsSnapshot(app: Application, item: BoardGameItemNew | CardContainer): BoundsSnapshot {
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

function toCanvasPoint(
	app: Application,
	viewport: Viewport | null,
	worldX: number,
	worldY: number
): { x: number; y: number } | null {
	if (!viewport) return null;
	app.render();

	const screen = viewport.toScreen(worldX, worldY);
	const canvasRect = app.canvas.getBoundingClientRect();
	const scaleX = canvasRect.width / app.screen.width;
	const scaleY = canvasRect.height / app.screen.height;
	return {
		x: screen.x * scaleX,
		y: screen.y * scaleY
	};
}

function cardFaceSnapshot(item: BoardGameItemNew) {
	if (!(item.itemContainer instanceof CardContainer)) return null;

	const backBounds = item.itemContainer.backSprite.getLocalBounds();
	const backRect = 'rectangle' in backBounds ? backBounds.rectangle : backBounds;

	return {
		isFaceUp: item.clientFlippable?.clientFlippableState.isFaceUp ?? true,
		frontVisible: item.itemContainer.frontSprite.visible,
		frontRenderable: item.itemContainer.frontSprite.renderable,
		backVisible: item.itemContainer.backSprite.visible,
		backRenderable: item.itemContainer.backSprite.renderable,
		backWidth: backRect.width,
		backHeight: backRect.height
	};
}

export function installPlayE2EBridge(
	app: Application,
	boardGameItems: Map<string, BoardGameItemNew>,
	handContainer: HandContainer,
	strokeLayer: StrokeLayer,
	viewport: Viewport | null = null,
	setup: TableSetup | null = null,
	setupWorldOffset: () => { x: number; y: number } = () => ({ x: 0, y: 0 })
) {
	const bridge: PlayE2EBridge = {
		state() {
			const visibleStackIds: string[] = [];
			const visibleBoardCardIds: string[] = [];
			const handCardIds: string[] = [];
			const cardFaces: PlayE2EState['cardFaces'] = {};

			for (const [id, item] of boardGameItems.entries()) {
				const faceSnapshot = cardFaceSnapshot(item);
				if (faceSnapshot) {
					cardFaces[id] = faceSnapshot;
				}

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
				handCardIds,
				cardFaces,
				strokes: strokeLayer.strokeSnapshots()
			};
		},
		bounds(id) {
			const item = boardGameItems.get(id);
			if (!item || !item.visible || !item.renderable) return null;
			return toBoundsSnapshot(app, item);
		},
		contentBounds(id) {
			const item = boardGameItems.get(id);
			if (!item || !item.visible || !item.renderable) return null;
			if (!(item.itemContainer instanceof CardContainer)) return toBoundsSnapshot(app, item);
			return toBoundsSnapshot(app, item.itemContainer);
		},
		clickPoint(id) {
			const bounds = bridge.bounds(id);
			if (!bounds) return null;
			return {
				x: bounds.centerX,
				y: bounds.centerY
			};
		},
		slotPoint(id) {
			if (!setup) return null;
			const slot = setup.slots.find((candidate) => candidate.id === id);
			if (!slot) return null;
			const offset = setupWorldOffset();
			if (slot.layout?.mode === 'horizontal-flex') {
				return toCanvasPoint(
					app,
					viewport,
					offset.x + slot.x + SETUP_PLAY_CARD_WIDTH / 2,
					offset.y + slot.y + SETUP_PLAY_CARD_HEIGHT / 2
				);
			}
			return toCanvasPoint(
				app,
				viewport,
				offset.x + slot.x + slot.width / 2,
				offset.y + slot.y + slot.height / 2
			);
		}
	};

	window.__PIXI_E2E__ = bridge;

	return {
		clear() {
			delete window.__PIXI_E2E__;
		}
	};
}
