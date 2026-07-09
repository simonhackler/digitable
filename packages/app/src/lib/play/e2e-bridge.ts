import type { Application, Container, PointData } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { CardContainer, type BoardGameItemNew } from '$lib/pixi/item';
import type { HandContainer } from './HandContainer';
import type { StrokeLayer } from './strokes';
import type { StrokeFace } from 'boardgame-server/src/rooms/schema/stroke-schema';
import type { Table } from '../../routes/games/[gameName]/setup/table';
import { tableSlotCellPose } from './table-geometry';

export interface PlayE2EState {
	visibleStackIds: string[];
	stackComponentIds: Record<string, string[]>;
	visibleBoardCardIds: string[];
	handCardIds: string[];
	parentIds: Record<string, string>;
	cameraRotation: number;
	rotations: Record<string, { state: number; visual: number }>;
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
		width: number;
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
	slotPoint: (id: string, cellIndex?: number) => { x: number; y: number } | null;
}

declare global {
	interface Window {
		__PIXI_E2E__?: PlayE2EBridge;
	}
}

function toCanvasBoundsSnapshot(
	app: Application,
	rect: { x: number; y: number; width: number; height: number }
): BoundsSnapshot {
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

function toBoundsSnapshot(
	app: Application,
	item: BoardGameItemNew | CardContainer
): BoundsSnapshot {
	app.render();

	const pixiBounds = item.getBounds();
	const rect = 'rectangle' in pixiBounds ? pixiBounds.rectangle : pixiBounds;
	return toCanvasBoundsSnapshot(app, rect);
}

function toCanvasPoint(app: Application, global: PointData): { x: number; y: number } {
	app.render();

	const canvasRect = app.canvas.getBoundingClientRect();
	const scaleX = canvasRect.width / app.screen.width;
	const scaleY = canvasRect.height / app.screen.height;
	return {
		x: global.x * scaleX,
		y: global.y * scaleY
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

function normalizeDegrees(value: number) {
	return ((value % 360) + 360) % 360;
}

function effectiveVisualRotationDegrees(item: BoardGameItemNew, viewport: Viewport | null) {
	let rotation = item.visualRotationDegrees;
	let parent = item.parent as Container | null;
	while (parent && parent !== viewport && parent !== parent.parent) {
		if (viewport && parent.parent === viewport) break;
		rotation += parent.angle;
		parent = parent.parent;
	}
	return normalizeDegrees(rotation);
}

export function installPlayE2EBridge(
	app: Application,
	boardGameItems: Map<string, BoardGameItemNew>,
	handContainer: HandContainer,
	strokeLayer: StrokeLayer,
	viewport: Viewport | null = null,
	table: Table | null = null,
	tablePointToGlobal: (point: { x: number; y: number }) => PointData | null = (point) =>
		viewport ? viewport.toScreen(point.x, point.y) : null,
	cameraRotation: () => number = () => 0
) {
	const bridge: PlayE2EBridge = {
		state() {
			const visibleStackIds: string[] = [];
			const stackComponentIds: PlayE2EState['stackComponentIds'] = {};
			const visibleBoardCardIds: string[] = [];
			const handCardIds: string[] = [];
			const parentIds: PlayE2EState['parentIds'] = {};
			const rotations: PlayE2EState['rotations'] = {};
			const cardFaces: PlayE2EState['cardFaces'] = {};

			for (const [id, item] of boardGameItems.entries()) {
				parentIds[id] = item.clientPosition?.clientPositionState.parentId ?? '';
				rotations[id] = {
					state: item.clientPosition?.clientPositionState.rotation ?? 0,
					visual: effectiveVisualRotationDegrees(item, viewport)
				};
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
					stackComponentIds[id] = [...item.clientStack.clientStackState.componentIds];
				} else {
					visibleBoardCardIds.push(id);
				}
			}

			return {
				visibleStackIds,
				stackComponentIds,
				visibleBoardCardIds,
				handCardIds,
				parentIds,
				cameraRotation: cameraRotation(),
				rotations,
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
			if (item.clientStack) return toBoundsSnapshot(app, item);
			if (handContainer.hasItem(item) && item.itemContainer instanceof CardContainer) {
				return toBoundsSnapshot(app, item.itemContainer);
			}
			app.render();
			return toCanvasBoundsSnapshot(app, item.contentWorldBounds());
		},
		clickPoint(id) {
			const bounds = bridge.contentBounds(id) ?? bridge.bounds(id);
			if (!bounds) return null;
			return {
				x: bounds.centerX,
				y: bounds.centerY
			};
		},
		slotPoint(id, cellIndex = 0) {
			if (!table) return null;
			const slot = table.slots.find((candidate) => candidate.id === id);
			if (!slot) return null;
			if (slot.layout?.mode === 'horizontal-flex' || slot.layout?.mode === 'grid') {
				const pose = tableSlotCellPose(slot, cellIndex);
				const global = tablePointToGlobal({ x: pose.centerX, y: pose.centerY });
				return global ? toCanvasPoint(app, global) : null;
			}
			const global = tablePointToGlobal({
				x: slot.x + slot.width / 2,
				y: slot.y + slot.height / 2
			});
			return global ? toCanvasPoint(app, global) : null;
		}
	};

	window.__PIXI_E2E__ = bridge;

	return {
		clear() {
			delete window.__PIXI_E2E__;
		}
	};
}
