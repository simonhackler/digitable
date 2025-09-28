<script lang="ts">
	import { Client, Room, getStateCallbacks } from 'colyseus.js';
	import { Application, Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
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
	let selectedCardId = $state('');

	function handleRightClick(e: any, cardId: string) {
		e.preventDefault();
		e.stopPropagation();

		selectedCardId = cardId;
		const cssPosition = pixiToCSSCoordinates(e.globalX, e.globalY);
		contextMenuPosition = cssPosition;
		showContextMenu = true;
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

	let viewport: Viewport;

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
				height: '30%',
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

		function endDragAndMaybeFlip(e: any) {
			if (!drag) return;

			// Don't flip on right-click (button 2)
			if (e.button === 2) {
				drag = null;
				return;
			}

			const worldPos = viewport.toWorld(e.globalX, e.globalY);
			const startWorldPos = viewport.toWorld(drag.startGlobalX, drag.startGlobalY);
			const dx = worldPos.x - startWorldPos.x;
			const dy = worldPos.y - startWorldPos.y;

			if (drag.dragType == 'marquee') {
				console.log(drag.dragType);
			} else if (drag.dragType == 'selection') {
				const dist = Math.hypot(dx, dy);

				const { containers: cardContainer } = drag;
				const cardId = drag.cardId;
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
			drag = null;
		}

		viewport.addChild(marquee);

		app.stage.on('pointermove', (e) => {
			if (!drag) return;

			// Convert screen coordinates to world coordinates
			const worldPos = viewport.toWorld(e.globalX, e.globalY);
			const startWorldPos = viewport.toWorld(drag.startGlobalX, drag.startGlobalY);

			const dx = worldPos.x - startWorldPos.x;
			const dy = worldPos.y - startWorldPos.y;
			if (drag.dragType == 'marquee') {
				const width = dx + worldPos.x - marquee.x;
				const height = dy + worldPos.y - marquee.y;
				marquee.resize(width, height);
			} else if (drag.dragType == 'selection') {
				for (const boardItem of selItems) {
					boardItem.x = boardItem.x + dx;
					boardItem.y = boardItem.y + dy;
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

		app.stage.on('pointerup', endDragAndMaybeFlip);
		app.stage.on('pointerupoutside', endDragAndMaybeFlip);
		app.stage.on('pointerdown', (e) => {
			let curr = e.target;
			while (curr != viewport && curr != app.stage) {
				if (
					curr instanceof BoardGameItem &&
					curr.parent &&
					!(curr.parent instanceof BoardGameItem)
				) {
					if (e.ctrlKey) {
						if (selItems.has(curr)) {
							selItems.delete(curr);
							curr.alpha = 1.0;
						} else {
							selItems.add(curr);
						}
					} else {
						selItems.forEach((item) => (item.alpha = 1.0));
						selItems = new Set<BoardGameItem>([curr]);
					}
					break;
				}
				curr = curr.parent!;
			}
			if (curr == viewport) {
				selItems.forEach((item) => (item.alpha = 1.0));
				selItems = new Set<BoardGameItem>();
			}
			let dragType: 'marquee' | 'selection';
			if (selItems.has(curr)) {
				curr.alpha = 0.7;
				dragType = 'selection';
			} else {
				dragType = 'marquee';
				marquee.position.copyFrom(viewport.toWorld(e.globalX, e.globalY));
				marquee.visible = true;
				// TODO: factor scaling into this?
				marquee.resize(2, 2);
			}
			drag = {
				startGlobalX: e.globalX,
				startGlobalY: e.globalY,
				clickThreshold: 10,
				dragType
			};
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

					if (cardContainer.isFrontShowing() !== card.isFaceUp) {
						cardContainer.flip();
					}
				}
			});
		});

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
		cardContainer.on('pointerdown', (e) => {
			drag = {
				startGlobalX: e.globalX,
				startGlobalY: e.globalY,
				clickThreshold: 10
			};
			cardContainer.cursor = 'grabbing';
			console.log('Pointer down on card', card.id);
		});

		cardContainer.on('rightdown', (e: any) => {
			handleRightClick(e, card.id);
		});

		boardContainer.addChild(cardContainer);
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
		card.alpha = 1.0;

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
