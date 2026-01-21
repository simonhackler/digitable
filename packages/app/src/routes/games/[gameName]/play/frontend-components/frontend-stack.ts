import type {
	BoardGameRoomState,
	Component,
	Stack
} from 'boardgame-server/src/rooms/schema/MyRoomState';
import { type SchemaCallbackProxy } from '@colyseus/schema';
import { Room } from 'colyseus.js';
import type { BoardGameItem } from '$lib/pixi/item';
import { assert } from '$lib/utils/assert';

interface StackState {
	readonly serverStack: Stack;
	readonly sessionId: string;
	readonly room: Room<BoardGameRoomState>;
	readonly component: Component;
	items: BoardGameItem[];
	isFaceUp: boolean;
}

interface Flippable<T> {
	flip(state: T): void;
}

interface Drawable<T> {
	draw(component: Component, state: T): BoardGameItem | null;
}

export class StackDraw implements Drawable<StackState> {
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
}

export class StackFlip implements Flippable<StackState> {
	flip(state: StackState) {
		console.log('Flipping stack not implemented yet.' + state);
	}
}

export interface Behaviours<T> {
	drawable: Drawable<T> | null;
	flippable: Flippable<T> | null;
}

export abstract class ClientComponent<ClientState, ServerState> {
	readonly room: Room<BoardGameRoomState>;
	readonly sessionId: string;
	readonly component: Component;
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
		const behaviours: Behaviours<StackState> = {
			drawable: new StackDraw(),
			flippable: new StackFlip()
		};
		super(component, room, sessionId, behaviours, s, serverStack);
		this.state = state;
	}

	initServer(_s: SchemaCallbackProxy<BoardGameRoomState>, _serverComponent: Stack): void {
		throw new Error('Method not implemented.');
	}
}
