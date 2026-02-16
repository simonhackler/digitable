import { Client, Room } from 'colyseus';
import { logger } from '@colyseus/core';

import {
	BoardGameRoomState as BoardGameRoomState,
	Deck,
	Item,
	Player,
	Component,
	Positionable,
	Flippable,
	Stack,
	InitGamePayload
} from './schema/MyRoomState';
import { Command, Dispatcher } from '../command';
import { randomUUID } from 'crypto';

export class CommandRoom extends Room<BoardGameRoomState> {
	dispatcher = new Dispatcher(this);
	roomCommands = new Map<string, new () => Command<CommandRoom, any>>([
		['flip', FlipCommand],
		['init', InitCommand],
		['move', MoveCommand],
		['moveend', MoveEndCommand],
		['draw', DrawCommand],
		['play', PlayCommand]
	]);

	onCreate() {
		logger.info('CommandRoom created');
		this.state = new BoardGameRoomState();
		this.onMessage('cmd', (client, message) => {
			logger.info(`Received command: ${message.commandType} from ${client.sessionId}`);
			const CommandClass = this.roomCommands.get(message.commandType);
			if (CommandClass) {
				const command = new CommandClass();
				this.dispatcher.dispatch(command, { ...message.payload, sessionId: client.sessionId });
			}
		});
	}

	onJoin(client: Client, _options: any) {
		logger.info('Client joined:', client.sessionId);
		this.dispatcher.dispatch(new OnJoinCommand(), {
			sessionId: client.sessionId
		});
	}

	onDispose() {
		this.dispatcher.stop();
	}
}

function getValidComponent(
	state: BoardGameRoomState,
	componentId: string,
	sessionId: string,
	allowOwned: boolean = true
) {
	const component = state.components.get(componentId);
	if (!component) {
		console.error('Invalid card id:', componentId);
		return null;
	}
	if (!allowOwned && component.owner !== '' && component.owner !== sessionId) {
		console.warn(`Component ${componentId} is currently owned by another player.`);
		return null;
	}
	return component;
}

export class OnJoinCommand extends Command<
	CommandRoom,
	{
		sessionId: string;
	}
> {
	execute({ sessionId } = this.payload) {
		const player = new Player(sessionId);
		this.state.players.set(sessionId, player);
	}
}

export class FlipCommand extends Command<
	CommandRoom,
	{
		sessionId: string;
		componentId: string;
		isFaceUp: boolean;
	}
> {
	execute(payload: this['payload']) {
		const component = this.state.flippable.get(payload.componentId);
		component.isFaceUp = payload.isFaceUp;
	}

	validate(payload: this['payload']) {
		const component = getValidComponent(this.state, payload.componentId, payload.sessionId, false);
		if (!component) return false;
		return this.state.flippable.has(component.id);
	}
}

export class InitCommand extends Command<
	CommandRoom,
	{
		sessionId: string;
	} & InitGamePayload
> {
	execute(payload: this['payload']) {
		for (const stack of payload.stacks) {
			// create deck components
			const deckId = randomUUID();
			const deckComponent = new Component(deckId, '', 'stack');
			const deckPosition = new Positionable(400, 400, true);
			const deckFlip = new Flippable(false);
			const deckStack = new Stack(stack.componentIds);
			const _deck = new Deck(deckComponent, deckPosition, deckFlip, deckStack);

			this.state.positions.set(deckId, deckPosition);
			this.state.flippable.set(deckId, deckFlip);
			this.state.components.set(deckId, deckComponent);
			this.state.stacks.set(deckId, deckStack);

			// create cards
			for (let i = 0; i < stack.componentIds.length; i++) {
				const cardId = stack.componentIds[i];
				const cardComponent = new Component(cardId, '', 'card');
				const cardPosition = new Positionable(10 + i * 220, 50 + i * 320, true);
				const cardFlip = new Flippable(true);
				const _card = new Item(cardComponent, cardPosition, cardFlip);

				this.state.positions.set(cardId, cardPosition);
				this.state.flippable.set(cardId, cardFlip);
				this.state.components.set(cardId, cardComponent);
			}
		}
	}

	validate(_payload: this['payload']) {
		if (this.state.components.size !== 0) {
			console.warn('Game already initialized');
			return false;
		}
		return true;
	}
}

export class MoveCommand extends Command<
	CommandRoom,
	{
		sessionId: string;
		componentId: string;
		x: number;
		y: number;
	}
> {
	execute(payload: this['payload']) {
		const position = this.state.positions.get(payload.componentId);
		position.x = payload.x;
		position.y = payload.y;

		const component = this.state.components.get(payload.componentId);
		component.owner = payload.sessionId;
	}

	validate(payload: this['payload']) {
		const component = getValidComponent(this.state, payload.componentId, payload.sessionId, false);
		return this.state.positions.has(component.id);
	}
}

export class MoveEndCommand extends Command<
	CommandRoom,
	{
		sessionId: string;
		cardId: string;
		x: number;
		y: number;
	}
> {
	execute(payload: this['payload']) {
		const position = this.state.positions.get(payload.cardId);
		position.x = payload.x;
		position.y = payload.y;
		const component = this.state.components.get(payload.cardId);
		component.owner = '';
		console.log(`Card ${payload.cardId} move ended at (${payload.x}, ${payload.y})`);
	}

	validate(payload: this['payload']) {
		const card = getValidComponent(this.state, payload.cardId, payload.sessionId, true);
		if (!card) return false;
		if (card.owner !== payload.sessionId) {
			console.warn(`Card ${payload.cardId} moveend ignored; not owned by player.`);
			return false;
		}
		return true;
	}
}

export class DrawCommand extends Command<
	CommandRoom,
	{
		sessionId: string;
		cardId: string;
	}
> {
	execute(payload: this['payload']) {
		const component = this.state.components.get(payload.cardId);
		const player = this.state.players.get(payload.sessionId);
        let cardId = payload.cardId;
        const stack = this.state.stacks.get(payload.cardId);
        if (stack) {
            const flippable = this.state.flippable.get(payload.cardId);
            console.log("stack and flippable", flippable);
            if (flippable.isFaceUp) {
                cardId = stack.componentIds.splice(0, 1)[0]
            } else {
                cardId = stack.componentIds.splice(stack.componentIds.length - 1, 1)[0];
            }
        }
		player.hand.add(cardId);
		component.owner = payload.sessionId;
		const position = this.state.positions.get(payload.cardId);
		position.visible = false;
	}

	validate(payload: this['payload']) {
		const card = getValidComponent(this.state, payload.cardId, payload.sessionId, false);
		if (!card) return false;

		const player = this.state.players.get(payload.sessionId);
		if (!player) {
			console.error('Player not found:', payload.sessionId);
			return false;
		}
		return true;
	}
}

export class PlayCommand extends Command<
	CommandRoom,
	{
		sessionId: string;
		cardId: string;
		x: number;
		y: number;
	}
> {
	execute(payload: this['payload']) {
		const player = this.state.players.get(payload.sessionId);
		player.hand.delete(payload.cardId);

		const position = this.state.positions.get(payload.cardId);
		position.x = payload.x;
		position.y = payload.y;
		position.visible = true;

		const component = this.state.components.get(payload.cardId);
		component.owner = '';
	}

	validate(payload: this['payload']) {
		const card = getValidComponent(this.state, payload.cardId, payload.sessionId, true);
		if (!card) return false;

		const player = this.state.players.get(payload.sessionId);
		if (!player) {
			console.error('Player not found:', payload.sessionId);
			return false;
		}

		if (!player.hand.has(payload.cardId)) {
			console.warn(`Card ${payload.cardId} is not in player's hand`);
			return false;
		}
		return true;
	}
}
