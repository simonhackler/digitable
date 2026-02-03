<script lang="ts">
	import { type SchemaCallbackProxy } from '@colyseus/schema';
	import { Client, getStateCallbacks, Room } from 'colyseus.js';
	import {
		Application,
		Container,
		FederatedPointerEvent,
		Point,
		Rectangle,
		Sprite,
		type Renderer
	} from 'pixi.js';
	import { MarqueeSelection } from '@pixi/marquee-selection';
	import '@pixi/layout';
	import { onMount, onDestroy, tick } from 'svelte';
	import { page } from '$app/state';
	import { getFileSystemContext } from '../../context';
	import { loadAndProcessCards } from './pixi-card-loader';
	import {
		Flippable,
		type BoardGameRoomState,
		type Component,
		type InitGamePayload
	} from 'boardgame-server/src/rooms/schema/MyRoomState';
	import { BoardGameItemNew, CardContainer } from '$lib/pixi/item';
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
	import {
		ClientFlippable,
		ClientPosition,
		type SharedClientValues
	} from './frontend-components/position';
	import { assert, requireParam } from '$lib/utils/assert';
	import type { Attachment } from 'svelte/attachments';
	import { PressedKeys } from 'runed';
	import TtsPreview from '../export/tts-preview.svelte';

	const projectName = $derived(requireParam('gameName'));
	const cardName = $derived(page.params.deckName || 'western');
	const fileSystem = getFileSystemContext();
	const client = new Client('ws://localhost:2567');

	let boardGameItems: Map<string, BoardGameItemNew> = new Map();
	let positions: Map<string, ClientPosition> = new Map();

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

	interface ParsedSvg {
		id: string;
		front: LayoutContainer;
		back: LayoutContainer;
	}

	let boardContainer: Container;
	let handContainer: HandContainer;

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

	// I am fighting against pixi's event target system here. This can probably be done more elegantly
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

	// Can init stacks, or singular components with ids and containers
	// So one map of components and one map of stacks with stacks having maps of components
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
			} else if (drag.dragType == 'handToBoard') {
				for (const c of selectionManager.values()) {
					if (handContainer.hasItem(c)) {
						c.x = 0;
						c.y = 0;
					} else {
						handlePlayCard(c);
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
		return true;
	}

	async function createRoom(_init: boolean) {
		const hybridResults = await loadAndProcessCards(projectName, cardName, fileSystem);
		const roomName = 'my_room';
		const room = await client.joinOrCreate<BoardGameRoomState>(roomName);
		let s = getStateCallbacks(room);

		s(room.state).components.onAdd((component, _index) => {
			initComponent(hybridResults, component, room.state, s);
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

	async function initComponent(
		hybridResults: ParsedSvg[],
		component: Component,
		state: BoardGameRoomState,
		s: SchemaCallbackProxy<BoardGameRoomState>
	) {
		const sharedClientValues: SharedClientValues = {
			component,
			room,
			sessionId: room.sessionId,
			s
		};
		// 2 different ways. Basically bundles. E.g Bags decks etc that hold items.
		// Bags are different to stacks. Bags don't hold have any order
		if (component.type == 'stack') {
			const stack = state.stacks.get(component.id);
			assert(stack, 'Stack not found in state');
			const stacks: BoardGameItemNew[] = [];
			for (const id of stack.componentIds) {
				console.log(id);
				if (!boardGameItems.has(id)) {
					initComponent(hybridResults, state.components.get(id)!, state, s);
				}

				stacks.push(boardGameItems.get(id)!);
			}
			assert(stacks.length > 0, 'Stack has no items');

			let frontendPosition: ClientPosition | null = null;
			const position = state.positions.get(component.id);
			if (position) {
				frontendPosition = new ClientPosition(sharedClientValues, position);
			}
			let frontendFlip: ClientFlippable | null = null;
			const flippable = state.flippable.get(component.id);

			const stackContainer = new Container();

			// Ensure the top item is visible when generating the preview texture,
			// otherwise Pixi renders a transparent sprite.
			const topItem = stacks[0];
			const wasVisible = topItem.visible;
			topItem.visible = true;
			await new Promise(requestAnimationFrame);
			await new Promise(requestAnimationFrame);

			const tex = app.renderer.generateTexture({ target: topItem, resolution: 2 });

			topItem.visible = wasVisible;
			const topSprite = new Sprite(tex);
			stackContainer.addChild(topSprite);
			topSprite.setSize(topItem.getSize());
			topSprite.scale.set(1.0);

			const secondSprite = new Sprite(tex);
			stackContainer.addChild(secondSprite);
			topSprite.setSize(topItem.getSize());
			topSprite.scale.set(1.0);
			secondSprite.position.set(-15, 15);

			const thirdSprite = new Sprite(tex);
			stackContainer.addChild(thirdSprite);
			thirdSprite.setSize(topItem.getSize());
			thirdSprite.scale.set(1.0);
			thirdSprite.position.set(-30, 30);

			for (const item of stacks) {
				item.visible = false;
			}

			const boardGameItem = new BoardGameItemNew(
				stackContainer,
				component.id,
				frontendPosition,
				frontendFlip
			);
			boardGameItem.scale.set(0.5);
			boardGameItem.eventMode = 'static';
			boardGameItem.cursor = 'pointer';
			boardGameItem.on('pointerover', () => {
				if (!drag) boardGameItem.tint = 0xcccccc;
			});
			boardGameItem.on('pointerout', () => {
				boardGameItem.tint = 0xffffff;
			});
			boardContainer.addChild(boardGameItem);
			// new FrontendStack(room, component, stacks, stack, s);
		} else {
			const card = hybridResults.find((x) => x.id == component.id); // This is never big enough to need a map
			assert(card, 'Card not found in hybrid results');
			if (boardGameItems.has(card.id)) {
				return;
			}
			const cardContainer = new CardContainer(card.front, card.back);

			let frontendPosition: ClientPosition | null = null;
			const position = state.positions.get(component.id);
			if (position) {
				frontendPosition = new ClientPosition(sharedClientValues, position);
			}
			let frontendFlip: ClientFlippable | null = null;

			const flippable = state.flippable.get(component.id);
			if (flippable) {
				frontendFlip = new ClientFlippable(sharedClientValues, flippable);
				frontendFlip.onFlipped.subscribe((flippable) => {
					if (flippable.isFaceUp) {
						card.front.visible = true;
						card.back.visible = false;
					} else {
						card.front.visible = false;
						card.back.visible = true;
					}
				});
			}

			const boardGameItem = new BoardGameItemNew(
				cardContainer,
				component.id,
				frontendPosition,
				frontendFlip
			);
			boardGameItems.set(component.id, boardGameItem);

			boardGameItem.scale.set(0.5);
			boardGameItem.eventMode = 'static';
			boardGameItem.cursor = 'pointer';
			boardGameItem.on('pointerover', () => {
				if (!drag) boardGameItem.tint = 0xcccccc;
			});
			boardGameItem.on('pointerout', () => {
				boardGameItem.tint = 0xffffff;
			});
			boardContainer.addChild(boardGameItem);
		}
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
		boardContainer.removeChild(item);
		handContainer.addItem(item);
		sendCmd(room, 'draw', { cardId: item.id });
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
		</ContextMenu.Content>
	</ContextMenu.Root>
</div>
