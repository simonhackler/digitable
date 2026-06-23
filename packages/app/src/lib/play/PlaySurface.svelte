<script lang="ts">
	import { Client, getStateCallbacks, type Room } from 'colyseus.js';
	import {
		Application,
		Container,
		type FederatedPointerEvent,
		Graphics,
		Point,
		Rectangle,
		RenderLayer,
		type Renderer
	} from 'pixi.js';
	import { MarqueeSelection } from '@pixi/marquee-selection';
	import '@pixi/layout';
	import { onMount, onDestroy } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { env } from '$env/dynamic/public';
	import { loadAndProcessCards } from './pixi-card-loader';
	import { type BoardGameRoomState } from 'boardgame-server/src/rooms/schema/MyRoomState';
	import { BoardGameItemNew } from '$lib/pixi/item';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { initDevtools } from '@pixi/devtools';
	import 'pixi.js/math-extras';
	import { PreviewHelper } from './hover-helpers';
	import { SelectionManager } from './SelectionManager';
	import { pixiToCSSCoordinates } from './coordinate-utils';
	import { createViewport } from './viewport-utils';
	import { FixedSlotLayout } from './FixedSlotLayout';
	import { HandContainer } from './HandContainer';
	import { assert } from '$lib/utils/assert';
	import type { Attachment } from 'svelte/attachments';
	import { PressedKeys } from 'runed';
	import { initComponent } from './initComponent';
	import { installPlayE2EBridge } from './e2e-bridge';
	import type { FsDir } from '$lib/components/file-browser/adapters/adapter';
	import { StrokeLayer, currentStrokeStyle, type PlayTool } from './strokes';
	import type { Table, TableSlot } from '../../routes/games/[gameName]/setup/table';
	import {
		buildTableInitPayload,
		buildTablePlayPlan,
		TABLE_NODE_ID,
		tableReferencedDeckNames,
		type LoadedDeck
	} from './table-play';
	import { createTableLayer } from './table-layer';
	import {
		findTableSlotAtPoint,
		tableItemMetadataById,
		tableSlotAcceptsItem,
		tableSlotIsFixedLayout,
		type TableItemMetadata
	} from './table-slot-rules';
	import {
		tableSlotCellCount,
		tableSlotCellIndexAtPoint,
		tableSlotCellRect,
		tableSlotTargetId,
		tableSlotTargetInfo
	} from './table-geometry';
	import {
		applyTableCameraTransform,
		clampTableItemPose,
		configureTableItem,
		configureTableViewport,
		drawPreviewRect,
		loadRequiredTable,
		normalizeRotation,
		setTableItemPose,
		setTableItemRotation,
		setTableItemVisualPointUnderPointer,
		tableDropPreviewRect,
		tableItemCenter,
		tableItemPose,
		tableItemRotation,
		visualPointerRatio,
		type LocalTable
	} from './table-surface';
	import PlaytestNotes from './PlaytestNotes.svelte';
	import type { ClientPlacement } from './frontend-components/position';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import MousePointer2Icon from '@lucide/svelte/icons/mouse-pointer-2';
	import PenLineIcon from '@lucide/svelte/icons/pen-line';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	type PlayRoomConnection =
		| { kind: 'localPlay' }
		| {
				kind: 'privatePlaytest';
				privateRoomId: string;
				getAuthToken: () => Promise<string>;
		  };

	const defaultRoomConnection: PlayRoomConnection = { kind: 'localPlay' };

	let {
		projectName,
		fileSystem,
		roomConnection = defaultRoomConnection,
		playtestFeedback = null,
		e2e = false
	}: {
		projectName: string;
		fileSystem: FsDir;
		roomConnection?: PlayRoomConnection;
		playtestFeedback?: { playtestId: string } | null;
		e2e?: boolean;
	} = $props();

	const gameServerUrl = env.PUBLIC_GAME_SERVER_URL;
	if (!gameServerUrl) {
		throw new Error('PUBLIC_GAME_SERVER_URL is not configured');
	}
	const client = new Client(gameServerUrl);
	let playE2EBridge: ReturnType<typeof installPlayE2EBridge> | null = null;
	const privatePlaytestReconnectTokenPrefix = 'svg-table:playtest-reconnect-token:';

	function isE2EMode() {
		return e2e;
	}

	function privatePlaytestReconnectTokenKey(privateRoomId: string) {
		return `${privatePlaytestReconnectTokenPrefix}${privateRoomId}`;
	}

	function getPrivatePlaytestReconnectToken(privateRoomId: string) {
		if (typeof sessionStorage === 'undefined') return null;
		return sessionStorage.getItem(privatePlaytestReconnectTokenKey(privateRoomId));
	}

	function setPrivatePlaytestReconnectToken(privateRoomId: string, room: Room<BoardGameRoomState>) {
		if (typeof sessionStorage === 'undefined') return;
		sessionStorage.setItem(privatePlaytestReconnectTokenKey(privateRoomId), room.reconnectionToken);
	}

	function clearPrivatePlaytestReconnectToken(privateRoomId: string) {
		if (typeof sessionStorage === 'undefined') return;
		sessionStorage.removeItem(privatePlaytestReconnectTokenKey(privateRoomId));
	}

	let boardGameItems: SvelteMap<string, BoardGameItemNew> = new SvelteMap();
	function sendCmd<T extends string, P>(
		room: Room<BoardGameRoomState>,
		commandType: T,
		payload: P
	) {
		room.send('cmd', { commandType, payload });
	}

	let showContextMenu = $state(false);
	let contextMenuPosition = $state({ x: 0, y: 0 });

	function handleRightClick(e: FederatedPointerEvent) {
		e.preventDefault();
		e.stopPropagation();

		if (!showContextMenu) {
			const cssPosition = pixiToCSSCoordinates(app, e.globalX, e.globalY);
			contextMenuPosition = cssPosition;
			showContextMenu = true;
		}
	}

	function closeContextMenu() {
		showContextMenu = false;
	}

	function handleFlipCard(item: BoardGameItemNew) {
		console.log(item.id);
		item.clientFlippable?.flip();
		closeContextMenu();
	}

	let boardContainer: Container;
	let handContainer: HandContainer;
	let fixedSlotLayout: FixedSlotLayout | null = null;
	let tableLayer: Container | null = null;
	let strokeLayer: StrokeLayer;
	let tableDropPreviewLayer: Graphics | null = null;
	let stackDropPreviewLayer: Graphics | null = null;
	let movingCardLayer: RenderLayer | null = null;
	let tableWorldOffset = { x: 0, y: 0 };

	// let viewport: Viewport;
	let tableItemMetadata: Map<string, TableItemMetadata> = new SvelteMap();

	let hoverItem: BoardGameItemNew | null = null;
	let selectionManager = new SelectionManager();
	let activeTool = $state<PlayTool>('select');
	const penWidthMin = 0.25;
	const penWidthMax = 10;
	const penWidthStep = 0.25;
	let penWidth = $state(currentStrokeStyle.width);
	let selectedStrokeId = $state<string | null>(null);
	let notesOpen = $state(false);
	let notesHaveDraft = $state(false);
	let cameraRotationValue = 0;
	let cameraRotation = $state(0);
	const keys = new PressedKeys();

	function selectTool(tool: PlayTool) {
		activeTool = tool;
		if (tool === 'pen') {
			selectionManager.clear();
			strokeLayer?.select(null);
			selectedStrokeId = null;
		} else {
			strokeLayer?.cancelDraft();
		}
	}

	function setPenWidth(value: number) {
		if (!Number.isFinite(value)) return;
		const stepped = Math.round(value / penWidthStep) * penWidthStep;
		penWidth = Math.round(Math.min(Math.max(stepped, penWidthMin), penWidthMax) * 100) / 100;
	}

	function handlePenWidthInput(event: Event) {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement)) return;
		setPenWidth(input.valueAsNumber);
	}

	function penStrokeStyle() {
		return { ...currentStrokeStyle, width: penWidth };
	}

	function deleteSelectedStroke() {
		const strokeId = strokeLayer?.selectedId;
		if (!strokeId) return;
		sendCmd(room, 'strokeDelete', { strokeId });
		strokeLayer.select(null);
		selectedStrokeId = null;
	}

	keys.onKeys('Escape', () => {
		closeContextMenu();
		selectTool('select');
	});
	keys.onKeys('F', () => {
		selectionManager.forEach((item) => handleFlipCard(item));
	});
	keys.onKeys('D', () => {
		handleDrawSelection();
	});
	keys.onKeys('S', () => {
		selectionManager.forEach((item) => handleShuffleStack(item));
	});
	keys.onKeys('Q', () => {
		rotateSelectedItems(-90);
	});
	keys.onKeys('E', () => {
		rotateSelectedItems(90);
	});
	keys.onKeys('P', () => {
		selectTool('pen');
	});
	keys.onKeys('V', () => {
		selectTool('select');
	});
	keys.onKeys('Delete', () => {
		deleteSelectedStroke();
	});
	keys.onKeys('alt', () => {
		if (hoverItem) {
			previewer.showPreview(hoverItem);
		}
	});

	type DragState = {
		originGlobalX: number;
		originGlobalY: number;
		startGlobalX: number;
		startGlobalY: number;
		clickThreshold: number;
		hasMoved: boolean;
		dragType: 'marquee' | 'selection' | 'handToBoard' | 'strokeDraft';
		startPositions?: Map<string, ClientPlacement>;
		visualPointerRatios?: Map<string, { x: number; y: number }>;
	} | null;

	let drag: DragState = null;

	function tableForPlay(): Table {
		return localTable.table;
	}

	function metadataForTableItem(item: BoardGameItemNew): TableItemMetadata {
		const metadata = tableItemMetadata.get(item.id);
		if (metadata) return metadata;
		return {
			id: item.id,
			type: item.clientStack ? 'stack' : 'card',
			componentIds: item.clientStack
				? [...item.clientStack.clientStackState.componentIds]
				: [item.id]
		};
	}

	function rectFromBounds(bounds: ReturnType<Container['getBounds']>) {
		const rect = 'rectangle' in bounds ? bounds.rectangle : bounds;
		return {
			x: rect.x,
			y: rect.y,
			width: rect.width,
			height: rect.height
		};
	}

	function tableLayers(): Array<Container | Graphics | null | undefined> {
		return [tableLayer, boardContainer, tableDropPreviewLayer, movingCardLayer];
	}

	function applyCurrentTableCameraTransform(table = tableForPlay()) {
		applyTableCameraTransform({
			table,
			cameraRotation: cameraRotationValue,
			tableWorldOffset,
			containers: tableLayers()
		});
	}

	function configureCurrentTableViewport(table = tableForPlay()) {
		tableWorldOffset = configureTableViewport({
			app,
			viewport,
			table,
			cameraRotation: cameraRotationValue,
			containers: tableLayers()
		});
	}

	function rotateCamera(delta: number) {
		cameraRotationValue = normalizeRotation(cameraRotationValue + delta);
		cameraRotation = cameraRotationValue;
		configureCurrentTableViewport();
	}

	function resetCameraRotation() {
		cameraRotationValue = 0;
		cameraRotation = cameraRotationValue;
		configureCurrentTableViewport();
	}

	function tableItemParentId(item: BoardGameItemNew) {
		return item.clientPosition?.clientPositionState.parentId || TABLE_NODE_ID;
	}

	function tableItemFixedSlot(item: BoardGameItemNew) {
		const target = tableSlotTargetInfo(tableForPlay(), tableItemParentId(item));
		return target && tableSlotIsFixedLayout(target.slot) ? target : null;
	}

	function canRotateItem(item: BoardGameItemNew) {
		if (!item.clientPosition) return false;
		if (handContainer.hasItem(item)) return false;
		if (tableItemFixedSlot(item)) return false;
		return true;
	}

	function rotateSelectedItems(delta: number) {
		if (drag) return;
		for (const item of selectionManager.values()) {
			if (!canRotateItem(item)) continue;
			const rotation = normalizeRotation(tableItemRotation(item) + delta);
			setTableItemRotation(item, rotation);
			item.clientPosition?.moveEnd(tableItemPlacement(item, tableTargetNodeId(item), rotation));
		}
		strokeLayer?.refreshAll();
	}

	function fixedSlotCellOccupant(slot: TableSlot, cellIndex: number, ignoredItemId: string | null) {
		const targetId = tableSlotTargetId(slot, cellIndex);
		for (const item of boardGameItems.values()) {
			if (item.id === ignoredItemId) continue;
			if (handContainer.hasItem(item)) continue;
			if (tableItemParentId(item) === targetId) return item.id;
		}
		return null;
	}

	function firstAvailableFixedSlotCell(slot: TableSlot, item: BoardGameItemNew) {
		const currentTarget = tableSlotTargetInfo(tableForPlay(), tableItemParentId(item));
		if (currentTarget && currentTarget.slot.id === slot.id && currentTarget.cellIndex !== null) {
			return currentTarget.cellIndex;
		}

		const cellCount = tableSlotCellCount(slot);
		for (let index = 0; index < cellCount; index += 1) {
			if (!fixedSlotCellOccupant(slot, index, item.id)) return index;
		}
		return null;
	}

	function fixedSlotDropCellIndex(
		slot: TableSlot,
		item: BoardGameItemNew,
		point: { x: number; y: number }
	) {
		if (!tableSlotIsFixedLayout(slot)) return null;
		if (slot.layout?.mode === 'grid') return tableSlotCellIndexAtPoint(slot, point);
		return firstAvailableFixedSlotCell(slot, item);
	}

	function drawTableDropPreview(item: BoardGameItemNew, point: { x: number; y: number }) {
		const table = tableForPlay();
		if (!tableDropPreviewLayer) return;

		tableDropPreviewLayer.clear();
		const slot = findTableSlotAtPoint(table, point);
		if (!slot) return;

		const cellIndex = fixedSlotDropCellIndex(slot, item, point);
		const accepted = canPlaceItemInTableSlot(item, slot.id, cellIndex);
		const rect = accepted
			? tableDropPreviewRect(slot, item.id, [], cellIndex)
			: cellIndex !== null
				? tableSlotCellRect(slot, cellIndex)
				: {
						x: slot.x,
						y: slot.y,
						width: slot.width,
						height: slot.height,
						rotation: slot.rotation ?? 0
					};
		if (!rect) return;

		drawPreviewRect(tableDropPreviewLayer, rect, accepted);
	}

	function clearTableDropPreview() {
		tableDropPreviewLayer?.clear();
	}

	function clearStackDropPreview() {
		stackDropPreviewLayer?.clear();
	}

	function drawStackDropPreview(target: BoardGameItemNew) {
		if (!stackDropPreviewLayer) return;
		const bounds = rectFromBounds(target.getBounds());
		stackDropPreviewLayer.clear();
		stackDropPreviewLayer
			.roundRect(bounds.x - 8, bounds.y - 8, bounds.width + 16, bounds.height + 16, 12)
			.fill({ color: 0x22c55e, alpha: 0.1 })
			.stroke({ color: 0x16a34a, width: 5, alpha: 0.9 });
	}

	function clearMovingCardLayer() {
		movingCardLayer?.detachAll();
	}

	function attachMovingSelection() {
		const items = [...selectionManager.values()];
		if (items.length > 0) movingCardLayer?.attach(...items);
	}

	function prepareSelectionForBoardDrag() {
		for (const item of selectionManager.values()) {
			if (handContainer.hasItem(item)) continue;
			if (fixedSlotLayout?.detachItemToBoard(item)) {
				item.clientPosition?.applyLocalPlacement(tableItemPlacement(item, TABLE_NODE_ID));
				movingCardLayer?.attach(item);
			}
		}
		strokeLayer?.refreshAll();
	}

	function tableTargetNodeId(item: BoardGameItemNew) {
		return tableItemParentId(item);
	}

	function tableItemCommandPosition(item: BoardGameItemNew) {
		if (item.positionManagedByLayout) {
			const bounds = item.contentBoundsIn(boardContainer);
			return { x: bounds.x, y: bounds.y };
		}
		return { x: item.x, y: item.y };
	}

	function tableItemCommandRotation(item: BoardGameItemNew) {
		const target = item.positionManagedByLayout ? tableItemFixedSlot(item) : null;
		return target ? normalizeRotation(target.slot.rotation ?? 0) : tableItemRotation(item);
	}

	function tableItemPlacement(
		item: BoardGameItemNew,
		parentId: string,
		rotation = tableItemCommandRotation(item)
	): ClientPlacement {
		const position = tableItemCommandPosition(item);
		return {
			x: position.x,
			y: position.y,
			rotation,
			parentId,
			visible: item.visible
		};
	}

	function syncTableBoardPosition(item: BoardGameItemNew, parentId = tableTargetNodeId(item)) {
		if (!item.clientPosition) return;
		const placement = tableItemPlacement(item, parentId);
		item.clientPosition.moveTo(placement);
		item.clientPosition.moveEnd(placement);
	}

	function applyTableItemPlacement(item: BoardGameItemNew, placement: ClientPlacement) {
		item.visible = placement.visible ?? true;
		item.renderable = item.visible;
		if (fixedSlotLayout?.hasTarget(placement.parentId)) {
			fixedSlotLayout.placeItem(placement.parentId, item);
			return;
		}

		fixedSlotLayout?.detachItemToBoard(item, placement.rotation);
		if (item.parent !== boardContainer) {
			item.parent?.removeChild(item);
			boardContainer.addChild(item);
		}
		configureTableItem(item);
		item.position.set(placement.x, placement.y);
		setTableItemRotation(item, placement.rotation);
		strokeLayer?.refreshAll();
	}

	function returnTableCardToHand(item: BoardGameItemNew) {
		if (!handContainer.hasItem(item)) {
			item.parent?.removeChild(item);
			handContainer.addItem(item);
		} else {
			item.x = 0;
			item.y = 0;
		}
	}

	function tableSlotById(slotId: string) {
		return tableForPlay().slots.find((slot) => slot.id === slotId) ?? null;
	}

	function canPlaceItemInTableSlot(
		item: BoardGameItemNew,
		slotId: string,
		cellIndex: number | null = null
	): boolean {
		const slot = tableSlotById(slotId);
		if (!slot) return false;
		if (!tableSlotAcceptsItem(slot, metadataForTableItem(item))) return false;

		if (tableSlotIsFixedLayout(slot)) {
			if (cellIndex === null) return false;
			const occupant = fixedSlotCellOccupant(slot, cellIndex, item.id);
			return !occupant || occupant === item.id;
		}
		return true;
	}

	function placeItemInTableSlot(
		item: BoardGameItemNew,
		slotId: string,
		fromHand: boolean,
		cellIndex: number | null = null
	): boolean {
		const table = tableForPlay();
		const slot = tableSlotById(slotId);
		if (!slot || !canPlaceItemInTableSlot(item, slot.id, cellIndex)) return false;

		const targetId = tableSlotIsFixedLayout(slot) ? tableSlotTargetId(slot, cellIndex) : slot.id;
		if (tableSlotIsFixedLayout(slot)) {
			if (!fixedSlotLayout?.placeItem(targetId, item)) return false;
		} else {
			fixedSlotLayout?.detachItemToBoard(item);
			configureTableItem(item);
			setTableItemPose(item, clampTableItemPose(table, item, tableItemPose(item)));
		}
		item.clientPosition?.applyLocalPlacement(tableItemPlacement(item, targetId));
		if (fromHand) {
			handlePlayCard(item, targetId);
		} else {
			syncTableBoardPosition(item, targetId);
		}
		return true;
	}

	function restoreTableItemPosition(
		item: BoardGameItemNew,
		originalPosition: ClientPlacement | undefined
	) {
		if (!originalPosition) return;
		applyTableItemPlacement(item, originalPosition);
		item.clientPosition?.moveEnd(originalPosition);
	}

	function commitTableDrop(
		item: BoardGameItemNew,
		fromHand: boolean,
		originalPosition: ClientPlacement | undefined,
		dropPoint?: { x: number; y: number }
	) {
		const table = tableForPlay();

		const clampedPose = clampTableItemPose(table, item, tableItemPose(item));
		setTableItemPose(item, clampedPose);
		const slot = findTableSlotAtPoint(
			table,
			dropPoint ?? { x: clampedPose.centerX, y: clampedPose.centerY }
		);

		if (slot) {
			const cellIndex = fixedSlotDropCellIndex(
				slot,
				item,
				dropPoint ?? { x: clampedPose.centerX, y: clampedPose.centerY }
			);
			if (placeItemInTableSlot(item, slot.id, fromHand, cellIndex)) return true;
			if (fromHand) {
				returnTableCardToHand(item);
			} else {
				restoreTableItemPosition(item, originalPosition);
			}
			return false;
		}

		fixedSlotLayout?.detachItemToBoard(item);
		configureTableItem(item);
		if (fromHand) {
			handlePlayCard(item, TABLE_NODE_ID);
		} else {
			syncTableBoardPosition(item, TABLE_NODE_ID);
		}
		strokeLayer?.refreshAll();
		return true;
	}

	function findTopLevelItem(curr: Container) {
		while (curr != viewport && curr != app.stage) {
			if (
				curr instanceof BoardGameItemNew &&
				curr.parent &&
				!(curr.parent instanceof BoardGameItemNew)
			) {
				return curr;
			}
			curr = curr.parent!;
		}
		return null;
	}

	function findStackTargetAtPoint(
		dragged: BoardGameItemNew,
		point: { x: number; y: number }
	): BoardGameItemNew | null {
		for (const item of boardGameItems.values()) {
			if (item === dragged) continue;
			if (!item.visible || !item.renderable) continue;
			if (handContainer.hasItem(item)) continue;
			const itemBounds = item.getBounds();
			if (
				point.x >= itemBounds.x &&
				point.x <= itemBounds.x + itemBounds.width &&
				point.y >= itemBounds.y &&
				point.y <= itemBounds.y + itemBounds.height
			) {
				return item;
			}
		}
		return null;
	}

	function stackTargetForItem(
		item: BoardGameItemNew,
		point: { x: number; y: number }
	): BoardGameItemNew | null {
		if (item.clientStack) return null;
		if (handContainer.hasItem(item)) return null;
		return findStackTargetAtPoint(item, point);
	}

	function selectedItemStackPoint(item: BoardGameItemNew) {
		const bounds = item.getBounds();
		return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
	}

	function tryStackSelection(point: { x: number; y: number }): boolean {
		if (!keys.has('Shift')) return false;
		if (selectionManager.size !== 1) return false;
		const iterator = selectionManager.values();
		const item = iterator.next().value as BoardGameItemNew | undefined;
		if (!item) return false;

		const target = stackTargetForItem(item, point);
		if (!target) return false;

		fixedSlotLayout?.detachItemToBoard(item);
		item.clientPosition?.applyLocalPlacement(tableItemPlacement(item, TABLE_NODE_ID));
		const targetPosition = tableItemCommandPosition(target);
		sendCmd(room, 'stack', {
			sourceId: item.id,
			targetId: target.id,
			x: targetPosition.x,
			y: targetPosition.y
		});
		return true;
	}

	function stackTargetForSelection(point?: { x: number; y: number }): BoardGameItemNew | null {
		if (!keys.has('Shift')) return null;
		if (selectionManager.size !== 1) return null;
		const item = selectionManager.values().next().value as BoardGameItemNew | undefined;
		return item ? stackTargetForItem(item, point ?? selectedItemStackPoint(item)) : null;
	}

	function updateStackDropPreview(point?: { x: number; y: number }) {
		const target = stackTargetForSelection(point);
		if (!target) {
			clearStackDropPreview();
			return false;
		}
		clearTableDropPreview();
		drawStackDropPreview(target);
		return true;
	}

	async function initApp() {
		const app = new Application();
		await app.init({
			background: '#111827',
			width: 1,
			height: 1,
			antialias: true,
			resolution: window.devicePixelRatio || 1,
			autoDensity: true
		});
		initDevtools({ app });
		window.__PIXI_DEVTOOLS__ = {
			app
		};
		return app;
	}

	async function initEditor(app: Application<Renderer>, previewer: PreviewHelper) {
		// viewport = createViewport(app, {
		// 	worldWidth: localTable.table.table.width,
		// 	worldHeight: localTable.table.table.height,
		// 	minScale: 0.2
		// });

		app.stage.eventMode = 'static';

		function resizeViewportToScreen() {
			app.stage.hitArea = app.screen;
			configureCurrentTableViewport(localTable.table);
		}
		resizeViewportToScreen();
		app.renderer.on('resize', resizeViewportToScreen);

		tableLayer = await createTableLayer(localTable);
		viewport.addChild(tableLayer);
		configureCurrentTableViewport(localTable.table);

		boardContainer = new Container();
		applyCurrentTableCameraTransform(localTable.table);
		viewport.addChild(boardContainer);
		fixedSlotLayout = new FixedSlotLayout(localTable.table, boardContainer);
		tableDropPreviewLayer = new Graphics();
		tableDropPreviewLayer.eventMode = 'none';
		tableDropPreviewLayer.interactiveChildren = false;
		viewport.addChild(tableDropPreviewLayer);
		applyCurrentTableCameraTransform(localTable.table);

		const screenContainer = new Container();
		const updateScreenContainerLayout = () => {
			screenContainer.layout = {
				width: app.screen.width,
				height: app.screen.height,
				flexDirection: 'column',
				justifyContent: 'flex-end',
				alignItems: 'center'
			};
		};
		updateScreenContainerLayout();
		app.renderer.on('resize', updateScreenContainerLayout);

		app.stage.addChild(screenContainer);

		handContainer = new HandContainer(app);
		screenContainer.addChild(handContainer.container);
		strokeLayer = new StrokeLayer(boardGameItems, handContainer);
		app.ticker.add(() => {
			for (const item of boardGameItems.values()) {
				if (item.isInHand) continue;
				item.clientPosition?.tick();
			}
		});

		const width = 200;
		const height = 200;

		const marquee = new MarqueeSelection({
			dash: 4,
			dashSpace: 4,
			thickness: 1,
			speed: 0.2,
			width,
			height,
			color: 'black',
			x: ((app.screen.width - width) / 2) | 0,
			y: ((app.screen.height - height) / 2) | 0
		});
		marquee.visible = false;

		function endDrag(e: FederatedPointerEvent) {
			if (strokeLayer?.isDrawing) {
				const stroke = strokeLayer.finishDraft();
				if (stroke) {
					sendCmd(room, 'strokeCreate', {
						id: crypto.randomUUID(),
						componentId: stroke.componentId,
						face: stroke.face,
						points: stroke.points,
						style: stroke.style
					});
				}
				drag = null;
				clearMovingCardLayer();
				clearTableDropPreview();
				clearStackDropPreview();
				return;
			}

			if (!drag) return;

			if (e.button === 2) {
				drag = null;
				clearMovingCardLayer();
				clearTableDropPreview();
				clearStackDropPreview();
				return;
			}

			if (drag.dragType == 'marquee') {
				marquee.visible = false;
				const global = app.stage.toGlobal(marquee.position);
				const selectionRect = new Rectangle(
					Math.min(global.x, e.globalX),
					Math.min(global.y, e.globalY),
					marquee.width,
					marquee.height
				);
				for (const item of boardGameItems.values()) {
					const itemBounds = item.getBounds();
					if (selectionRect.intersects(new Rectangle().copyFromBounds(itemBounds))) {
						selectionManager.select(item);
					}
				}
			} else if (drag.dragType == 'selection') {
				const stacked = tryStackSelection(e.global);
				if (!drag.hasMoved && !stacked) {
					for (const c of selectionManager.values()) {
						if (handContainer.hasItem(c)) {
							c.x = 0;
							c.y = 0;
						}
						c.cursor = 'pointer';
					}
				} else {
					for (const c of selectionManager.values()) {
						if (!stacked) {
							commitTableDrop(c, false, drag.startPositions?.get(c.id));
						}
						c.cursor = 'pointer';
					}
					if (stacked) {
						selectionManager.clear();
					}
				}
			} else if (drag.dragType == 'handToBoard') {
				if (!drag.hasMoved) {
					for (const c of selectionManager.values()) {
						c.cursor = 'pointer';
					}
				} else {
					const dropPoint = boardContainer.toLocal(e.global);
					const stacked = tryStackSelection(e.global);
					for (const c of selectionManager.values()) {
						if (handContainer.hasItem(c)) {
							c.x = 0;
							c.y = 0;
						} else if (!stacked) {
							commitTableDrop(c, true, drag.startPositions?.get(c.id), {
								x: dropPoint.x,
								y: dropPoint.y
							});
						}
						c.cursor = 'pointer';
					}
					if (stacked) {
						selectionManager.clear();
					}
					strokeLayer?.refreshAll();
				}
			}
			drag = null;
			clearMovingCardLayer();
			clearTableDropPreview();
			clearStackDropPreview();
		}

		app.stage.addChild(marquee);
		stackDropPreviewLayer = new Graphics();
		stackDropPreviewLayer.eventMode = 'none';
		stackDropPreviewLayer.interactiveChildren = false;
		app.stage.addChild(stackDropPreviewLayer);
		movingCardLayer = new RenderLayer();
		viewport.addChild(movingCardLayer);
		applyCurrentTableCameraTransform(localTable.table);

		app.stage.on('pointermove', (e) => {
			previewer.updatePointer(e.global.x, e.global.y);
			const topItem = findTopLevelItem(e.target);
			if (topItem) {
				hoverItem = topItem;
			} else {
				hoverItem = null;
			}
			selectionManager.setHover(drag || strokeLayer?.isDrawing ? null : hoverItem);
			if (hoverItem && keys.has('Alt')) {
				previewer.showPreview(hoverItem);
			} else {
				previewer.hidePreview();
			}
			if (strokeLayer?.isDrawing) {
				strokeLayer.addDraftPoint(e.global);
				return;
			}
			if (!drag) return;
			if (
				!drag.hasMoved &&
				Math.hypot(e.global.x - drag.originGlobalX, e.global.y - drag.originGlobalY) >=
					drag.clickThreshold
			) {
				drag.hasMoved = true;
				if (drag.dragType === 'selection') {
					prepareSelectionForBoardDrag();
				}
			}

			if (drag.dragType == 'marquee') {
				const width = e.global.x - drag.startGlobalX + e.globalX - marquee.x;
				const height = e.global.y - drag.startGlobalY + e.globalY - marquee.y;
				marquee.resize(width, height);
			} else if (drag.dragType == 'selection') {
				for (const boardItem of selectionManager.values()) {
					if (boardItem.clientPosition) {
						const pointer = boardContainer.toLocal(e.global);
						const startPointer = boardContainer.toLocal(
							new Point(drag.startGlobalX, drag.startGlobalY)
						);
						const delta = pointer.subtract(startPointer);
						const currentPose = tableItemPose(boardItem);
						const nextPose = clampTableItemPose(tableForPlay(), boardItem, {
							...currentPose,
							centerX: currentPose.centerX + delta.x,
							centerY: currentPose.centerY + delta.y
						});
						setTableItemPose(boardItem, nextPose);
						boardItem.clientPosition.moveTo(
							tableItemPlacement(boardItem, tableTargetNodeId(boardItem))
						);
					}
				}
			} else if (drag.dragType == 'handToBoard') {
				for (const boardItem of selectionManager.values()) {
					if (handContainer.hasItem(boardItem)) {
						const deltaX = e.global.x - drag.startGlobalX;
						const deltaY = e.global.y - drag.startGlobalY;
						const wrapper = boardItem.parent;
						if (wrapper) {
							const wrapperGlobal = wrapper.toGlobal(boardItem.position);
							const newGlobalX = wrapperGlobal.x + deltaX;
							const newGlobalY = wrapperGlobal.y + deltaY;

							const newLocal = wrapper.toLocal({ x: newGlobalX, y: newGlobalY });
							boardItem.position.set(newLocal.x, newLocal.y);

							const pointerRatio =
								drag.visualPointerRatios?.get(boardItem.id) ??
								visualPointerRatio(app, boardItem, e.global);
							const liftedFromHand = e.global.y < drag.originGlobalY - drag.clickThreshold;

							if (liftedFromHand) {
								handContainer.removeItem(boardItem);
								boardContainer.addChild(boardItem);
								movingCardLayer?.attach(boardItem);
								boardItem.rotation = 0;
								boardItem.pivot.set(0, 0);
								boardItem.alpha = 1.0;
								setTableItemRotation(boardItem, normalizeRotation(-cameraRotationValue));
								configureTableItem(boardItem);

								drag.startGlobalX = e.global.x;
								drag.startGlobalY = e.global.y;
								setTableItemVisualPointUnderPointer({
									boardContainer,
									table: tableForPlay(),
									item: boardItem,
									pointer: e.global,
									ratio: pointerRatio
								});
							}
						}
					} else {
						const pointerRatio =
							drag.visualPointerRatios?.get(boardItem.id) ??
							visualPointerRatio(app, boardItem, e.global);
						setTableItemVisualPointUnderPointer({
							boardContainer,
							table: tableForPlay(),
							item: boardItem,
							pointer: e.global,
							ratio: pointerRatio
						});
					}
				}
			}
			const stackPreview =
				(drag.dragType === 'selection' || drag.dragType === 'handToBoard') &&
				updateStackDropPreview(e.global);
			if (!stackPreview) {
				const previewItem = selectionManager.values().next().value as BoardGameItemNew | undefined;
				if (previewItem && !handContainer.hasItem(previewItem)) {
					const previewPoint =
						drag.dragType === 'handToBoard'
							? boardContainer.toLocal(e.global)
							: tableItemCenter(previewItem);
					drawTableDropPreview(previewItem, { x: previewPoint.x, y: previewPoint.y });
				} else {
					clearTableDropPreview();
				}
				clearStackDropPreview();
			}
			drag.startGlobalX = e.global.x;
			drag.startGlobalY = e.global.y;
		});

		app.stage.on('pointerup', endDrag);
		app.stage.on('pointerupoutside', endDrag);
		app.stage.on('pointerdown', (e) => {
			const boardItem = findTopLevelItem(e.target);
			if (e.button === 2) {
				if (boardItem) handleRightClick(e);
				return;
			}

			if (activeTool === 'pen') {
				const target = boardItem ? strokeLayer.resolveTarget(boardItem) : null;
				if (!target) return;

				selectionManager.clear();
				selectionManager.setHover(null);
				strokeLayer.select(null);
				selectedStrokeId = null;
				strokeLayer.beginDraft(target, e.global, penStrokeStyle());
				drag = {
					originGlobalX: e.global.x,
					originGlobalY: e.global.y,
					startGlobalX: e.global.x,
					startGlobalY: e.global.y,
					clickThreshold: 0,
					hasMoved: false,
					dragType: 'strokeDraft'
				};
				return;
			}

			const strokeHit = strokeLayer.hitTest(e.global);
			if (strokeHit) {
				selectionManager.clear();
				strokeLayer.select(strokeHit);
				selectedStrokeId = strokeHit.strokeId;
				drag = null;
				return;
			}

			strokeLayer.select(null);
			selectedStrokeId = null;

			if (boardItem) {
				if (e.ctrlKey) {
					if (selectionManager.has(boardItem) && e.button === 1) {
						selectionManager.deselect(boardItem);
					} else {
						selectionManager.select(boardItem);
					}
				} else {
					selectionManager.selectOnly(boardItem);
				}
			}
			if (!boardItem) {
				selectionManager.clear();
			}

			// Determine drag type based on whether the item is in hand
			let dragType: 'marquee' | 'selection' | 'handToBoard' = 'selection';
			if (boardItem && handContainer.hasItem(boardItem)) {
				dragType = 'handToBoard';
				// Don't immediately move card from hand - let it stay until more than half is dragged out
			}

			drag = {
				originGlobalX: e.global.x,
				originGlobalY: e.global.y,
				startGlobalX: e.global.x,
				startGlobalY: e.global.y,
				clickThreshold: 10,
				hasMoved: false,
				dragType: dragType,
				startPositions: new Map(
					[...selectionManager.values()].map((item) => [
						item.id,
						tableItemPlacement(item, tableTargetNodeId(item))
					])
				),
				visualPointerRatios: new Map(
					[...selectionManager.values()].map((item) => [
						item.id,
						visualPointerRatio(app, item, e.global)
					])
				)
			};
			if (e.shiftKey && !boardItem) {
				drag.dragType = 'marquee';
				marquee.position.copyFrom(e.global);
				marquee.visible = true;
				marquee.resize(2, 2);
			} else if (!boardItem || (!selectionManager.has(boardItem) && dragType !== 'handToBoard')) {
				drag = null;
			} else {
				attachMovingSelection();
			}
		});
		return true;
	}

	async function createRoom() {
		if (isE2EMode() && !playE2EBridge) {
			playE2EBridge = installPlayE2EBridge(
				app,
				boardGameItems,
				handContainer,
				strokeLayer,
				viewport,
				localTable.table,
				(point) => boardContainer?.toGlobal(new Point(point.x, point.y)) ?? null,
				() => cameraRotationValue
			);
		}
		const tableDeckNames = tableReferencedDeckNames(localTable.table);
		const loadedDecks: LoadedDeck[] = await Promise.all(
			Array.from(tableDeckNames)
				.sort((a, b) => a.localeCompare(b))
				.map(async (deckName) => ({
					deckName,
					cards: await loadAndProcessCards(projectName, deckName, fileSystem)
				}))
		);
		const allComponentsParsed = loadedDecks.flatMap((deck) => deck.cards);
		const tablePlayPlan = buildTablePlayPlan(localTable.table, loadedDecks);
		tableItemMetadata = new SvelteMap(tableItemMetadataById(tablePlayPlan));
		const privatePlaytest = roomConnection.kind === 'privatePlaytest' ? roomConnection : null;
		const roomType = privatePlaytest ? 'private_room' : 'my_room';
		const roomOptions = privatePlaytest
			? { privateRoomId: privatePlaytest.privateRoomId }
			: undefined;
		const shouldCreateRoom = !privatePlaytest;
		let room: Room<BoardGameRoomState> | null = null;
		if (shouldCreateRoom) {
			room = await client.create<BoardGameRoomState>(roomType, roomOptions);
		} else {
			const reconnectToken = getPrivatePlaytestReconnectToken(privatePlaytest.privateRoomId);
			if (reconnectToken) {
				try {
					room = await client.reconnect<BoardGameRoomState>(reconnectToken);
				} catch {
					clearPrivatePlaytestReconnectToken(privatePlaytest.privateRoomId);
				}
			}
			if (!room) {
				client.auth.token = await privatePlaytest.getAuthToken();
				room = await client.joinOrCreate<BoardGameRoomState>(roomType, roomOptions);
			}
			setPrivatePlaytestReconnectToken(privatePlaytest.privateRoomId, room);
		}
		let s = getStateCallbacks(room);
		strokeLayer.connect(room, s);

		function refreshTableItemPlacement(componentId: string) {
			const boardItem = boardGameItems.get(componentId);
			if (!boardItem) return;
			if (boardItem.isInHand) return;

			const position = boardItem.clientPosition?.clientPositionState;
			if (!position) return;
			applyTableItemPlacement(boardItem, {
				x: position.x,
				y: position.y,
				rotation: position.rotation,
				parentId: position.parentId || TABLE_NODE_ID,
				visible: position.visible
			});
		}

		s(room.state).components.onAdd((component, _index) => {
			initComponent(
				{
					boardContainer,
					boardGameItems,
					configureItem: configureTableItem
				},
				allComponentsParsed,
				component,
				room.state,
				s,
				room
			);
			boardGameItems.get(component.id)?.clientPosition?.onPositionChanged.subscribe(() => {
				if (!drag) refreshTableItemPlacement(component.id);
			});
			refreshTableItemPlacement(component.id);
			strokeLayer.refreshAll();
		});
		s(room.state).components.onRemove((component, _key) => {
			const boardItem = boardGameItems.get(component.id);
			if (!boardItem) return;
			selectionManager.setHover(null);
			selectionManager.deselect(boardItem);
			fixedSlotLayout?.forgetItem(boardItem);
			boardItem.parent?.removeChild(boardItem);
			boardItem.destroy({ children: true });
			boardGameItems.delete(component.id);
			strokeLayer.refreshAll();
		});
		sendCmd(room, 'init', buildTableInitPayload(tablePlayPlan));
		return room;
	}

	let localTable: LocalTable;
	let room: Room<BoardGameRoomState>;

	const loadedTable = await loadRequiredTable({ fileSystem, projectName });
	const tableData = loadedTable.data;
	const tableBlockMessage = loadedTable.error?.message;
	const app = $state(await initApp());
	const previewer = $derived(new PreviewHelper(app));
	const viewport = $derived(
		createViewport(app, {
			worldWidth: tableData?.table.table.width ?? 1,
			worldHeight: tableData?.table.table.height ?? 1,
			minScale: 0.2
		})
	);

	if (tableData) {
		localTable = tableData;
		await initEditor(app, previewer);
		room = await createRoom();
	}

	function attachApp(app: Application): Attachment {
		return (element) => {
			const resizeTarget = element as HTMLElement;
			resizeTarget.appendChild(app.canvas);
			app.canvas.style.display = 'block';
			app.canvas.style.width = '100%';
			app.canvas.style.height = '100%';
			app.resizeTo = resizeTarget;
			app.resize();
			const resizeObserver = new ResizeObserver(() => {
				app.queueResize();
			});
			resizeObserver.observe(resizeTarget);
			return () => {
				resizeObserver.disconnect();
				playE2EBridge?.clear();
				playE2EBridge = null;
				fixedSlotLayout?.destroy();
				fixedSlotLayout = null;
				resizeTarget.removeChild(app.canvas);
				app.destroy(true, { children: true, texture: true });
			};
		};
	}

	function blockNativeContextMenu(e: Event) {
		e.preventDefault();
	}

	// TODO Why is this here and not in the keys stuff?
	function handleCameraShortcut(e: KeyboardEvent) {
		const target = e.target;
		if (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target instanceof HTMLSelectElement
		) {
			return;
		}
		if (e.key === '[' || e.code === 'BracketLeft') {
			e.preventDefault();
			rotateCamera(-90);
		} else if (e.key === ']' || e.code === 'BracketRight') {
			e.preventDefault();
			rotateCamera(90);
		} else if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
			e.preventDefault();
			resetCameraRotation();
		}
	}

	onMount(() => {
		document.addEventListener('contextmenu', blockNativeContextMenu);
		window.addEventListener('keydown', handleCameraShortcut);
	});

	onDestroy(() => {
		document.removeEventListener('contextmenu', blockNativeContextMenu);
		window.removeEventListener('keydown', handleCameraShortcut);
	});

	function selectionAfterStackDraw(item: BoardGameItemNew): BoardGameItemNew | null {
		const stack = item.clientStack;
		if (!stack) return null;

		const componentIds = stack.clientStackState.componentIds;
		if (componentIds.length > 2) return item;
		if (componentIds.length !== 2) return null;

		const drawIndex = item.clientFlippable?.clientFlippableState.isFaceUp
			? 0
			: componentIds.length - 1;
		const remainingId = componentIds[drawIndex === 0 ? 1 : 0];
		const remainingItem = boardGameItems.get(remainingId);
		assert(remainingItem, 'Remaining stack item is missing');
		return remainingItem;
	}

	function handleDrawSelection() {
		const selectedItems = [...selectionManager.values()];
		const nextSelection = selectedItems
			.map((item) => selectionAfterStackDraw(item))
			.filter((item): item is BoardGameItemNew => item !== null);

		selectionManager.clear();
		for (const item of selectedItems) {
			handleDrawCard(item);
		}
		for (const item of nextSelection) {
			if (!item.destroyed && !handContainer.hasItem(item)) selectionManager.select(item);
		}
	}

	function handleDrawCard(item: BoardGameItemNew) {
		const stack = item.clientStack;
		const ogId = item.id;
		if (stack) {
			const flippable = item.clientFlippable;
			let id = stack.clientStackState.componentIds[stack.clientStackState.componentIds.length - 1];
			if (flippable && flippable.clientFlippableState.isFaceUp) {
				id = stack.clientStackState.componentIds[0];
			}
			const newItem = boardGameItems.get(id);
			assert(newItem, 'item is empty');
			newItem.visible = true;
			newItem.renderable = true;
			item = newItem;
		} else {
			fixedSlotLayout?.forgetItem(item);
		}
		handContainer.addItem(item);
		sendCmd(room, 'draw', { cardId: ogId });
		strokeLayer.refreshAll();
	}

	function handleShuffleStack(item: BoardGameItemNew) {
		if (!item.clientStack) return;
		item.clientStack.shuffle();
	}

	function handlePlayCard(item: BoardGameItemNew, parentId = tableTargetNodeId(item)) {
		item.visible = true;
		item.renderable = true;
		const placement = tableItemPlacement(item, parentId);
		item.clientPosition?.predictPlacement({ ...placement, visible: true });
		sendCmd(room, 'play', {
			cardId: item.id,
			x: placement.x,
			y: placement.y,
			rotation: placement.rotation,
			targetNodeId: placement.parentId
		});
		strokeLayer.refreshAll();
	}
</script>

<div class="absolute inset-0">
	{#if tableBlockMessage}
		<div class="bg-background text-foreground flex h-full w-full items-center justify-center p-6">
			<div
				class="bg-card text-card-foreground max-w-md rounded-lg border p-6 shadow-sm"
				role="status"
			>
				<h1 class="text-xl font-semibold">Table setup required</h1>
				<p class="text-muted-foreground mt-2 text-sm">{tableBlockMessage}</p>
			</div>
		</div>
	{:else}
		<div
			class="relative h-full w-full"
			style="pointer-events: auto;"
			{@attach attachApp(app)}
		></div>

		<div
			class="bg-background/90 absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-md border p-1 shadow-sm backdrop-blur"
			role="toolbar"
			aria-label="Play tools"
		>
			<button
				type="button"
				aria-label="Select tool"
				aria-pressed={activeTool === 'select'}
				title="Select"
				class="text-foreground hover:bg-accent aria-pressed:bg-primary aria-pressed:text-primary-foreground rounded-sm p-2 aria-pressed:shadow-sm"
				onclick={() => selectTool('select')}
			>
				<MousePointer2Icon class="size-4" />
			</button>
			<div class="relative flex items-center">
				<button
					type="button"
					aria-label="Pen tool"
					aria-pressed={activeTool === 'pen'}
					title="Pen"
					class="text-foreground hover:bg-accent aria-pressed:bg-primary aria-pressed:text-primary-foreground rounded-sm p-2 aria-pressed:shadow-sm"
					onclick={() => selectTool('pen')}
				>
					<PenLineIcon class="size-4" />
				</button>
				{#if activeTool === 'pen'}
					<div
						class="bg-background/95 absolute top-full left-1/2 mt-2 flex -translate-x-1/2 items-center gap-2 rounded-md border px-3 py-2 shadow-sm backdrop-blur"
					>
						<input
							type="range"
							aria-label="Pen width"
							min={penWidthMin}
							max={penWidthMax}
							step={penWidthStep}
							value={penWidth}
							class="accent-primary h-4 w-28"
							oninput={handlePenWidthInput}
						/>
						<span class="text-muted-foreground min-w-8 text-right text-xs tabular-nums"
							>{penWidth}px</span
						>
					</div>
				{/if}
			</div>
			<button
				type="button"
				aria-label="Delete selected stroke"
				title="Delete stroke"
				disabled={!selectedStrokeId}
				class="text-foreground hover:bg-accent rounded-sm p-2 disabled:pointer-events-none disabled:opacity-40"
				onclick={deleteSelectedStroke}
			>
				<Trash2Icon class="size-4" />
			</button>
			<div class="bg-border mx-1 h-6 w-px" aria-hidden="true"></div>
			<button
				type="button"
				aria-label="Rotate camera left"
				title="Rotate camera left ([)"
				class="text-foreground hover:bg-accent rounded-sm p-2"
				onclick={() => rotateCamera(-90)}
			>
				<RotateCcwIcon class="size-4" />
			</button>
			<button
				type="button"
				aria-label="Reset camera rotation"
				title="Reset camera rotation (0)"
				class="text-foreground hover:bg-accent min-w-9 rounded-sm px-2 py-1 text-xs font-medium"
				onclick={resetCameraRotation}
			>
				{cameraRotation}°
			</button>
			<button
				type="button"
				aria-label="Rotate camera right"
				title="Rotate camera right (])"
				class="text-foreground hover:bg-accent rounded-sm p-2"
				onclick={() => rotateCamera(90)}
			>
				<RotateCwIcon class="size-4" />
			</button>
			{#if playtestFeedback}
				<button
					type="button"
					aria-label={notesHaveDraft ? 'Playtest notes with unsent changes' : 'Playtest notes'}
					title={notesHaveDraft ? 'Notes with unsent changes' : 'Notes'}
					class={`relative rounded-sm p-2 ${
						notesHaveDraft
							? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
							: 'text-foreground hover:bg-accent'
					}`}
					onclick={() => (notesOpen = true)}
				>
					<FileTextIcon class="size-4" />
					{#if notesHaveDraft}
						<span
							class="bg-destructive absolute top-1 right-1 size-2 rounded-full"
							aria-hidden="true"
						></span>
					{/if}
				</button>
			{/if}
		</div>

		{#if playtestFeedback}
			<PlaytestNotes
				bind:open={notesOpen}
				bind:hasDraft={notesHaveDraft}
				playtestId={playtestFeedback.playtestId}
			/>
		{/if}

		<ContextMenu.Root bind:open={showContextMenu}>
			<ContextMenu.Trigger
				style="left:{contextMenuPosition.x}px; top: {contextMenuPosition.y}px;"
				class="z-10"
			>
				<div
					class="absolute h-1 w-1"
					style="left: {contextMenuPosition.x}px; top: {contextMenuPosition.y}px"
					aria-hidden="true"
				></div>
			</ContextMenu.Trigger>
			<ContextMenu.Content
				strategy="absolute"
				style="top: {contextMenuPosition.y}px; z-index: 1000;"
			>
				<!-- TODO properly expose functionalities of an item. E.g should only have draw if drawable etc. -->
				<ContextMenu.Item onclick={() => selectionManager.forEach((item) => handleFlipCard(item))}
					>Flip Card
					<ContextMenu.Shortcut>F</ContextMenu.Shortcut>
				</ContextMenu.Item>
				<ContextMenu.Item onclick={handleDrawSelection}
					>Draw Card
					<ContextMenu.Shortcut>D</ContextMenu.Shortcut>
				</ContextMenu.Item>
				<ContextMenu.Item
					onclick={() => selectionManager.forEach((item) => handleShuffleStack(item))}
					>Shuffle Stack
					<ContextMenu.Shortcut>S</ContextMenu.Shortcut>
				</ContextMenu.Item>
			</ContextMenu.Content>
		</ContextMenu.Root>
	{/if}
</div>
