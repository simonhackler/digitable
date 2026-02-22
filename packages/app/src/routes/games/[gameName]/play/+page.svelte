<script lang="ts">
	import { Client, getStateCallbacks, Room } from 'colyseus.js';
	import {
		Application,
		Container,
		FederatedPointerEvent,
		Point,
		Rectangle,
		type Renderer
	} from 'pixi.js';
	import { MarqueeSelection } from '@pixi/marquee-selection';
	import '@pixi/layout';
	import { onMount, onDestroy } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { getFileSystemContext } from '../../context';
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
	import { assert, requireParam } from '$lib/utils/assert';
	import type { Attachment } from 'svelte/attachments';
	import { PressedKeys } from 'runed';
	import { initComponent, type ParsedSvg } from './initComponent';
	import { createBoardChrome } from './board-chrome';

	const projectName = $derived(requireParam('gameName'));
	// TODO load all components
	const cardName = $derived(page.params.deckName || 'western');
	const fileSystem = getFileSystemContext();
	const client = new Client('ws://localhost:2567');

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

	let viewport: Viewport;

	let hoverItem: BoardGameItemNew | null = null;
	let selectionManager = new SelectionManager();
	const keys = new PressedKeys();

	keys.onKeys('Escape', () => {
		closeContextMenu();
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
	keys.onKeys('alt', () => {
		if (hoverItem) {
			previewer.showPreview(hoverItem);
		}
	});

	type DragState = {
		startGlobalX: number;
		startGlobalY: number;
		clickThreshold: number;
		dragType: 'marquee' | 'selection' | 'handToBoard';
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
	function parsePayload(parsedSvgs: ParsedSvg[]): InitGamePayload {
		const res = parsedSvgs.map((x) => {
			return x.id;
		});
		const payload: InitGamePayload = { stacks: [{ componentIds: res }] };
		return payload;
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
			if (e.button === 2 && boardItem) {
				handleRightClick(e);
			}
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
		const hybridResults = await loadAndProcessCards(projectName, cardName, fileSystem);
		const roomName = 'my_room';
		const room = await client.joinOrCreate<BoardGameRoomState>(roomName);
		let s = getStateCallbacks(room);

		s(room.state).components.onAdd((component, _index) => {
			initComponent(
				{
					app,
					boardContainer,
					boardGameItems,
					isDragging: () => drag !== null
				},
				hybridResults,
				component,
				room.state,
				s,
				room
			);
		});
		s(room.state).components.onRemove((component, _key) => {
			const boardItem = boardGameItems.get(component.id);
			if (!boardItem) return;
			boardContainer.removeChild(boardItem);
			boardItem.destroy({ children: true });
			boardGameItems.delete(component.id);
		});
		sendCmd(room, 'init', parsePayload(hybridResults));
		return room;
	}

	const app = $state(await initApp());
	// passing app here feels wrong. It is needed to render textures. Ideally classes in here shouldn't have to know about app
	const previewer = $derived(new PreviewHelper(app));
	const init = $derived(initEditor(app, previewer));
	const room = $derived(await createRoom(init));

	function attachApp(app: Application): Attachment {
		return (element) => {
			element.appendChild(app.canvas);
			return () => {
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
		console.log('has stack', stack);
		if (stack) {
			const flippable = item.clientFlippable;
			let id = stack.clientStackState.componentIds[stack.clientStackState.componentIds.length - 1];
			if (flippable && flippable.clientFlippableState.isFaceUp) {
				id = stack.clientStackState.componentIds[0];
			}
			const newItem = boardGameItems.get(id);
			assert(newItem, 'item is empty');
			newItem.visible = true;
			item = newItem;
			console.log(`drawing stack item id ${newItem.id}`);
		}
		boardContainer.removeChild(item);
		handContainer.addItem(item);
		sendCmd(room, 'draw', { cardId: ogId });
	}

	function handleShuffleStack(item: BoardGameItemNew) {
		if (!item.clientStack) return;
		item.clientStack.shuffle();
	}

	function handlePlayCard(item: BoardGameItemNew) {
		sendCmd(room, 'play', { cardId: item.id, x: item.x, y: item.y });
	}
</script>

<div class="absolute inset-0">
	<div class="full relative w-full" style="pointer-events: auto;" {@attach attachApp(app)}></div>

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
