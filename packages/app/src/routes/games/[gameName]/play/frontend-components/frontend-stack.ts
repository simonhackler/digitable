import type {
	BoardGameRoomState,
	Component,
	Stack
} from 'boardgame-server/src/rooms/schema/MyRoomState';
import { type SchemaCallbackProxy } from '@colyseus/schema';
import { Room } from 'colyseus.js';
import type { BoardGameItem } from '$lib/pixi/item';
import { assert } from '$lib/utils/assert';
import type { Container } from 'pixi.js';

interface StackState {
	readonly serverStack: Stack;
	readonly sessionId: string;
	readonly room: Room<BoardGameRoomState>;
	readonly component: Component;
	items: BoardGameItem[]; // state;
	isFaceUp: boolean; // state;
}

interface Flippable<T> {
	flip(state: T): void;
}

interface Drawable<T> {
	draw(component: Component, state: T): BoardGameItem | null;
}

interface Movable {
	moveTo(component: Component, container: Container, x: number, y: number): void;
	moveEnd(component: Component, container: Container, x: number, y: number): void;
}

export const stackDraw: Drawable<StackState> = {
	draw(component: Component, state: StackState) {
		if (component.owner !== state.sessionId && component.owner !== '') {
			console.warn(`Component ${component.id} is currently owned by another player.`);
			return null;
		}
		assert(state.serverStack.componentIds.length !== 0, 'Cannot draw from an empty stack');
		assert(
			state.items.length === state.serverStack.componentIds.length,
			`Mismatch between stack component IDs and items length for component ${component.id}, frontend: ${state.items.length}, backend: ${state.serverStack.componentIds.length}`
		);
		assert(
			state.items[state.items.length - 1].id ===
				state.serverStack.componentIds[state.serverStack.componentIds.length - 1],
			`Top item ID does not match stack top component ID for component ${component.id}, item ID: ${state.items[state.items.length - 1].id}, stack top ID: ${state.serverStack.componentIds[state.serverStack.componentIds.length - 1]}`
		);
		state.room.send('cmd', {
			commandType: 'draw',
			payload: {
				componentId: component.id
			}
		});
		return state.items.pop()!;
	}
};

export const stackFlip: Flippable<StackState> = {
	flip(state: StackState) {
		console.log('Flipping stack not implemented yet.' + state);
	}
};

export const move: Movable = {
	moveTo(component: Component, container: Container, x: number, y: number) {
		if (component.owner !== state.sessionId && component.owner !== '') {
			console.warn(`Component ${component.id} is currently owned by another player.`);
			return;
		}
		state.room.send('cmd', {
			commandType: 'move',
			payload: {
				componentId: component.id,
				x,
				y
			}
		});
	},
	moveEnd(component: Component, container: Container, x: number, y: number) {
		state.room.send('cmd', {
			commandType: 'moveend',
			payload: {
				cardId: component.id,
				x,
				y
			}
		});
	}
};

export interface Behaviours {
	drawable: Drawable | null;
	flippable: Flippable | null;
	movable: Movable | null;
}

export abstract class ClientComponent<ClientState, ServerState> {
	public readonly component: Component;
	readonly room: Room<BoardGameRoomState>;
	readonly sessionId: string;
	readonly behaviours: Behaviours<ClientState>;
	abstract state: ClientState;

	constructor(
		component: Component,
		room: Room<BoardGameRoomState>,
		sessionId: string,
		behaviours: Behaviours<ClientState>,
		s: SchemaCallbackProxy<BoardGameRoomState>,
		serverComponent: ServerState
	) {
		this.component = component;
		this.room = room;
		this.sessionId = sessionId;
		this.behaviours = behaviours;
		this.initServer(s, serverComponent);
	}

	abstract initServer(
		s: SchemaCallbackProxy<BoardGameRoomState>,
		serverComponent: ServerState
	): void;
}

export class AbsClientStack extends ClientComponent<StackState, Stack> {
	state: StackState;

	constructor(
		component: Component,
		room: Room<BoardGameRoomState>,
		sessionId: string,
		s: SchemaCallbackProxy<BoardGameRoomState>,
		serverStack: Stack,
		state: StackState
	) {
		const behaviours: Behaviours = {
			drawable: stackDraw,
			flippable: stackFlip,
			movable: move
		};
		super(component, room, sessionId, behaviours, s, serverStack);
		this.state = state;
	}

	initServer(_s: SchemaCallbackProxy<BoardGameRoomState>, _serverComponent: Stack): void {
		throw new Error('Method not implemented.');
	}
}

export interface CardState {
	readonly sessionId: string;
	readonly frontContainer: Container;
	readonly backContainer: Container;
	isFaceUp: boolean; // State
}

export class ClientCard extends ClientComponent<CardState, Stack> {
	state: CardState;

	constructor(
		component: Component,
		room: Room<BoardGameRoomState>,
		sessionId: string,
		s: SchemaCallbackProxy<BoardGameRoomState>,
		serverStack: Stack,
		state: CardState
	) {
		const behaviours: Behaviours = {
			drawable: stackDraw,
			flippable: stackFlip,
			movable: move
		};
		super(component, room, sessionId, behaviours, s, serverStack);
		this.state = state;
	}

	initServer(_s: SchemaCallbackProxy<BoardGameRoomState>, _serverComponent: Stack): void {
		console.log('init');
	}
}

// The structure doesn't make much sense.
// I want different components. Cards, Decks, Tokens
// For movement have something like the containers in pixi that allow moving something onto something else
// It should be able to specify what can be moved on top. E.g tokens cards decks etc
// It should be specifiable if something can be moved on top of something else
// I want the different components to have different behaviours. E.g a player hand is a component, that has to be synced and displayed.
// Cards, Decks, Tokens have different behaviours. Cards can be drawn and moved and flipped. Tokens can be moved and flipped
// The logic for flipping is the same for tokens and cards. They might display a different animation
// Tokens can be put into stacks of the same token type. Cards can be put into stacks of the same card type(Decks). Stacks of tokens/tiles can be flipped.
// The logic might be the same but animations might be different. Taking a token works the same for both.
