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
	import { Viewport } from 'pixi-viewport';
	import { initDevtools } from '@pixi/devtools';
	import 'pixi.js/math-extras';
	import { PreviewHelper } from './hover-helpers';
	import { SelectionManager } from './SelectionManager';
	import { pixiToCSSCoordinates } from './coordinate-utils';
	import { createViewport } from './viewport-utils';
	import { HandContainer } from './HandContainer';
	import { assert } from '$lib/utils/assert';
	import type { Attachment } from 'svelte/attachments';
	import { PressedKeys } from 'runed';
	import { initComponent, type ParsedSvg } from './initComponent';
	import { installPlayE2EBridge } from './e2e-bridge';
	import { createBoardChrome } from './board-chrome';
	import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';
	import { StrokeLayer, currentStrokeStyle, type PlayTool } from './strokes';
	import {
		createDefaultTableSetup,
		SETUP_SVG_PATH,
		svgToTableSetup,
		type TableSetup
	} from '../../routes/games/[gameName]/setup/table-setup';
	import {
		buildDefaultInitPayload,
		buildSetupInitPayload,
		buildSetupPlayPlan,
		SETUP_PLAY_CARD_HEIGHT,
		SETUP_PLAY_CARD_WIDTH,
		SETUP_TABLE_NODE_ID,
		setupReferencedDeckNames,
		type LoadedDeck
	} from './setup-play';
	import { createSetupTableLayer } from './setup-table-layer';
	import {
		clampSetupItemPosition,
		findSetupSlotAtPoint,
		initialSetupSlotState,
		setupItemMetadataById,
		setupSlotAcceptsItem,
		setupSlotCapacity,
		setupSlotCellPosition,
		type SetupItemMetadata
	} from './setup-slot-rules';
	import PlaytestNotes from './PlaytestNotes.svelte';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import MousePointer2Icon from '@lucide/svelte/icons/mouse-pointer-2';
	import PenLineIcon from '@lucide/svelte/icons/pen-line';
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

	type LocalTableSetup = {
		setup: TableSetup;
		customTableSvg: string | null;
	};

	const SETUP_VIEWPORT_PADDING = 260;

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
	let setupTableLayer: Container | null = null;
	let tableChrome: Container | null = null;
	let strokeLayer: StrokeLayer;
	let setupDropPreviewLayer: Graphics | null = null;
	let stackDropPreviewLayer: Graphics | null = null;
	let movingCardLayer: RenderLayer | null = null;
	let setupWorldOffset = { x: 0, y: 0 };

	let viewport: Viewport;
	let setupItemMetadata: Map<string, SetupItemMetadata> = new SvelteMap();
	let setupSlotOccupants: Map<string, string[]> = new SvelteMap();
	let setupItemSlotIds: Map<string, string> = new SvelteMap();

	let hoverItem: BoardGameItemNew | null = null;
	let selectionManager = new SelectionManager();
	let activeTool = $state<PlayTool>('select');
	let selectedStrokeId = $state<string | null>(null);
	let notesOpen = $state(false);
	let notesHaveDraft = $state(false);
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
		selectionManager.forEach((item) => handleDrawCard(item));
	});
	keys.onKeys('S', () => {
		selectionManager.forEach((item) => handleShuffleStack(item));
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
		startGlobalX: number;
		startGlobalY: number;
		clickThreshold: number;
		dragType: 'marquee' | 'selection' | 'handToBoard' | 'strokeDraft';
		startPositions?: Map<string, { x: number; y: number }>;
		visualPointerRatios?: Map<string, { x: number; y: number }>;
	} | null;

	let drag: DragState = null;

	function setupForPlay(): TableSetup | null {
		return localTableSetup?.setup ?? null;
	}

	function setupItemPosition(position: { x: number; y: number }) {
		const setup = setupForPlay();
		return setup ? clampSetupItemPosition(setup, position) : position;
	}

	function setupItemCenter(item: BoardGameItemNew) {
		const bounds = setupItemContentBounds(item);
		if (bounds) {
			return {
				x: bounds.x + bounds.width / 2,
				y: bounds.y + bounds.height / 2
			};
		}
		return {
			x: item.x + SETUP_PLAY_CARD_WIDTH / 2,
			y: item.y + SETUP_PLAY_CARD_HEIGHT / 2
		};
	}

	function metadataForSetupItem(item: BoardGameItemNew): SetupItemMetadata {
		const metadata = setupItemMetadata.get(item.id);
		if (metadata) return metadata;
		return {
			id: item.id,
			type: item.clientStack ? 'stack' : 'card',
			componentIds: item.clientStack ? [...item.clientStack.clientStackState.componentIds] : [item.id]
		};
	}

	function fitSetupItemToSlotSize(item: BoardGameItemNew) {
		if (!setupForPlay()) return;
		item.disableLayoutTransform();

		const bounds = item.itemContainer.getLocalBounds();
		const rect = 'rectangle' in bounds ? bounds.rectangle : bounds;
		if (rect.width <= 0 || rect.height <= 0) return;

		item.pivot.set(rect.x, rect.y);
		item.scale.set(SETUP_PLAY_CARD_WIDTH / rect.width, SETUP_PLAY_CARD_HEIGHT / rect.height);
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

	function setupItemVisualBoundsGlobal(item: BoardGameItemNew) {
		app.render();
		const rect = rectFromBounds(item.itemContainer.getBounds());
		if (rect.width <= 0 || rect.height <= 0) return null;
		return rect;
	}

	function visualPointerRatio(item: BoardGameItemNew, pointer: Point) {
		const bounds = setupItemVisualBoundsGlobal(item);
		if (!bounds) return { x: 0.5, y: 0.5 };
		return {
			x: (pointer.x - bounds.x) / bounds.width,
			y: (pointer.y - bounds.y) / bounds.height
		};
	}

	function setSetupItemVisualPointUnderPointer(
		item: BoardGameItemNew,
		pointer: Point,
		ratio: { x: number; y: number }
	) {
		if (setupForPlay()) {
			const pointerTable = boardContainer.toLocal(pointer);
			const clampedPosition = setupItemPosition({
				x: pointerTable.x - SETUP_PLAY_CARD_WIDTH * ratio.x,
				y: pointerTable.y - SETUP_PLAY_CARD_HEIGHT * ratio.y
			});
			setSetupItemVisualTopLeft(item, clampedPosition);
			return;
		}

		const bounds = setupItemVisualBoundsGlobal(item);
		if (!bounds) return;

		const targetTopLeftGlobal = new Point(
			pointer.x - bounds.width * ratio.x,
			pointer.y - bounds.height * ratio.y
		);
		const targetTopLeft = boardContainer.toLocal(targetTopLeftGlobal);
		const clampedPosition = setupItemPosition({ x: targetTopLeft.x, y: targetTopLeft.y });
		setSetupItemVisualTopLeft(item, clampedPosition);
	}

	function setupItemContentBounds(item: BoardGameItemNew) {
		const parent = item.parent;
		if (!parent) return null;
		app.render();

		// The item itself can contain transient UI chrome like the selection border.
		// Slot placement must be based only on the card/deck content.
		const rect = rectFromBounds(item.itemContainer.getBounds());
		const topLeft = parent.toLocal(new Point(rect.x, rect.y));
		const bottomRight = parent.toLocal(new Point(rect.x + rect.width, rect.y + rect.height));
		const width = bottomRight.x - topLeft.x;
		const height = bottomRight.y - topLeft.y;
		if (width <= 0 || height <= 0) return null;

		return {
			x: topLeft.x,
			y: topLeft.y,
			width,
			height
		};
	}

	function setSetupItemVisualTopLeft(item: BoardGameItemNew, position: { x: number; y: number }) {
		const parent = item.parent;
		if (!parent) {
			item.position.set(position.x, position.y);
			return;
		}

		item.position.set(position.x, position.y);
		const bounds = setupItemContentBounds(item);
		if (!bounds) return;

		item.position.set(item.x + position.x - bounds.x, item.y + position.y - bounds.y);
	}

	function setupDropPreviewRect(item: BoardGameItemNew, slotId: string) {
		const slot = setupSlotById(slotId);
		if (!slot) return null;
		if (slot.layout?.mode !== 'horizontal-flex') {
			return { x: slot.x, y: slot.y, width: slot.width, height: slot.height };
		}

		const occupants = setupSlotOccupants.get(slot.id) ?? [];
		const existingIndex = occupants.indexOf(item.id);
		const index = existingIndex >= 0 ? existingIndex : occupants.length;
		return {
			...setupSlotCellPosition(slot, index),
			width: SETUP_PLAY_CARD_WIDTH,
			height: SETUP_PLAY_CARD_HEIGHT
		};
	}

	function drawSetupDropPreview(item: BoardGameItemNew, point: { x: number; y: number }) {
		const setup = setupForPlay();
		if (!setup || !setupDropPreviewLayer) return;

		setupDropPreviewLayer.clear();
		const slot = findSetupSlotAtPoint(setup, point);
		if (!slot) return;

		const accepted = canPlaceItemInSetupSlot(item, slot.id);
		const rect = accepted
			? setupDropPreviewRect(item, slot.id)
			: { x: slot.x, y: slot.y, width: slot.width, height: slot.height };
		if (!rect) return;

		setupDropPreviewLayer
			.roundRect(rect.x, rect.y, rect.width, rect.height, 8)
			.fill({ color: accepted ? 0x22c55e : 0xef4444, alpha: 0.16 })
			.stroke({ color: accepted ? 0x16a34a : 0xdc2626, width: 4, alpha: 0.88 });
	}

	function clearSetupDropPreview() {
		setupDropPreviewLayer?.clear();
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

	function setupTargetNodeId(item: BoardGameItemNew) {
		if (!setupForPlay()) return undefined;
		return setupItemSlotIds.get(item.id) ?? SETUP_TABLE_NODE_ID;
	}

	function syncSetupBoardPosition(item: BoardGameItemNew) {
		if (!item.clientPosition) return;
		const targetNodeId = setupTargetNodeId(item);
		item.clientPosition.moveTo(item.x, item.y, targetNodeId);
		item.clientPosition.moveEnd(item.x, item.y, targetNodeId);
	}

	function returnSetupCardToHand(item: BoardGameItemNew) {
		if (!handContainer.hasItem(item)) {
			item.parent?.removeChild(item);
			handContainer.addItem(item);
		} else {
			item.x = 0;
			item.y = 0;
		}
	}

	function removeItemFromSetupSlot(itemId: string): string | null {
		const slotId = setupItemSlotIds.get(itemId);
		if (!slotId) return null;

		const occupants = setupSlotOccupants.get(slotId);
		if (occupants) {
			setupSlotOccupants.set(
				slotId,
				occupants.filter((occupantId) => occupantId !== itemId)
			);
		}
		setupItemSlotIds.delete(itemId);
		return slotId;
	}

	function setupSlotById(slotId: string) {
		return setupForPlay()?.slots.find((slot) => slot.id === slotId) ?? null;
	}

	function reflowSetupSlot(
		slotId: string,
		playedFromHandItemId: string | null = null,
		syncPositions = true
	) {
		const setup = setupForPlay();
		const slot = setupSlotById(slotId);
		if (!setup || !slot || slot.layout?.mode !== 'horizontal-flex') return;

		const occupants = setupSlotOccupants.get(slotId) ?? [];
		for (const [index, itemId] of occupants.entries()) {
			const item = boardGameItems.get(itemId);
			if (!item || handContainer.hasItem(item)) continue;
			const nextPosition = clampSetupItemPosition(setup, setupSlotCellPosition(slot, index));
			setSetupItemVisualTopLeft(item, nextPosition);
			if (!syncPositions) {
				continue;
			}
			if (playedFromHandItemId === itemId) {
				handlePlayCard(item);
			} else {
				syncSetupBoardPosition(item);
			}
		}
		strokeLayer?.refreshAll();
	}

	function canPlaceItemInSetupSlot(item: BoardGameItemNew, slotId: string): boolean {
		const slot = setupSlotById(slotId);
		if (!slot) return false;
		if (!setupSlotAcceptsItem(slot, metadataForSetupItem(item))) return false;

		const occupants = setupSlotOccupants.get(slot.id) ?? [];
		return occupants.includes(item.id) || occupants.length < setupSlotCapacity(slot);
	}

	function placeItemInSetupSlot(item: BoardGameItemNew, slotId: string, fromHand: boolean): boolean {
		const setup = setupForPlay();
		const slot = setupSlotById(slotId);
		if (!setup || !slot || !canPlaceItemInSetupSlot(item, slot.id)) return false;

		const previousSlotId = setupItemSlotIds.get(item.id);
		if (previousSlotId && previousSlotId !== slot.id) {
			removeItemFromSetupSlot(item.id);
			reflowSetupSlot(previousSlotId);
		}

		const occupants = setupSlotOccupants.get(slot.id) ?? [];
		if (!occupants.includes(item.id)) {
			occupants.push(item.id);
			setupSlotOccupants.set(slot.id, occupants);
		}
		setupItemSlotIds.set(item.id, slot.id);

		if (slot.layout?.mode === 'horizontal-flex') {
			reflowSetupSlot(slot.id, fromHand ? item.id : null);
		} else {
			const currentBounds = setupItemContentBounds(item);
			const nextPosition = clampSetupItemPosition(setup, {
				x: currentBounds?.x ?? item.x,
				y: currentBounds?.y ?? item.y
			});
			setSetupItemVisualTopLeft(item, nextPosition);
			if (fromHand) {
				handlePlayCard(item);
			} else {
				syncSetupBoardPosition(item);
			}
		}
		return true;
	}

	function restoreSetupItemPosition(
		item: BoardGameItemNew,
		originalPosition: { x: number; y: number } | undefined
	) {
		if (!originalPosition) return;
		item.position.set(originalPosition.x, originalPosition.y);
		syncSetupBoardPosition(item);
	}

	function commitSetupDrop(
		item: BoardGameItemNew,
		fromHand: boolean,
		originalPosition: { x: number; y: number } | undefined,
		dropPoint?: { x: number; y: number }
	) {
		const setup = setupForPlay();
		if (!setup) return false;

		const currentBounds = setupItemContentBounds(item);
		const clampedPosition = clampSetupItemPosition(setup, {
			x: currentBounds?.x ?? item.x,
			y: currentBounds?.y ?? item.y
		});
		setSetupItemVisualTopLeft(item, clampedPosition);
		const slot = findSetupSlotAtPoint(setup, dropPoint ?? setupItemCenter(item));

		if (slot) {
			if (placeItemInSetupSlot(item, slot.id, fromHand)) return true;
			if (fromHand) {
				returnSetupCardToHand(item);
			} else {
				restoreSetupItemPosition(item, originalPosition);
			}
			return false;
		}

		const previousSlotId = removeItemFromSetupSlot(item.id);
		if (previousSlotId) reflowSetupSlot(previousSlotId);
		if (fromHand) {
			handlePlayCard(item);
		} else {
			syncSetupBoardPosition(item);
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

	function findStackTarget(dragged: BoardGameItemNew): BoardGameItemNew | null {
		const bounds = dragged.getBounds();
		const center = new Point(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
		for (const item of boardGameItems.values()) {
			if (item === dragged) continue;
			if (!item.visible) continue;
			if (handContainer.hasItem(item)) continue;
			const itemBounds = item.getBounds();
			if (
				center.x >= itemBounds.x &&
				center.x <= itemBounds.x + itemBounds.width &&
				center.y >= itemBounds.y &&
				center.y <= itemBounds.y + itemBounds.height
			) {
				return item;
			}
		}
		return null;
	}

	function stackTargetForItem(item: BoardGameItemNew): BoardGameItemNew | null {
		const setup = setupForPlay();
		if (item.clientStack) return null;
		if (handContainer.hasItem(item)) return null;

		const target = findStackTarget(item);
		if (!target) return null;
		const targetIsStack = target.clientStack !== undefined;
		if (setup && !targetIsStack) return null;
		const sourceFlip = item.clientFlippable?.clientFlippableState.isFaceUp;
		const targetFlip = target.clientFlippable?.clientFlippableState.isFaceUp;
		if (!targetIsStack && sourceFlip !== undefined && targetFlip !== undefined && sourceFlip !== targetFlip) {
			return null;
		}
		return target;
	}

	function tryStackSelection(): boolean {
		const setup = setupForPlay();
		if (!keys.has('Shift')) return false;
		if (selectionManager.size !== 1) return false;
		const iterator = selectionManager.values();
		const item = iterator.next().value as BoardGameItemNew | undefined;
		if (!item) return false;

		const target = stackTargetForItem(item);
		if (!target) return false;

		const previousSlotId = setup ? removeItemFromSetupSlot(item.id) : null;
		if (previousSlotId) reflowSetupSlot(previousSlotId);
		sendCmd(room, 'stack', {
			sourceId: item.id,
			targetId: target.id,
			x: target.x,
			y: target.y
		});
		return true;
	}

	function stackTargetForSelection(): BoardGameItemNew | null {
		if (!keys.has('Shift')) return null;
		if (selectionManager.size !== 1) return null;
		const item = selectionManager.values().next().value as BoardGameItemNew | undefined;
		return item ? stackTargetForItem(item) : null;
	}

	function updateStackDropPreview() {
		const target = stackTargetForSelection();
		if (!target) {
			clearStackDropPreview();
			return false;
		}
		clearSetupDropPreview();
		drawStackDropPreview(target);
		return true;
	}

	async function hasPlayableDeckFiles(systemDir: FsDir, deckName: string) {
		const deckDir = await systemDir.openDir(deckName);
		if (deckDir.error) return false;

		const entries = await deckDir.data.list();
		if (entries.error) return false;

		const fileNames = new Set(
			entries.data.filter((entry) => entry.kind === 'file').map((entry) => entry.name)
		);
		return fileNames.has('front.svg') && fileNames.has('back.svg') && fileNames.has('data.csv');
	}

	async function loadLocalTableSetup(): Promise<LocalTableSetup | null> {
		if (roomConnection.kind !== 'localPlay') return null;

		const svgFile = await fileSystem.readText(joinFsPath(projectName, SETUP_SVG_PATH));
		if (svgFile.error) {
			if (svgFile.error.name !== 'NotFoundError') {
				console.warn('Failed to load table SVG for play mode.', svgFile.error);
			}
			return null;
		}

		return {
			setup: svgToTableSetup(svgFile.data, createDefaultTableSetup()),
			customTableSvg: svgFile.data
		};
	}

	async function initApp(localTableSetup: LocalTableSetup | null) {
		const app = new Application();
		await app.init({
			background: localTableSetup ? '#111827' : '#eba92e',
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

	function setupFitScale(app: Application<Renderer>, setup: TableSetup) {
		const usableWidth = Math.max(320, app.screen.width - 96);
		const usableHeight = Math.max(240, app.screen.height - 260);
		return Math.max(
			0.2,
			Math.min(1, usableWidth / setup.table.width, usableHeight / setup.table.height)
		);
	}

	function configureSetupViewport(app: Application<Renderer>, setup: TableSetup) {
		const scale = setupFitScale(app, setup);
		const cameraPadding = SETUP_VIEWPORT_PADDING / scale;
		setupWorldOffset = { x: cameraPadding, y: cameraPadding };
		const worldWidth = setup.table.width + cameraPadding * 2;
		const worldHeight = setup.table.height + cameraPadding * 2;
		viewport.resize(app.screen.width, app.screen.height, worldWidth, worldHeight);
		viewport.setZoom(scale, false);
		viewport.clamp({
			left: 0,
			right: worldWidth,
			top: 0,
			bottom: worldHeight,
			underflow: 'center'
		});
		setupTableLayer?.position.set(setupWorldOffset.x, setupWorldOffset.y);
		boardContainer?.position.set(setupWorldOffset.x, setupWorldOffset.y);
		setupDropPreviewLayer?.position.set(setupWorldOffset.x, setupWorldOffset.y);
		viewport.moveCenter(
			setupWorldOffset.x + setup.table.width / 2,
			setupWorldOffset.y + setup.table.height / 2
		);
	}

	async function initEditor(
		app: Application<Renderer>,
		previewer: PreviewHelper,
		localTableSetup: LocalTableSetup | null
	) {
		if (!localTableSetup) {
			const boardChrome = createBoardChrome(app);
			tableChrome = boardChrome.container;
			app.stage.addChild(tableChrome);
			boardChrome.draw();
			app.renderer.on('resize', () => {
				boardChrome.draw();
			});
		}

		viewport = createViewport(
			app,
			localTableSetup
				? {
						worldWidth: localTableSetup.setup.table.width,
						worldHeight: localTableSetup.setup.table.height,
						minScale: 0.2
					}
				: {}
		);
		app.stage.eventMode = 'static';

		function resizeViewportToScreen() {
			app.stage.hitArea = app.screen;
			if (localTableSetup) {
				configureSetupViewport(app, localTableSetup.setup);
				return;
			}
			viewport.resize(app.screen.width, app.screen.height, viewport.worldWidth, viewport.worldHeight);
		}
		resizeViewportToScreen();
		app.renderer.on('resize', resizeViewportToScreen);

		if (localTableSetup) {
			setupTableLayer = await createSetupTableLayer(localTableSetup);
			setupTableLayer.position.set(setupWorldOffset.x, setupWorldOffset.y);
			viewport.addChild(setupTableLayer);
			configureSetupViewport(app, localTableSetup.setup);
		}

		boardContainer = new Container();
		if (localTableSetup) {
			boardContainer.position.set(setupWorldOffset.x, setupWorldOffset.y);
		}
		viewport.addChild(boardContainer);
		if (localTableSetup) {
			setupDropPreviewLayer = new Graphics();
			setupDropPreviewLayer.position.set(setupWorldOffset.x, setupWorldOffset.y);
			setupDropPreviewLayer.eventMode = 'none';
			setupDropPreviewLayer.interactiveChildren = false;
			viewport.addChild(setupDropPreviewLayer);
		}

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
				clearSetupDropPreview();
				clearStackDropPreview();
				return;
			}

			if (!drag) return;

			if (e.button === 2) {
				drag = null;
				clearMovingCardLayer();
				clearSetupDropPreview();
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
				if (setupForPlay()) {
					const stacked = tryStackSelection();
					for (const c of selectionManager.values()) {
						if (!stacked) {
							commitSetupDrop(c, false, drag.startPositions?.get(c.id));
						}
						c.cursor = 'pointer';
					}
					if (stacked) {
						selectionManager.clear();
					}
				} else {
					for (const c of selectionManager.values()) {
						if (c.clientPosition) {
							c.clientPosition.moveEnd(c.x, c.y);
							c.cursor = 'pointer';
						}
					}
					if (tryStackSelection()) {
						selectionManager.clear();
					}
				}
			} else if (drag.dragType == 'handToBoard') {
				if (setupForPlay()) {
					const dropPoint = boardContainer.toLocal(e.global);
					const stacked = tryStackSelection();
					for (const c of selectionManager.values()) {
						if (handContainer.hasItem(c)) {
							c.x = 0;
							c.y = 0;
						} else if (!stacked) {
							commitSetupDrop(c, true, drag.startPositions?.get(c.id), {
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
				} else {
					const stacked = tryStackSelection();
					for (const c of selectionManager.values()) {
						if (handContainer.hasItem(c)) {
							c.x = 0;
							c.y = 0;
						} else if (!stacked) {
							handlePlayCard(c);
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
			clearSetupDropPreview();
			clearStackDropPreview();
		}

		app.stage.addChild(marquee);
		stackDropPreviewLayer = new Graphics();
		stackDropPreviewLayer.eventMode = 'none';
		stackDropPreviewLayer.interactiveChildren = false;
		app.stage.addChild(stackDropPreviewLayer);
		movingCardLayer = new RenderLayer();
		app.stage.addChild(movingCardLayer);

		app.stage.on('pointermove', (e) => {
			previewer.updatePointer(e.globalX, e.globalY);
			const topItem = findTopLevelItem(e.target);
			if (topItem) {
				hoverItem = topItem;
			} else {
				hoverItem = null;
			}
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

			if (drag.dragType == 'marquee') {
				const width = e.global.x - drag.startGlobalX + e.globalX - marquee.x;
				const height = e.global.y - drag.startGlobalY + e.globalY - marquee.y;
				marquee.resize(width, height);
			} else if (drag.dragType == 'selection') {
				const worldPos = viewport.toWorld(e.global);
				const startWorldPos = viewport.toWorld(drag.startGlobalX, drag.startGlobalY);
				const delta = worldPos.subtract(startWorldPos);
				for (const boardItem of selectionManager.values()) {
					if (boardItem.clientPosition) {
						const newPos = boardItem.position.add(delta);
						const nextPos = setupItemPosition({ x: newPos.x, y: newPos.y });
						boardItem.clientPosition.moveTo(nextPos.x, nextPos.y);
					}
				}
			} else if (drag.dragType == 'handToBoard') {
				for (const boardItem of selectionManager.values()) {
					if (handContainer.hasItem(boardItem)) {
						const deltaX = e.globalX - drag.startGlobalX;
						const deltaY = e.globalY - drag.startGlobalY;
						const wrapper = boardItem.parent;
						if (wrapper) {
							const wrapperGlobal = wrapper.toGlobal(boardItem.position);
							const newGlobalX = wrapperGlobal.x + deltaX;
							const newGlobalY = wrapperGlobal.y + deltaY;

							const newLocal = wrapper.toLocal({ x: newGlobalX, y: newGlobalY });
							boardItem.position.set(newLocal.x, newLocal.y);

							const wrapperBounds = wrapper.getBounds();
							const handBounds = handContainer.container.getBounds();
							const cardHeight = wrapperBounds.height;
							const pointerRatio =
								drag.visualPointerRatios?.get(boardItem.id) ?? visualPointerRatio(boardItem, e.global);

							const cardCenterY = wrapperBounds.y + cardHeight / 2;
							const handTop = handBounds.maxY - cardHeight;

							if (cardCenterY < handTop) {
								handContainer.removeItem(boardItem);
								boardContainer.addChild(boardItem);
								movingCardLayer?.attach(boardItem);
								boardItem.resetLayoutTransform();
								app.render();

								boardItem.scale.set(0.5);
								boardItem.rotation = 0;
								boardItem.pivot.set(0, 0);
								boardItem.alpha = 1.0;
								fitSetupItemToSlotSize(boardItem);

								drag.startGlobalX = e.globalX;
								drag.startGlobalY = e.globalY;
								setSetupItemVisualPointUnderPointer(boardItem, e.global, pointerRatio);
							}
						}
					} else {
						const worldPos = viewport.toWorld(e.global);
						const startWorldPos = viewport.toWorld(drag.startGlobalX, drag.startGlobalY);
						const delta = worldPos.subtract(startWorldPos);
						if (setupForPlay()) {
							const currentBounds = setupItemContentBounds(boardItem);
							const newPos = {
								x: (currentBounds?.x ?? boardItem.x) + delta.x,
								y: (currentBounds?.y ?? boardItem.y) + delta.y
							};
							const nextPos = setupItemPosition(newPos);
							setSetupItemVisualTopLeft(boardItem, nextPos);
						} else {
							const newPos = boardItem.position.add(delta);
							const nextPos = setupItemPosition({ x: newPos.x, y: newPos.y });
							boardItem.position.set(nextPos.x, nextPos.y);
						}
					}
				}
			}
			if (!updateStackDropPreview() && setupForPlay()) {
				const previewItem = selectionManager.values().next().value as BoardGameItemNew | undefined;
				if (previewItem && !handContainer.hasItem(previewItem)) {
					const previewPoint =
						drag.dragType === 'handToBoard'
							? boardContainer.toLocal(e.global)
							: setupItemCenter(previewItem);
					drawSetupDropPreview(previewItem, { x: previewPoint.x, y: previewPoint.y });
				} else {
					clearSetupDropPreview();
				}
				clearStackDropPreview();
			} else if (!setupForPlay()) {
				clearSetupDropPreview();
				clearStackDropPreview();
			}
			drag.startGlobalX = e.globalX;
			drag.startGlobalY = e.globalY;
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
				strokeLayer.select(null);
				selectedStrokeId = null;
				strokeLayer.beginDraft(target, e.global, currentStrokeStyle);
				drag = {
					startGlobalX: e.globalX,
					startGlobalY: e.globalY,
					clickThreshold: 0,
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
				startGlobalX: e.globalX,
				startGlobalY: e.globalY,
				clickThreshold: 10,
				dragType: dragType,
				startPositions: new Map(
					[...selectionManager.values()].map((item) => [item.id, { x: item.x, y: item.y }])
				),
				visualPointerRatios: new Map(
					[...selectionManager.values()].map((item) => [item.id, visualPointerRatio(item, e.global)])
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

	async function createRoom(_init: boolean, localTableSetup: LocalTableSetup | null) {
		if (isE2EMode() && !playE2EBridge) {
			playE2EBridge = installPlayE2EBridge(
				app,
				boardGameItems,
				handContainer,
				strokeLayer,
				viewport,
				localTableSetup?.setup ?? null,
				() => setupWorldOffset
			);
		}
		const { data, error } = await fileSystem.openDir(joinFsPath(projectName, 'system'));
		if (error) {
			throw new Error(error.message);
		}
		const entries = await data.list();
		if (entries.error) {
			throw new Error(entries.error.message);
		}
		const deckEntries = entries.data
			.filter((entry) => entry.kind === 'directory')
			.sort((a, b) => a.name.localeCompare(b.name));
		const setupDeckNames = localTableSetup ? setupReferencedDeckNames(localTableSetup.setup) : null;
		const playableDeckEntries = (
			await Promise.all(
				deckEntries.map(async (entry) => ({
					entry,
					playable: await hasPlayableDeckFiles(data, entry.name)
				}))
			)
		)
			.filter(
				({ entry, playable }) => playable && (!setupDeckNames || setupDeckNames.has(entry.name))
			)
			.map(({ entry }) => entry);
		const loadedDecks: LoadedDeck[] = await Promise.all(
			playableDeckEntries.map(async (entry) => ({
				deckName: entry.name,
				cards: await loadAndProcessCards(projectName, entry.name, fileSystem)
			}))
		);
		const allComponentsParsed = loadedDecks.flatMap((deck) => deck.cards);
		const setupPlayPlan = localTableSetup
			? buildSetupPlayPlan(localTableSetup.setup, loadedDecks)
			: null;
		setupItemMetadata = new SvelteMap(setupItemMetadataById(setupPlayPlan));
		const setupSlotState = initialSetupSlotState(setupPlayPlan);
		setupSlotOccupants = new SvelteMap(setupSlotState.slotOccupants);
		setupItemSlotIds = new SvelteMap(setupSlotState.itemSlotIds);
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

		function refreshSetupItemPlacement(componentId: string) {
			const boardItem = boardGameItems.get(componentId);
			if (!boardItem) return;
			if (boardItem.isInHand) return;

			fitSetupItemToSlotSize(boardItem);
			const slotId = setupItemSlotIds.get(componentId);
			if (slotId) {
				reflowSetupSlot(slotId, null, false);
			}
		}

		function scheduleSetupItemPlacementRefresh(componentId: string, remainingFrames = 1) {
			if (drag) return;
			requestAnimationFrame(() => {
				if (drag) return;
				refreshSetupItemPlacement(componentId);
				if (remainingFrames > 1) {
					scheduleSetupItemPlacementRefresh(componentId, remainingFrames - 1);
				}
			});
		}

		s(room.state).components.onAdd((component, _index) => {
			initComponent(
				{
					boardContainer,
					boardGameItems,
					isDragging: () => drag !== null,
					configureItem: fitSetupItemToSlotSize
				},
				allComponentsParsed,
				component,
				room.state,
				s,
				room
			);
			if (localTableSetup) {
				boardGameItems
					.get(component.id)
					?.clientPosition?.onPositionChanged.subscribe(() =>
						scheduleSetupItemPlacementRefresh(component.id, 2)
					);
			}
			refreshSetupItemPlacement(component.id);
			scheduleSetupItemPlacementRefresh(component.id, 4);
			strokeLayer.refreshAll();
		});
		s(room.state).components.onRemove((component, _key) => {
			const boardItem = boardGameItems.get(component.id);
			if (!boardItem) return;
			const previousSlotId = removeItemFromSetupSlot(component.id);
			boardContainer.removeChild(boardItem);
			boardItem.destroy({ children: true });
			boardGameItems.delete(component.id);
			if (previousSlotId) reflowSetupSlot(previousSlotId);
			strokeLayer.refreshAll();
		});
		sendCmd(
			room,
			'init',
			setupPlayPlan ? buildSetupInitPayload(setupPlayPlan) : buildDefaultInitPayload(loadedDecks)
		);
		return room;
	}

	const localTableSetup = await loadLocalTableSetup();
	const app = await initApp(localTableSetup);
	// passing app here feels wrong. It is needed to render textures. Ideally classes in here shouldn't have to know about app
	const previewer = new PreviewHelper(app);
	const init = await initEditor(app, previewer, localTableSetup);
	const room = await createRoom(init, localTableSetup);

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
				resizeTarget.removeChild(app.canvas);
				app.destroy(true, { children: true, texture: true });
			};
		};
	}

	function blockNativeContextMenu(e: Event) {
		e.preventDefault();
	}

	function updateShiftStackPreview(e: KeyboardEvent) {
		if (e.key !== 'Shift') return;
		if (drag?.dragType !== 'selection' && drag?.dragType !== 'handToBoard') return;
		updateStackDropPreview();
	}

	function clearShiftStackPreview(e: KeyboardEvent) {
		if (e.key === 'Shift') clearStackDropPreview();
	}

	onMount(() => {
		document.addEventListener('contextmenu', blockNativeContextMenu);
		window.addEventListener('keydown', updateShiftStackPreview);
		window.addEventListener('keyup', clearShiftStackPreview);
	});

	onDestroy(() => {
		document.removeEventListener('contextmenu', blockNativeContextMenu);
		window.removeEventListener('keydown', updateShiftStackPreview);
		window.removeEventListener('keyup', clearShiftStackPreview);
	});

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
			const previousSlotId = removeItemFromSetupSlot(item.id);
			if (previousSlotId) reflowSetupSlot(previousSlotId);
		}
		selectionManager.clear();
		boardContainer.removeChild(item);
		handContainer.addItem(item);
		sendCmd(room, 'draw', { cardId: ogId });
		strokeLayer.refreshAll();
	}

	function handleShuffleStack(item: BoardGameItemNew) {
		if (!item.clientStack) return;
		item.clientStack.shuffle();
	}

	function handlePlayCard(item: BoardGameItemNew) {
		sendCmd(room, 'play', {
			cardId: item.id,
			x: item.x,
			y: item.y,
			targetNodeId: setupTargetNodeId(item)
		});
		strokeLayer.refreshAll();
	}
</script>

<div class="absolute inset-0">
	<div class="relative h-full w-full" style="pointer-events: auto;" {@attach attachApp(app)}></div>

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
					<span class="bg-destructive absolute top-1 right-1 size-2 rounded-full" aria-hidden="true"
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
		<ContextMenu.Content strategy="absolute" style="top: {contextMenuPosition.y}px; z-index: 1000;">
			<ContextMenu.Item onclick={() => selectionManager.forEach((item) => handleFlipCard(item))}
				>Flip Card
				<ContextMenu.Shortcut>F</ContextMenu.Shortcut>
			</ContextMenu.Item>
			<ContextMenu.Item onclick={() => selectionManager.forEach((item) => handleDrawCard(item))}
				>Draw Card
				<ContextMenu.Shortcut>D</ContextMenu.Shortcut>
			</ContextMenu.Item>
			<ContextMenu.Item onclick={() => selectionManager.forEach((item) => handleShuffleStack(item))}
				>Shuffle Stack
				<ContextMenu.Shortcut>S</ContextMenu.Shortcut>
			</ContextMenu.Item>
		</ContextMenu.Content>
	</ContextMenu.Root>
</div>
