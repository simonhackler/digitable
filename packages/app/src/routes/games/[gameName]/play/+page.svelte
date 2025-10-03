<script lang="ts">
	import { Client, Room, getStateCallbacks } from 'colyseus.js';
	import {
		Application,
		Container,
		Graphics,
		Rectangle,
	} from 'pixi.js';
	import { MarqueeSelection } from '@pixi/marquee-selection';
	import '@pixi/layout';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { getFileSystemContext } from '../../context';
	import { loadAndProcessCards } from './pixi-card-loader';
	import { error } from '@sveltejs/kit';
	import { BoardgameRoomState, Card } from 'boardgame-server/src/rooms/schema/MyRoomState';
	import { BoardGameItem } from '$lib/pixi/item';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { Viewport } from 'pixi-viewport';
	import { LayoutContainer } from '@pixi/layout/components';
	import { initDevtools } from '@pixi/devtools';
	import 'pixi.js/math-extras';

	let canvasContainer: HTMLDivElement;
	let app: Application;

	const projectName = $derived(page.params.gameName);
	const cardName = $derived(page.params.deckName || 'western');
	const fileSystem = getFileSystemContext();

	async function createOrJoinRoom(client: Client, roomName: string) {
		try {
			return await client.joinOrCreate<BoardgameRoomState>(roomName);
		} catch (e) {
			console.error('Failed to join or create room:', e);
			error(500, 'Could not join or create room');
		}
	}

	const client = new Client('ws://localhost:2567');
	let room: Room<BoardgameRoomState>;

	let syncCards: Map<string, BoardGameItem> = new Map();

	// Context menu state
	let showContextMenu = $state(false);
	let contextMenuPosition = $state({ x: 0, y: 0 });

	function handleRightClick(e: any, cardId: string) {
		e.preventDefault();
		e.stopPropagation();

		if (!showContextMenu) {
			const cssPosition = pixiToCSSCoordinates(e.globalX, e.globalY);
			contextMenuPosition = cssPosition;
			showContextMenu = true;
		}
	}

	function pixiToCSSCoordinates(pixiX: number, pixiY: number) {
		if (!app) return { x: pixiX, y: pixiY };

		const canvas = app.canvas;
		const canvasRect = canvas.getBoundingClientRect();

		const internalW = app.renderer.width;
		const internalH = app.renderer.height;

		const sx = canvasRect.width / internalW;
		const sy = canvasRect.height / internalH;

		const cssX = pixiX * sx;
		const cssY = pixiY * sy;

		return { x: cssX, y: cssY };
	}

	function closeContextMenu() {
		showContextMenu = false;
	}

	function handleFlipCard(item: BoardGameItem) {
		item.flip();
		room.send('flip', {
			cardId: item.id,
			isFaceUp: item.isFrontShowing()
		});
		closeContextMenu();
	}

	let boardContainer: Container;
	let handContainer: Container;
	let hybridResults: {
		front: LayoutContainer;
		back: LayoutContainer;
		index: number;
	}[];

	let viewport: Viewport;

    let hoverItem: BoardGameItem;
	let selItems = new Set<BoardGameItem>();
	type DragState = {
		startGlobalX: number;
		startGlobalY: number;
		clickThreshold: number;
		dragType: 'marquee' | 'selection';
	} | null;

	let drag: DragState = null;
	// Context menu prevention handler
	function handleContextMenu(e: Event) {
		e.preventDefault();
	}

	function createSelectionBorder(item: BoardGameItem) {
		const b = item.getLocalBounds();
		const pad = Math.min(Math.max(Math.min(b.width, b.height) * 0.02, 2), 8); // 2–8px padding
		const radius = Math.min(Math.max(Math.min(b.width, b.height) * 0.06, 6), 20); // rounded corners

		const g = new Graphics();
		g.eventMode = 'none';
		g.zIndex = 9999;
		// Outer blue ring
		g.roundRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, radius).stroke({
			width: 16,
			color: 0x3b82f6,
			alpha: 1
		});
		// Subtle inner hairline for a "crisp" look
		g.roundRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, radius).stroke({
			width: 4,
			color: 0xffffff,
			alpha: 0.9
		});

		item.addChild(g);
	}

	function selectItem(item: BoardGameItem) {
		if (selItems.has(item)) return;
		selItems.add(item);
		createSelectionBorder(item);
	}

	function deselectItem(item: BoardGameItem) {
		if (!selItems.has(item)) return;
        console.log('Deselecting item', item.id);
		selItems.delete(item);
		item.removeChildren(2);
	}

	function selectOnlyItem(item: BoardGameItem) {
		selItems.forEach((it) => deselectItem(it));
		selectItem(item);
	}

    // This is probalby useless. Fighting against the engine here
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

		hybridResults = await loadAndProcessCards(projectName, cardName, fileSystem);
		initDevtools({ app });
		window.__PIXI_DEVTOOLS__ = {
			app
		};
		console.log('App renderer size:', app.renderer.width, app.renderer.height);
		viewport = new Viewport({
			screenWidth: window.innerWidth,
			screenHeight: window.innerHeight,
			worldWidth: 6000,
			worldHeight: 3500,
			events: app.renderer.events,
			disableOnContextMenu: true
		});
		viewport.pinch().wheel();
		viewport.drag({
			mouseButtons: 'right'
		});
		// viewport.moveCenter(viewport.worldWidth / 2, viewport.worldHeight / 2);
		viewport.clamp({
			left: 0,
			right: viewport.worldWidth,
			top: 0,
			bottom: viewport.worldHeight,
			direction: 'all',
			underflow: 'center'
		});
		viewport.clampZoom({ minScale: 0.3, maxScale: 5 });
		app.stage.addChild(viewport);

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

		handContainer = new LayoutContainer({
			layout: {
				width: '70%',
				height: '15%',
				justifyContent: 'center',
				flexDirection: 'row',
				alignItems: 'flex-end',
				alignContent: 'center',
				gap: 4,
				backgroundColor: 'red'
			}
		});
		handContainer.zIndex = 10;
		screenContainer.addChild(handContainer);

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
						selectItem(item);
					}
				}
			} else if (drag.dragType == 'selection') {
				const containers = selItems.values();
				for (const c of containers) {
					const cardId = c.id;
					c.cursor = 'pointer';

					room.send('moveend', {
						cardId: cardId,
						x: c.x,
						y: c.y
					});
				}
			}
			drag = null;
		}

		app.stage.addChild(marquee);

		app.stage.on('pointermove', (e) => {
            console.log(e.target);
            const topItem = findTopLevelItem(e.target);
            if (topItem) {
                hoverItem = topItem;
            }
			if (!drag) return;
			const worldPos = viewport.toWorld(e.global);
			const startWorldPos = viewport.toWorld(drag.startGlobalX, drag.startGlobalY);
			const delta = worldPos.subtract(startWorldPos);
			if (drag.dragType == 'marquee') {
				const width = e.global.x - drag.startGlobalX + e.globalX - marquee.x;
				const height = e.global.y - drag.startGlobalY + e.globalY - marquee.y;
				marquee.resize(width, height);
			} else if (drag.dragType == 'selection') {
				for (const boardItem of selItems) {
					const newPos = boardItem.position.add(delta);
					boardItem.position = newPos;
					room.send('move', {
						cardId: boardItem.id,
						x: boardItem.x,
						y: boardItem.y
					});
				}
			}
			drag.startGlobalX = e.globalX;
			drag.startGlobalY = e.globalY;
		});

		app.stage.on('pointerup', endDrag);
		app.stage.on('pointerupoutside', endDrag);
		app.stage.on('pointerdown', (e) => {
            console.log('Pointer down at', e.globalX, e.globalY, 'button:', e.button, 'ctrlKey:', e.ctrlKey, 'shiftKey:', e.shiftKey);
			const boardItem = findTopLevelItem(e.target);
			if (boardItem) {
				if (e.ctrlKey) {
					if (selItems.has(boardItem) && e.button === 1) {
						deselectItem(boardItem);
					} else {
						selectItem(boardItem);
					}
				} else {
					selectOnlyItem(boardItem);
				}
			}
			if (!boardItem) {
				selItems.forEach((item) => deselectItem(item));
			}
			drag = {
				startGlobalX: e.globalX,
				startGlobalY: e.globalY,
				clickThreshold: 10,
				dragType: 'selection'
			};
			if (e.button === 2 && boardItem) {
				handleRightClick(e, boardItem.id);
			}
			if (e.shiftKey) {
				drag.dragType = 'marquee';
				marquee.position.copyFrom(e.global);
				marquee.visible = true;
				marquee.resize(2, 2);
			} else if (!boardItem || !selItems.has(boardItem)) {
				drag = null;
			}
		});
		window.addEventListener('keydown', (e) => {
			console.log('Key down:', e.key, e.code);
			if (e.key === 'Escape') {
				closeContextMenu();
			} else if (e.code === 'KeyF') {
				selItems.forEach((item) => handleFlipCard(item));
			} else if (e.code === 'KeyD') {
				selItems.forEach((item) => handleDrawCard(item));
			} else if (e.code == 'Alt') {
                if (hoverItem) {
                    // TODO generate hover Preview in big on top of the item
                }
            }
		});

		room = await createOrJoinRoom(client, 'my_room');
		room.send('init', {
			cardAmount: hybridResults.length
		});
		let s = getStateCallbacks(room);

		s(room.state).cards.onAdd((card, index) => {
			initCard(hybridResults, card, card.idx);

			s(card).onChange(() => {
				if (card.owner === room.sessionId) return;
				const cardContainer = syncCards.get(index);
				if (cardContainer) {
					cardContainer.x = card.x;
					cardContainer.y = card.y;
					cardContainer.visible = card.visible;
					if (cardContainer.isFrontShowing() !== card.isFaceUp) {
						cardContainer.flip();
					}
				}
			});
		});

		// app.ticker.add((ticker) => {
		//           if (marquee.visible) {
		//
		//           }
		// });
		//
		return () => {
			app?.destroy(true, { children: true, texture: true });
		};
	});

	async function initCard(
		hybridResults: {
			front: LayoutContainer;
			back: LayoutContainer;
			index: number;
		}[],
		card: Card,
		i: number
	) {
		let x = card.x;
		const y = card.y;

		const { front, back } = hybridResults[i];

		const cardContainer = new BoardGameItem(front, back, card.id);

		cardContainer.x = x;
		cardContainer.y = y;

		syncCards.set(card.id, cardContainer);

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
        console.log('Drawing card', item.id);
		boardContainer.removeChild(item);

		item.scale.set(1);
		item.rotation = 0;
		item.pivot.set(0, 0);
		item.x = 0;
		item.y = 0;
		item.alpha = 1.0;

		const wrapper = new LayoutContainer({
			layout: {
				height: '100%',
				aspectRatio: item.width / item.height,
				objectFit: 'contain',
				objectPosition: 'center'
			}
		});

		wrapper.addChild(item);
		handContainer.addChild(wrapper);
		room.send('draw', {
			cardId: item.id
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
			<ContextMenu.Item onclick={() => selItems.forEach((item) => handleFlipCard(item))}
				>Flip Card
				<ContextMenu.Shortcut>F</ContextMenu.Shortcut>
			</ContextMenu.Item>
			<ContextMenu.Item onclick={() => selItems.forEach((item) => handleDrawCard(item))}
				>Draw Card
				<ContextMenu.Shortcut>D</ContextMenu.Shortcut>
			</ContextMenu.Item>
		</ContextMenu.Content>
	</ContextMenu.Root>
</div>
