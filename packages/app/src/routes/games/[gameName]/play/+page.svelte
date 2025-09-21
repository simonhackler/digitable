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
	import { createHybridContainer } from './pixi-card-loader';
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
	console.log(client);
	const room = await createOrJoinRoom(client, 'my_room');
	console.log(room);

	const s = getStateCallbacks(room);

	let syncCards: BoardGameItem[] = [];

	// Context menu state
	let showContextMenu = $state(false);
	let contextMenuPosition = $state({ x: 0, y: 0 });
	let selectedCardIndex = $state(-1);

	function handleRightClick(e: any, cardIndex: number) {
		e.preventDefault();
		e.stopPropagation();

		console.log('Right click on card index:', cardIndex);
		selectedCardIndex = cardIndex;

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
		selectedCardIndex = -1;
	}

	function handleFlipCard(cardIndex: number) {
		const cardContainer = syncCards[cardIndex];
		if (cardContainer) {
			cardContainer.flip();
			room.send('flip', {
				cardIndex,
				isFaceUp: cardContainer.isFrontShowing()
			});
		}
		closeContextMenu();
	}

	let boardContainer: Container;
	let handContainer: Container;

	onMount(async () => {
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
		const handContainer2 = new LayoutContainer({
			layout: {
				width: '70%',
				height: '30%',
				justifyContent: 'center',
				flexDirection: 'row',
				alignItems: 'flex-end',
				gap: 4,
				backgroundColor: 'blue'
			}
		});
		handContainer.zIndex = 10; // always above the board

		screenContainer.addChild(handContainer);
		screenContainer.addChild(handContainer2);

		// ---- robust drag state managed at stage level ----
		type DragState = {
			container: BoardGameItem;
			startGlobalX: number;
			startGlobalY: number;
			startX: number;
			startY: number;
			clickThreshold: number;
			index: number;
		} | null;

		let drag: DragState = null;

		function endDragAndMaybeFlip(e: any) {
			if (!drag) return;

			// Convert screen coordinates to world coordinates for distance calculation
			const worldPos = viewport.toWorld(e.globalX, e.globalY);
			const startWorldPos = viewport.toWorld(drag.startGlobalX, drag.startGlobalY);

			const dx = worldPos.x - startWorldPos.x;
			const dy = worldPos.y - startWorldPos.y;
			const dist = Math.hypot(dx, dy);

			const { container: cardContainer } = drag;
			const cardIndex = syncCards.indexOf(cardContainer);
			drag = null;
			cardContainer.cursor = 'pointer';

			// This is ugly and does not work properly
			if (dist < 10) {
				cardContainer.flip();
				if (cardIndex !== -1) {
					room.send('flip', {
						cardIndex,
						isFaceUp: cardContainer.isFrontShowing()
					});
				}
			}

			if (cardIndex !== -1) {
				console.log(`Sending move end for card ${cardIndex}:`, cardContainer.x, cardContainer.y);
				room.send('moveend', {
					cardIndex,
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
				cardIndex: drag.index,
				x: drag.container.x,
				y: drag.container.y
			});
		});

		app.stage.on('pointerup', endDragAndMaybeFlip);
		app.stage.on('pointerupoutside', endDragAndMaybeFlip);

		try {
			const hybridResults = await loadAndProcessCards(projectName, cardName, fileSystem);

			let x = 50;
			const y = 50;
			const cardSpacing = 150;

			// Create card containers with hybrid rendering
			for (let i = 0; i < hybridResults.length; i++) {
				const { front, back } = hybridResults[i];

				const cardContainer = new BoardGameItem(front, back);

				cardContainer.x = x;
				cardContainer.y = y;

				syncCards.push(cardContainer);

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
						index: i
					};
					cardContainer.cursor = 'grabbing';
				});

				cardContainer.on('rightdown', (e: any) => {
					handleRightClick(e, i);
				});

				boardContainer.addChild(cardContainer);
				x += cardSpacing;
			}

			room.send('initializeGame', {
				cardCount: hybridResults.length
			});
		} catch (error) {
			console.error('Failed to load SVG data:', error);
		}

		return () => {
			app?.destroy(true, { children: true, texture: true });
		};
	});

	onDestroy(() => {
		app?.destroy(true, { children: true, texture: true });
	});

	function handleDrawCardd(selectedCardIndex: number) {
		const card = syncCards[selectedCardIndex];
		if (!card) return;

		// 1) Remove from board
		boardContainer.removeChild(card);

		// 2) Reset transforms so layout has a clean slate
		card.scale.set(1);
		card.rotation = 0;
		card.pivot.set(0, 0);
		// If BoardGameItem exposes anchors for its sprites, force top-left:
		// card.setAnchors?.(0, 0); // or card.front.anchor.set(0); card.back.anchor.set(0);

		// 3) Optional but safest: put the card inside a layout wrapper so anchor/flip logic
		//    inside the card never confuses the layout engine.
		const wrapper = new LayoutContainer({
			layout: {
				// Fill the hand row vertically; width is derived from aspectRatio.
				height: '100%',
				aspectRatio: card.width / card.height, // ratio is scale-independent
				objectFit: 'contain',
				objectPosition: 'center'
			}
		});

		// Place the visual at (0,0) inside the wrapper.
		card.x = 0;
		card.y = 0;
		wrapper.addChild(card);

		handContainer.addChild(wrapper);
	}

	function handleDrawCard(selectedCardIndex: number) {
		console.log('Drawing card index:', selectedCardIndex);
		const card = syncCards[selectedCardIndex];
		if (!card) return;

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
			<ContextMenu.Item onclick={() => handleFlipCard(selectedCardIndex)}>
				Flip Card
			</ContextMenu.Item>
			<ContextMenu.Item onclick={() => handleDrawCard(selectedCardIndex)}>
				Draw Card
			</ContextMenu.Item>
		</ContextMenu.Content>
	</ContextMenu.Root>
</div>
