import type { SchemaCallbackProxy } from '@colyseus/schema';
import type { Room } from 'colyseus.js';
import { Container, Sprite, type Application } from 'pixi.js';
import { LayoutContainer } from '@pixi/layout/components';
import { BoardGameItemNew, CardContainer } from '$lib/pixi/item';
import { assert } from '$lib/utils/assert';
import {
	type BoardGameRoomState,
	type Component
} from 'boardgame-server/src/rooms/schema/MyRoomState';
import {
	ClientFlippable,
	ClientPosition,
	type SharedClientValues
} from './frontend-components/position';

export interface ParsedSvg {
	id: string;
	front: LayoutContainer;
	back: LayoutContainer;
}

export interface InitComponentDependencies {
	app: Application;
	boardContainer: Container;
	boardGameItems: Map<string, BoardGameItemNew>;
	isDragging: () => boolean;
}

async function buildStack(app: Application, topItem: BoardGameItemNew) {
	const itemContainerTop = topItem.itemContainer;

	itemContainerTop.visible = true;
	// This is hacky as to not have flickering
	itemContainerTop.position.set(-9999, -9999);
	// This has to be more robust
	await new Promise(requestAnimationFrame);
	await new Promise(requestAnimationFrame);
	const tex = app.renderer.generateTexture({ target: itemContainerTop, resolution: 2 });
	itemContainerTop.visible = false;

	const topSprite = new Sprite(tex);
	topSprite.setSize(itemContainerTop.getSize());
	topSprite.scale.set(1.0);

	const secondSprite = new Sprite(tex);
	topSprite.setSize(itemContainerTop.getSize());
	topSprite.scale.set(1.0);
	secondSprite.position.set(-15, 15);

	const thirdSprite = new Sprite(tex);
	thirdSprite.setSize(itemContainerTop.getSize());
	thirdSprite.scale.set(1.0);
	thirdSprite.position.set(-30, 30);
	return [topSprite, secondSprite, thirdSprite];
}

export async function initComponent(
	deps: InitComponentDependencies,
	hybridResults: ParsedSvg[],
	component: Component,
	state: BoardGameRoomState,
	s: SchemaCallbackProxy<BoardGameRoomState>,
	room: Room<BoardGameRoomState>
) {
	const { app, boardContainer, boardGameItems, isDragging } = deps;

	const sharedClientValues: SharedClientValues = {
		component,
		room,
		sessionId: room.sessionId,
		s
	};

	let itemContainer: Container;
	if (component.type == 'stack') {
		const stack = state.stacks.get(component.id);
		assert(stack, 'Stack not found in state');
		const stacks: BoardGameItemNew[] = [];
		for (const id of stack.componentIds) {
			console.log(id);
			if (!boardGameItems.has(id)) {
				await initComponent(deps, hybridResults, state.components.get(id)!, state, s, room);
			}

			stacks.push(boardGameItems.get(id)!);
		}
		assert(stacks.length > 0, 'Stack has no items');

		let frontendPosition: ClientPosition | null = null;
		const position = state.positions.get(component.id);
		if (position) {
			frontendPosition = new ClientPosition(sharedClientValues, position);
		}
		const stackContainer = new Container({
			layout: {
				aspectRatio: stacks[0].itemContainer.width / stacks[0].itemContainer.height
			}
		});
		stackContainer.layout = true;

		const topItem = stacks[0];
		const stackSprites = buildStack(app, topItem);
		for (const sprite of await stackSprites) {
			stackContainer.addChild(sprite);
		}

		for (const item of stacks) {
			item.itemContainer.visible = false;
		}

		let frontendFlip: ClientFlippable | null = null;
		const flippable = state.flippable.get(component.id);

		if (flippable) {
			frontendFlip = new ClientFlippable(sharedClientValues, flippable);
			frontendFlip.onFlipped.subscribe((flippable) => {
				// Delete all children
				stackContainer.removeChildren();
				// Rebuild stack
				const index = flippable.isFaceUp ? 0 : stacks.length - 1;
				const item = stacks[index];
				const front = item.itemContainer.children[0].children[0];
				const back = item.itemContainer.children[0].children[1];
				front.visible = flippable.isFaceUp;
				back.visible = !flippable.isFaceUp;
				buildStack(app, item).then((stackSprites) => {
					for (const sprite of stackSprites) {
						stackContainer.addChild(sprite);
					}
				});
			});
		}

		const boardGameItem = new BoardGameItemNew(
			stackContainer,
			component.id,
			frontendPosition,
			frontendFlip
		);
		itemContainer = boardGameItem.itemContainer;
	} else {
		const card = hybridResults.find((x) => x.id == component.id);
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

		itemContainer = boardGameItem.itemContainer;
	}
	itemContainer.scale.set(0.5);
	itemContainer.eventMode = 'static';
	itemContainer.cursor = 'pointer';
	itemContainer.on('pointerover', () => {
		if (!isDragging()) itemContainer.tint = 0xcccccc;
	});
	itemContainer.on('pointerout', () => {
		itemContainer.tint = 0xffffff;
	});
	boardContainer.addChild(itemContainer);
}
