import type { SchemaCallbackProxy } from '@colyseus/schema';
import type { Room } from 'colyseus.js';
import { Container, Sprite, type Application } from 'pixi.js';
import { BoardGameItemNew, CardContainer } from '$lib/pixi/item';
import { assert } from '$lib/utils/assert';
import {
	type BoardGameRoomState,
	type Component
} from 'boardgame-server/src/rooms/schema/MyRoomState';
import {
	ClientFlippable,
	ClientPosition,
	ClientStack,
	type SharedClientValues
} from './frontend-components/position';

export interface ParsedSvg {
	id: string;
	front: Sprite;
	back: Sprite;
}

export interface InitComponentDependencies {
	boardContainer: Container;
	boardGameItems: Map<string, BoardGameItemNew>;
	isDragging: () => boolean;
}

async function buildStack(isFaceUp: boolean, topItem: BoardGameItemNew) {
	const cardContainer = topItem.itemContainer as CardContainer;
	const tex = !isFaceUp ? cardContainer.backSprite.texture : cardContainer.frontSprite.texture;

	const topSprite = new Sprite(tex);
	topSprite.setSize(topItem.getSize());
	topSprite.scale.set(1.0);

	const secondSprite = new Sprite(tex);
	topSprite.setSize(topItem.getSize());
	topSprite.scale.set(1.0);
	secondSprite.position.set(-15, 15);

	const thirdSprite = new Sprite(tex);
	thirdSprite.setSize(topItem.getSize());
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
	const { boardContainer, boardGameItems, isDragging } = deps;

	const sharedClientValues: SharedClientValues = {
		component,
		room,
		sessionId: room.sessionId,
		s
	};

	let boardGameItem: BoardGameItemNew;
	if (component.type == 'stack') {
		const stack = state.stacks.get(component.id);
		assert(stack, 'Stack not found in state');
		const stacks: BoardGameItemNew[] = [];
		for (const id of stack.componentIds) {
			console.log(id);
			if (!boardGameItems.has(id)) {
				initComponent(deps, hybridResults, state.components.get(id)!, state, s, room);
			}
			stacks.push(boardGameItems.get(id)!);
		}
		assert(stacks.length > 0, 'Stack has no items');

		let frontendPosition: ClientPosition | null = null;
		const position = state.positions.get(component.id);
		if (position) {
			frontendPosition = new ClientPosition(sharedClientValues, position);
		}

		const stackContainer = new Container();

		for (const item of stacks) {
			item.visible = false;
			item.renderable = false;
		}
		function rebuild(frontendFlip: ClientFlippable | null) {
			stackContainer.removeChildren();
			const isFaceUp = frontendFlip !== null ? frontendFlip.clientFlippableState.isFaceUp : true;
			const index = isFaceUp ? 0 : stacks.length - 1;
			const item = stacks[index];
			buildStack(isFaceUp, item).then((stackSprites) => {
				for (const sprite of stackSprites) {
					stackContainer.addChild(sprite);
				}
			});
		}

		const flippable = state.flippable.get(component.id);
		let frontendFlip: ClientFlippable | null = null;
		if (flippable) {
			frontendFlip = new ClientFlippable(sharedClientValues, flippable);
			frontendFlip.onFlipped.subscribe((_flippable) => {
				console.log('flipped');
				rebuild(frontendFlip);
			});
		}
		rebuild(frontendFlip);

		const clientStack = new ClientStack(sharedClientValues, stack);
		clientStack.onAdded.subscribe(({ id, index }) => {
			const newItem = boardGameItems.get(id);
			assert(newItem, `Stack item ${id} not found`);
			newItem.visible = false;
			stacks.splice(index, 0, newItem);
			rebuild(frontendFlip);
		});
		clientStack.onRemoved.subscribe((item) => {
			stacks.splice(
				stacks.findIndex((x) => x.id == item),
				1
			);
			rebuild(frontendFlip);
		});
		clientStack.onReordered.subscribe((nextIds) => {
			const nextItems: BoardGameItemNew[] = [];
			for (const id of nextIds) {
				const item = boardGameItems.get(id);
				assert(item, `Stack item ${id} not found`);
				nextItems.push(item);
			}
			stacks.length = 0;
			stacks.push(...nextItems);
			rebuild(frontendFlip);
		});

		boardGameItem = new BoardGameItemNew(
			stackContainer,
			component.id,
			frontendPosition,
			frontendFlip,
			clientStack
		);
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

		boardGameItem = new BoardGameItemNew(
			cardContainer,
			component.id,
			frontendPosition,
			frontendFlip
		);
	}
	boardGameItems.set(component.id, boardGameItem);

	boardGameItem.scale.set(0.5);
	boardGameItem.eventMode = 'static';
	boardGameItem.cursor = 'pointer';
	boardGameItem.on('pointerover', () => {
		if (!isDragging()) boardGameItem.tint = 0xcccccc;
	});
	boardGameItem.on('pointerout', () => {
		boardGameItem.tint = 0xffffff;
	});
	boardContainer.addChild(boardGameItem);
}
