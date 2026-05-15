<script lang="ts">
	import { Client, getStateCallbacks, type Room } from 'colyseus.js';
	import {
		Application,
		Container,
		type FederatedPointerEvent,
		Point,
		Rectangle,
		type Renderer
	} from 'pixi.js';
	import { MarqueeSelection } from '@pixi/marquee-selection';
	import '@pixi/layout';
	import { onMount, onDestroy } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import { env } from '$env/dynamic/public';
	import { loadAndProcessCards } from './pixi-card-loader';
	import {
		type BoardGameRoomState,
		type InitGamePayload
	} from 'boardgame-server/src/rooms/schema/MyRoomState';
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
	import MousePointer2Icon from '@lucide/svelte/icons/mouse-pointer-2';
	import PenLineIcon from '@lucide/svelte/icons/pen-line';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	let {
		projectName,
		fileSystem,
		privateRoomId = null,
		e2e = false
	}: {
		projectName: string;
		fileSystem: FsDir;
		privateRoomId?: string | null;
		e2e?: boolean;
	} = $props();

	const gameServerUrl = env.PUBLIC_GAME_SERVER_URL;
	if (!gameServerUrl) {
		throw new Error('PUBLIC_GAME_SERVER_URL is not configured');
	}
	const client = new Client(gameServerUrl);
	let playE2EBridge: ReturnType<typeof installPlayE2EBridge> | null = null;

	function isE2EMode() {
		return e2e;
	}

	async function getPrivateRoomOptions(privateRoomId: string) {
		const response = await fetch(resolve('/api/game-ticket'), {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({ privateRoomId })
		});

		if (!response.ok) {
			throw new Error(await response.text());
		}

		const { ticket } = (await response.json()) as { ticket: string };
		client.auth.token = ticket;
		return {
			privateRoomId
		};
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
	let tableChrome: Container;
	let strokeLayer: StrokeLayer;

	let viewport: Viewport;

	let hoverItem: BoardGameItemNew | null = null;
	let selectionManager = new SelectionManager();
	let activeTool = $state<PlayTool>('select');
	let selectedStrokeId = $state<string | null>(null);
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
		isFromHand?: boolean;
	} | null;

	let drag: DragState = null;

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

	function tryStackSelection(): boolean {
		if (selectionManager.size !== 1) return false;
		const iterator = selectionManager.values();
		const item = iterator.next().value as BoardGameItemNew | undefined;
		if (!item) return false;
		if (item.clientStack) return false;
		if (handContainer.hasItem(item)) return false;

		const target = findStackTarget(item);
		if (!target) return false;
		const sourceFlip = item.clientFlippable?.clientFlippableState.isFaceUp;
		const targetFlip = target.clientFlippable?.clientFlippableState.isFaceUp;
		if (sourceFlip !== undefined && targetFlip !== undefined && sourceFlip !== targetFlip) {
			return false;
		}

		sendCmd(room, 'stack', {
			sourceId: item.id,
			targetId: target.id,
			x: target.x,
			y: target.y
		});
		return true;
	}

	// Can init stacks, or singular components with ids and containers
	// So one map of components and one map of stacks with stacks having maps of components
	// I will need a better init system probably.
	function parsePayload(parsedSvgs: ParsedSvg[][]): InitGamePayload {
		const res = parsedSvgs.map((x) => {
			return { componentIds: x.map((y) => y.id) };
		});
		const payload: InitGamePayload = { stacks: res };
		return payload;
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

	async function initApp() {
		const app = new Application();
		await app.init({
			background: '#eba92e',
			resizeTo: window,
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

	function initEditor(app: Application<Renderer>, previewer: PreviewHelper) {
		const boardChrome = createBoardChrome(app);
		tableChrome = boardChrome.container;
		app.stage.addChild(tableChrome);
		boardChrome.draw();
		app.renderer.on('resize', () => {
			boardChrome.draw();
		});

		viewport = createViewport(app);
		app.stage.eventMode = 'static';
		app.stage.hitArea = app.screen;

		boardContainer = new Container();
		viewport.addChild(boardContainer);

		const screenContainer = new Container({
			layout: {
				width: app.screen.width,
				height: app.screen.height,
				flexDirection: 'column',
				justifyContent: 'flex-end',
				alignItems: 'center'
			}
		});

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
				return;
			}

			if (!drag) return;

			if (e.button === 2) {
				drag = null;
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
				for (const c of selectionManager.values()) {
					if (c.clientPosition) {
						c.clientPosition.moveEnd(c.x, c.y);
						c.cursor = 'pointer';
					}
				}
				if (tryStackSelection()) {
					selectionManager.clear();
				}
			} else if (drag.dragType == 'handToBoard') {
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
			drag = null;
		}

		app.stage.addChild(marquee);

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
						boardItem.clientPosition.moveTo(newPos.x, newPos.y);
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

							const cardCenterY = wrapperBounds.y + cardHeight / 2;
							const handTop = handBounds.maxY - cardHeight;

							if (cardCenterY < handTop) {
								handContainer.removeItem(boardItem);
								boardContainer.addChild(boardItem);
								boardItem.resetLayoutTransform();

								boardItem.scale.set(0.5);
								boardItem.rotation = 0;
								boardItem.pivot.set(0, 0);
								boardItem.alpha = 1.0;
								const worldPos = viewport.toWorld(e.global);

								drag.startGlobalX = e.globalX;
								drag.startGlobalY = e.globalY;

								const offset = e.global.subtract(new Point(wrapperBounds.minX, wrapperBounds.minY));

								boardItem.position = worldPos
									.subtract(offset)
									.subtract(new Point(wrapperBounds.width / 2, wrapperBounds.height / 2));
							}
						}
					} else {
						const worldPos = viewport.toWorld(e.global);
						const startWorldPos = viewport.toWorld(drag.startGlobalX, drag.startGlobalY);
						const delta = worldPos.subtract(startWorldPos);
						const newPos = boardItem.position.add(delta);
						boardItem.position = newPos;
					}
				}
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
				dragType: dragType
			};
			if (e.shiftKey) {
				drag.dragType = 'marquee';
				marquee.position.copyFrom(e.global);
				marquee.visible = true;
				marquee.resize(2, 2);
			} else if (!boardItem || (!selectionManager.has(boardItem) && dragType !== 'handToBoard')) {
				drag = null;
			}
		});
		return true;
	}

	async function createRoom(_init: boolean) {
		if (isE2EMode() && !playE2EBridge) {
			playE2EBridge = installPlayE2EBridge(app, boardGameItems, handContainer, strokeLayer);
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
		const playableDeckEntries = (
			await Promise.all(
				deckEntries.map(async (entry) => ({
					entry,
					playable: await hasPlayableDeckFiles(data, entry.name)
				}))
			)
		)
			.filter(({ playable }) => playable)
			.map(({ entry }) => entry);
		const loadedDecks = await Promise.all(
			playableDeckEntries.map((entry) => loadAndProcessCards(projectName, entry.name, fileSystem))
		);
		const allComponentsParsed = loadedDecks.flat();
		const roomName = privateRoomId ? 'private_room' : 'my_room';
		const roomOptions = privateRoomId ? await getPrivateRoomOptions(privateRoomId) : undefined;
		const shouldCreateRoom = !privateRoomId;
		const room = shouldCreateRoom
			? await client.create<BoardGameRoomState>(roomName, roomOptions)
			: await client.joinOrCreate<BoardGameRoomState>(roomName, roomOptions);
		let s = getStateCallbacks(room);
		strokeLayer.connect(room, s);

		s(room.state).components.onAdd((component, _index) => {
			initComponent(
				{
					boardContainer,
					boardGameItems,
					isDragging: () => drag !== null
				},
				allComponentsParsed,
				component,
				room.state,
				s,
				room
			);
			strokeLayer.refreshAll();
		});
		s(room.state).components.onRemove((component, _key) => {
			const boardItem = boardGameItems.get(component.id);
			if (!boardItem) return;
			boardContainer.removeChild(boardItem);
			boardItem.destroy({ children: true });
			boardGameItems.delete(component.id);
			strokeLayer.refreshAll();
		});
		sendCmd(room, 'init', parsePayload(loadedDecks));
		return room;
	}

	const app = await initApp();
	// passing app here feels wrong. It is needed to render textures. Ideally classes in here shouldn't have to know about app
	const previewer = new PreviewHelper(app);
	const init = initEditor(app, previewer);
	const room = await createRoom(init);

	function attachApp(app: Application): Attachment {
		return (element) => {
			element.appendChild(app.canvas);
			return () => {
				playE2EBridge?.clear();
				playE2EBridge = null;
				element.removeChild(app.canvas);
				app.destroy(true, { children: true, texture: true });
			};
		};
	}

	function blockNativeContextMenu(e: Event) {
		e.preventDefault();
	}

	onMount(() => {
		document.addEventListener('contextmenu', blockNativeContextMenu);
	});

	onDestroy(() => {
		document.removeEventListener('contextmenu', blockNativeContextMenu);
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
		}
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
		sendCmd(room, 'play', { cardId: item.id, x: item.x, y: item.y });
		strokeLayer.refreshAll();
	}
</script>

<div class="absolute inset-0">
	<div class="full relative w-full" style="pointer-events: auto;" {@attach attachApp(app)}></div>

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
	</div>

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
