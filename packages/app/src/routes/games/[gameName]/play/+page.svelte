<script lang="ts">
	import { Client, Room, getStateCallbacks } from 'colyseus.js';
	import { Application, Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
	import '@pixi/layout';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { getFileSystemContext } from '../../context';
	import { loadAndProcessCards } from './pixi-card-loader';
	import { error } from '@sveltejs/kit';
	import { BoardgameRoomState } from 'boardgame-server/src/rooms/schema/MyRoomState';
	import { BoardGameItem } from '$lib/pixi/item';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { Viewport } from 'pixi-viewport';
	import { LayoutContainer } from '@pixi/layout/components';
	import { initDevtools } from '@pixi/devtools';

	// TODO: Simple data driven design. Server should sync the data to the clients.
	// Then clients update components based on the data.
	// How to send updates to the server?
	// Players probably need to "own" components so they will not be updated by the server, except if the owner changes
	// Client functions will have to update data on the client and send the changes to the server
	// Create a small query based system. Server is authorative.

	// The data layout is tricky here. Players can have cards in hand, moving or on their own board, where they should not be interactable
	// Should this all be maps, each player has a map of their own cards? What about cards that might be owned by 2 players? Then they
	// would have to be moved from array to array etc. How to handle timeouts? E.g locks for cards that are on the board
	// should be released. However locks for cards in hand should not be released.

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
	const room = await createOrJoinRoom(client, 'my_room');

	const s = getStateCallbacks(room);

	let syncCards: Map<string, BoardGameItem> = new Map();

	// Context menu state
	let showContextMenu = $state(false);
	let contextMenuPosition = $state({ x: 0, y: 0 });
	let selectedCardId = $state('');

	function handleRightClick(e: any, cardId: string) {
		e.preventDefault();
		e.stopPropagation();

		console.log('Right click on card index:', cardId);
		selectedCardId = cardId;

		// Convert PIXI coordinates to CSS coordinates
		const cssPosition = pixiToCSSCoordinates(e.globalX, e.globalY);
		console.log('Context menu CSS position:', cssPosition);
		contextMenuPosition = cssPosition;
		showContextMenu = true;
	}

	function pixiToCSSCoordinates(pixiX: number, pixiY: number) {
		if (!app) return { x: pixiX, y: pixiY };

		// Get canvas bounds in CSS pixels
		const canvas = app.canvas;
		const canvasRect = canvas.getBoundingClientRect();

		// Get renderer internal size (in device pixels)
		const res = app.renderer.resolution;
		const internalW = app.renderer.width;
		const internalH = app.renderer.height;

		// Scale factors from PIXI coords → CSS pixels
		const sx = canvasRect.width / internalW;
		const sy = canvasRect.height / internalH;

		// Convert PIXI coordinates to CSS coordinates
		const cssX = pixiX * sx;
		const cssY = pixiY * sy;

		return { x: cssX, y: cssY };
	}

	function closeContextMenu() {
		showContextMenu = false;
		selectedCardId = '';
	}

	function handleFlipCard(cardId: string) {
		const cardContainer = syncCards.get(cardId);
		if (cardContainer) {
			cardContainer.flip();
			room.send('flip', {
				cardId,
				isFaceUp: cardContainer.isFrontShowing()
			});
		}
		closeContextMenu();
	}

	let boardContainer: Container;
	let handContainer: Container;
	let hybridResults: {
		front: LayoutContainer;
		back: LayoutContainer;
		index: number;
	}[];

	// Context menu prevention handler
	function handleContextMenu(e: Event) {
		e.preventDefault();
	}

	onMount(async () => {
		// Disable native context menu on the entire page
		const handleContextMenu = (e: Event) => {
			e.preventDefault();
		};
		document.addEventListener('contextmenu', handleContextMenu);

		// Listen for card array changes
		s(room.state).cards.onAdd((card, index) => {
			if (syncCards[index]) {
				syncCards[index].x = card.x;
				syncCards[index].y = card.y;
			}

			// Listen to individual card changes
			s(card).onChange(() => {
				if (card.owner === room.sessionId) return;
				const cardContainer = syncCards[index];
				if (syncCards[index]) {
					cardContainer.x = card.x;
					cardContainer.y = card.y;

					if (cardContainer.isFrontShowing() !== card.isFaceUp) {
						cardContainer.flip();
					}
				}
			});
		});
		app = new Application();
		await app.init({
			background: '#2c3e50',
			// width: 1920,
			// height: 1080,
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
		const viewport = new Viewport({
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
		viewport.moveCenter(viewport.worldWidth / 2, viewport.worldHeight / 2);
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
				height: '30%',
				justifyContent: 'center',
				flexDirection: 'row',
				alignItems: 'flex-end',
				alignContent: 'center',
				gap: 4,
				backgroundColor: 'red'
			}
		});
		handContainer.zIndex = 10; // always above the board

		screenContainer.addChild(handContainer);

		// ---- robust drag state managed at stage level ----
		type DragState = {
			container: BoardGameItem;
			startGlobalX: number;
			startGlobalY: number;
			startX: number;
			startY: number;
			clickThreshold: number;
			cardId: string;
		} | null;

		let drag: DragState = null;

		function endDragAndMaybeFlip(e: any) {
			if (!drag) return;

			// Don't flip on right-click (button 2)
			if (e.button === 2) {
				drag = null;
				return;
			}

			// Convert screen coordinates to world coordinates for distance calculation
			const worldPos = viewport.toWorld(e.globalX, e.globalY);
			const startWorldPos = viewport.toWorld(drag.startGlobalX, drag.startGlobalY);

			const dx = worldPos.x - startWorldPos.x;
			const dy = worldPos.y - startWorldPos.y;
			const dist = Math.hypot(dx, dy);

			const { container: cardContainer } = drag;
			const cardId = drag.cardId;
			drag = null;
			cardContainer.cursor = 'pointer';

			// This is ugly and does not work properly
			if (dist < 10) {
				cardContainer.flip();
				if (cardId !== '') {
					room.send('flip', {
						cardIndex: cardId,
						isFaceUp: cardContainer.isFrontShowing()
					});
				}
			}

			if (cardId !== '') {
				console.log(`Sending move end for card ${cardId}:`, cardContainer.x, cardContainer.y);
				room.send('moveend', {
					cardId: cardId,
					x: cardContainer.x,
					y: cardContainer.y
				});
			}
		}

		app.stage.on('pointermove', (e) => {
			if (!drag) return;

			// Convert screen coordinates to world coordinates
			const worldPos = viewport.toWorld(e.globalX, e.globalY);
			const startWorldPos = viewport.toWorld(drag.startGlobalX, drag.startGlobalY);

			const dx = worldPos.x - startWorldPos.x;
			const dy = worldPos.y - startWorldPos.y;

			drag.container.x = drag.startX + dx;
			drag.container.y = drag.startY + dy;
			room.send('move', {
				cardId: drag.cardId,
				x: drag.container.x,
				y: drag.container.y
			});
		});

		app.stage.on('pointerup', endDragAndMaybeFlip);
		app.stage.on('pointerupoutside', endDragAndMaybeFlip);

		room.send('init', {
			length: hybridResults.length
		});

		return () => {
			app?.destroy(true, { children: true, texture: true });
		};
	});

	async function initCards(
		hybridResults: {
			front: LayoutContainer;
			back: LayoutContainer;
			index: number;
		}[],
		ids: string[]
	) {
		// send init here.

		let x = 50;
		const y = 50;
		const cardSpacing = 150;

		// Create card containers with hybrid rendering
		for (let i = 0; i < hybridResults.length; i++) {
			const { front, back } = hybridResults[i];

			const cardContainer = new BoardGameItem(front, back);

			cardContainer.x = x;
			cardContainer.y = y;

			const id = crypto.randomUUID();
			ids.push(id);
			syncCards.set(id, cardContainer);

			cardContainer.scale.set(0.5);

			cardContainer.eventMode = 'static';
			cardContainer.cursor = 'pointer';

			cardContainer.on('pointerover', () => {
				if (!drag) cardContainer.tint = 0xcccccc;
			});
			cardContainer.on('pointerout', () => {
				cardContainer.tint = 0xffffff;
			});
			cardContainer.on('pointerdown', (e: any) => {
				// Convert screen coordinates to world coordinates for initial position
				const worldPos = viewport.toWorld(e.globalX, e.globalY);

				drag = {
					container: cardContainer,
					startGlobalX: e.globalX,
					startGlobalY: e.globalY,
					startX: cardContainer.x,
					startY: cardContainer.y,
					clickThreshold: 10,
					cardId: id
				};
				cardContainer.cursor = 'grabbing';
			});

			cardContainer.on('rightdown', (e: any) => {
				handleRightClick(e, id);
			});

			boardContainer.addChild(cardContainer);
			x += cardSpacing;
		}
	}

	onDestroy(() => {
		// Remove context menu prevention
		document.removeEventListener('contextmenu', handleContextMenu);
		app?.destroy(true, { children: true, texture: true });
	});

	function handleDrawCard(cardId: string) {
		console.log('drawing card ' + cardId);
		const card = syncCards.get(cardId);
		console.log(card);
		if (!card) return;
		console.log('my card');

		boardContainer.removeChild(card);

		// Reset transforms so layout sizing is predictable inside the hand row.
		card.scale.set(1);
		card.rotation = 0;
		card.pivot.set(0, 0);
		card.x = 0;
		card.y = 0;

		const wrapper = new LayoutContainer({
			layout: {
				height: '100%',
				aspectRatio: card.width / card.height,
				objectFit: 'contain',
				objectPosition: 'center'
			}
		});

		wrapper.addChild(card);
		handContainer.addChild(wrapper);
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
			<ContextMenu.Item onclick={() => handleFlipCard(selectedCardId)}>Flip Card</ContextMenu.Item>
			<ContextMenu.Item onclick={() => handleDrawCard(selectedCardId)}>Draw Card</ContextMenu.Item>
		</ContextMenu.Content>
	</ContextMenu.Root>
</div>
