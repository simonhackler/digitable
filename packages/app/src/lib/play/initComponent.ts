import type { SchemaCallbackProxy } from '@colyseus/schema';
import type { Room } from 'colyseus.js';
import { Container, Sprite, type Texture } from 'pixi.js';
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
	width: number;
	height: number;
	front: Container;
	back: Container;
}

export interface InitComponentDependencies {
	boardContainer: Container;
	boardGameItems: Map<string, BoardGameItemNew>;
	isDragging: () => boolean;
	configureItem?: (item: BoardGameItemNew) => void;
}

function collectSpriteTextures(container: Container): Texture[] {
	const textures: Texture[] = [];
	if (container instanceof Sprite) {
		textures.push(container.texture);
	}

	for (const child of container.children) {
		textures.push(...collectSpriteTextures(child as Container));
	}

	return textures;
}

function createStackFace(textures: Texture[], size: { width: number; height: number }) {
	assert(textures.length > 0, 'Stack card texture not found');

	const face = new Container({
		layout: {
			width: size.width,
			height: size.height,
			aspectRatio: size.width / size.height
		}
	});
	for (const texture of textures) {
		const sprite = new Sprite(texture);
		sprite.width = size.width;
		sprite.height = size.height;
		face.addChild(sprite);
	}
	return face;
}

function buildStack(isFaceUp: boolean, topItem: BoardGameItemNew) {
	const cardContainer = topItem.itemContainer as CardContainer;
	const face = !isFaceUp ? cardContainer.backSprite : cardContainer.frontSprite;
	const textures = collectSpriteTextures(face);
	const cardSize = topItem.contentLocalBounds();

	const topSprite = createStackFace(textures, cardSize);

	const secondSprite = createStackFace(textures, cardSize);
	secondSprite.position.set(-15, 15);

	const thirdSprite = createStackFace(textures, cardSize);
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
			for (const child of stackContainer.removeChildren()) {
				child.destroy({ children: true });
			}

			const isFaceUp = frontendFlip !== null ? frontendFlip.clientFlippableState.isFaceUp : true;
			const index = isFaceUp ? 0 : stacks.length - 1;
			const item = stacks[index];
			const stackSprites = buildStack(isFaceUp, item);
			for (const sprite of stackSprites) {
				stackContainer.addChild(sprite);
			}
		}

		const flippable = state.flippable.get(component.id);
		let frontendFlip: ClientFlippable | null = null;
		if (flippable) {
			frontendFlip = new ClientFlippable(sharedClientValues, flippable);
			frontendFlip.onFlipped.subscribe((_flippable) => {
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
		const cardContainer = new CardContainer(card.front, card.back, {
			width: card.width,
			height: card.height
		});

		let frontendPosition: ClientPosition | null = null;
		const position = state.positions.get(component.id);
		if (position) {
			frontendPosition = new ClientPosition(sharedClientValues, position);
		}
		let frontendFlip: ClientFlippable | null = null;

		const flippable = state.flippable.get(component.id);
		if (flippable) {
			frontendFlip = new ClientFlippable(sharedClientValues, flippable);
			cardContainer.showFace(frontendFlip.clientFlippableState.isFaceUp);
			frontendFlip.onFlipped.subscribe((flippable) => {
				cardContainer.showFace(flippable.isFaceUp);
			});
		}

		boardGameItem = new BoardGameItemNew(
			cardContainer,
			component.id,
			frontendPosition,
			frontendFlip,
			null,
			{ width: card.width, height: card.height }
		);
	}
	boardGameItems.set(component.id, boardGameItem);

	// boardGameItem.scale.set(0.5);
	deps.configureItem?.(boardGameItem);
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
