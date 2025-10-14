<script lang="ts">
	import { Client, Room, getStateCallbacks } from 'colyseus.js';
	import { Application, Container, Point, Rectangle } from 'pixi.js';
	import { MarqueeSelection } from '@pixi/marquee-selection';
	import '@pixi/layout';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { getFileSystemContext } from '../../context';
	import { loadAndProcessCards } from './pixi-card-loader';
	import { error } from '@sveltejs/kit';
	import {
		BoardGameRoomState,
		Component,
		Positionable
	} from 'boardgame-server/src/rooms/schema/MyRoomState';
	import { BoardGameItem } from '$lib/pixi/item';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { Viewport } from 'pixi-viewport';
	import { LayoutContainer } from '@pixi/layout/components';
	import { initDevtools } from '@pixi/devtools';
	import 'pixi.js/math-extras';
	import { PreviewHelper } from './hover-helpers';
	import { SelectionManager } from './SelectionManager';
	import { pixiToCSSCoordinates } from './coordinate-utils';
	import { createViewport } from './viewport-utils';
	import { HandContainer } from './HandContainer';

	let canvasContainer: HTMLDivElement;
	let app: Application;

	const projectName = $derived(page.params.gameName);
	const cardName = $derived(page.params.deckName || 'western');
	const fileSystem = getFileSystemContext();

	async function createOrJoinRoom(client: Client, roomName: string) {
		try {
			return await client.joinOrCreate<BoardGameRoomState>(roomName);
		} catch (e) {
			console.error('Failed to join or create room:', e);
			error(500, 'Could not join or create room');
		}
	}

	const client = new Client('ws://localhost:2567');
	let room: Room<BoardGameRoomState>;

	let syncCards: Map<string, BoardGameItem> = new Map();

	// Context menu state
	let showContextMenu = $state(false);
	let contextMenuPosition = $state({ x: 0, y: 0 });

	function handleRightClick(e: any) {
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

	function handleFlipCard(item: BoardGameItem) {
		item.flip();
		room.send('cmd', {
			commandType: 'flip',
			payload: {
				cardId: item.id,
				isFaceUp: item.isFrontShowing()
			}
		});
		closeContextMenu();
	}

	let boardContainer: Container;
	let handContainer: HandContainer;
	let hybridResults: {
		front: LayoutContainer;
		back: LayoutContainer;
		index: number;
	}[];

	let viewport: Viewport;

	let hoverItem: BoardGameItem;
	let selectionManager = new SelectionManager();
	const pressedKeys = new Set<string>();

	type DragState = {
		startGlobalX: number;
		startGlobalY: number;
		clickThreshold: number;
		dragType: 'marquee' | 'selection' | 'handToBoard';
		isFromHand?: boolean;
	} | null;

	let drag: DragState = null;
	// Context menu prevention handler
	function handleContextMenu(e: Event) {
		e.preventDefault();
	}

	// This is probably useless. Fighting against the engine here
	function findTopLevelItem(curr: Container) {
		while (curr != viewport && curr != app.stage) {
			if (curr instanceof BoardGameItem && curr.parent && !(curr.parent instanceof BoardGameItem)) {
				return curr;
			}
			curr = curr.parent!;
		}
		return null;
	}

	onMount(async () => {
		// Disable native context menu on the entire page
		const handleContextMenu = (e: Event) => {
			e.preventDefault();
		};
		document.addEventListener('contextmenu', handleContextMenu);

		// Listen for card array changes
		app = new Application();
		await app.init({
			background: '#eba92e',
			resizeTo: window,
			antialias: true,
			resolution: window.devicePixelRatio || 1,
			autoDensity: true
		});

		const previewer = new PreviewHelper(app);
		previewer.previewContainer.zIndex = 10000;
		hybridResults = await loadAndProcessCards(projectName, cardName, fileSystem);
		initDevtools({ app });
		window.__PIXI_DEVTOOLS__ = {
			app
		};
		console.log('App renderer size:', app.renderer.width, app.renderer.height);
		viewport = createViewport(app);

		canvasContainer.appendChild(app.canvas);

		// allow the stage itself to catch pointer events anywhere
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

		handContainer = new HandContainer();
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

		function endDrag(e: any) {
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
				for (const item of syncCards.values()) {
					const itemBounds = item.getBounds();
					if (selectionRect.intersects(new Rectangle().copyFromBounds(itemBounds))) {
						selectionManager.select(item);
					}
				}
			} else if (drag.dragType == 'selection') {
				const containers = selectionManager.values();
				for (const c of containers) {
					const cardId = c.id;
					c.cursor = 'pointer';

					room.send('cmd', {
						commandType: 'moveend',
						payload: {
							cardId: cardId,
							x: c.x,
							y: c.y
						}
					});
				}
			} else if (drag.dragType == 'handToBoard') {
				// Handle playing card from hand to board
				const containers = selectionManager.values();
				for (const c of containers) {
					if (handContainer.hasItem(c)) {
						c.x = 0;
						c.y = 0;
					} else {
						handlePlayCard(c, e.globalX, e.globalY);
					}
					c.cursor = 'pointer';
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
				if (pressedKeys.has('AltLeft')) {
					previewer.showPreview(hoverItem);
				}
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
					const newPos = boardItem.position.add(delta);
					boardItem.position = newPos;
					room.send('cmd', {
						commandType: 'move',
						payload: {
							cardId: boardItem.id,
							x: boardItem.x,
							y: boardItem.y
						}
					});
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

								boardContainer.addChild(boardItem);
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
		window.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				closeContextMenu();
			} else if (e.code === 'KeyF') {
				selectionManager.forEach((item) => handleFlipCard(item));
			} else if (e.code === 'KeyD') {
				selectionManager.forEach((item) => handleDrawCard(item));
			} else if (e.code == 'AltLeft') {
				if (hoverItem) {
					previewer.showPreview(hoverItem);
					pressedKeys.add('AltLeft');
				}
			}
		});

		window.addEventListener('keyup', (e) => {
			if (e.code == 'AltLeft') {
				pressedKeys.delete('AltLeft');
				previewer.hidePreview();
			}
		});

		room = await createOrJoinRoom(client, 'my_room');
		room.send('cmd', {
			commandType: 'init',
			payload: {
				cardAmount: hybridResults.length
			}
		});
		let s = getStateCallbacks(room);

		s(room.state).components.onAdd((component, index) => {
			initComponent(hybridResults, component, component.idx);

			s(component).onChange(() => {
				if (component.owner === room.sessionId) return;
				const cardContainer = syncCards.get(index);
				if (cardContainer) {
					cardContainer.x = component.x;
					cardContainer.y = component.y;
					cardContainer.visible = component.visible;
					if (cardContainer.isFrontShowing() !== component.isFaceUp) {
						cardContainer.flip();
					}
				}
			});
		});

		return () => {
			app?.destroy(true, { children: true, texture: true });
		};
	});

	async function initComponent(
		hybridResults: {
			front: LayoutContainer;
			back: LayoutContainer;
			index: number;
		}[],
		component: Component,
		state: BoardGameRoomState,
		i: number
	) {
		const { front, back } = hybridResults[i];

		const cardContainer = new BoardGameItem(front, back, component.id);

		const position = state.positions.get(component.id);
		if (position) {
			cardContainer.x = position.x;
			cardContainer.y = position.y;
            cardContainer.visible = position.visible;
		}

		syncCards.set(component.id, cardContainer);

		cardContainer.scale.set(0.5);
		cardContainer.eventMode = 'static';
		cardContainer.cursor = 'pointer';
		cardContainer.on('pointerover', () => {
			if (!drag) cardContainer.tint = 0xcccccc;
		});
		cardContainer.on('pointerout', () => {
			cardContainer.tint = 0xffffff;
		});
		boardContainer.addChild(cardContainer);
	}

	onDestroy(() => {
		// Remove context menu prevention
		document.removeEventListener('contextmenu', handleContextMenu);
		app?.destroy(true, { children: true, texture: true });
	});

	function handleDrawCard(item: BoardGameItem) {
		boardContainer.removeChild(item);
		handContainer.addItem(item);
		room.send('cmd', {
			commandType: 'draw',
			payload: {
				cardId: item.id
			}
		});
	}

	function handlePlayCard(item: BoardGameItem, x: number, y: number) {
		room.send('cmd', {
			commandType: 'play',
			payload: {
				cardId: item.id,
				x: item.x,
				y: item.y
			}
		});
	}
</script>

<div class="absolute inset-0">
	<div bind:this={canvasContainer} class="full relative w-full" style="pointer-events: auto;"></div>

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
		</ContextMenu.Content>
	</ContextMenu.Root>
</div>
