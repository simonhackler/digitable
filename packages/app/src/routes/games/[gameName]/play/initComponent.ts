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
	ClientStack,
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
	topItem.visible = true;
	topItem.renderable = true;
	// TODO full on refactor that reuses textures.
	// topItem.position.set(-9999, -9999);
	// This has to be more robust
	// await new Promise(requestAnimationFrame);
	// await new Promise(requestAnimationFrame);
	// await new Promise(requestAnimationFrame);
	// await new Promise(requestAnimationFrame);
	// await new Promise(requestAnimationFrame);
	app.renderer.layout.update(topItem);
	const tex = app.renderer.generateTexture({ target: topItem, resolution: 2 });
	console.log('texs: ', tex.width, tex.height);
	topItem.visible = false;

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
	const { app, boardContainer, boardGameItems, isDragging } = deps;

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

		await new Promise(requestAnimationFrame);
		await new Promise(requestAnimationFrame);

		for (const item of stacks) {
			// item.visible = false;
			item.renderable = false;
		}

		function rebuild() {
			console.log('rebuilding');
			stackContainer.removeChildren();
			const flippable = state.flippable.get(component.id);
			const index = !flippable || flippable.isFaceUp ? 0 : stacks.length - 1;
			const item = stacks[index];
			if (flippable) {
				const front = item.children[0].children[0];
				const back = item.children[0].children[1];
				front.visible = flippable.isFaceUp;
				back.visible = !flippable.isFaceUp;
			}
			buildStack(app, item).then((stackSprites) => {
				for (const sprite of stackSprites) {
					stackContainer.addChild(sprite);
				}
			});
		}

		const flippable = state.flippable.get(component.id);
		let frontendFlip: ClientFlippable | null = null;
		if (flippable) {
			rebuild();
			frontendFlip = new ClientFlippable(sharedClientValues, flippable);
			frontendFlip.onFlipped.subscribe((_flippable) => {
				console.log('flipped');
				rebuild();
			});
		}

		const clientStack = new ClientStack(sharedClientValues, stack);
		clientStack.onAdded.subscribe(({ id, index }) => {
			const newItem = boardGameItems.get(id);
			assert(newItem, `Stack item ${id} not found`);
			newItem.visible = false;
			stacks.splice(index, 0, newItem);
			rebuild();
		});
		clientStack.onRemoved.subscribe((item) => {
			stacks.splice(
				stacks.findIndex((x) => x.id == item),
				1
			);
			rebuild();
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
			rebuild();
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
