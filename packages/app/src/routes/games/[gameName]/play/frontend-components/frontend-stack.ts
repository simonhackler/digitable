import type {
	BoardGameRoomState,
	Component,
	Stack
} from 'boardgame-server/src/rooms/schema/MyRoomState';
import { type SchemaCallbackProxy } from '@colyseus/schema';
import { Room } from 'colyseus.js';
import type { BoardGameItem } from '$lib/pixi/item';

export class FrontendStack {
	component: Component;
	room: Room<BoardGameRoomState>;
	sessionId: string;
	stack: Stack;

	constructor(
		room: Room<BoardGameRoomState>,
		component: Component,
		_stacks: BoardGameItem[],
		stack: Stack,
		s: SchemaCallbackProxy<BoardGameRoomState>
	) {
		// This will be the same on every single one of these classes.
		this.room = room;
		this.sessionId = room.sessionId;
		this.component = component;
		this.stack = stack;

		s(stack).componentIds.onRemove((_id, _sessionId) => {
			// For this it feels like I will need to have essentially global state that is passed to these classed. Ugly.
		});
	}
}

interface StackState {
	stacks: BoardGameItem[];
	isFaceUp: boolean;
}

interface Flippable<T> {
	flip(state: T, setFaceUp: boolean): T;
}

interface Drawable<T> {
	draw(state: T): { state: T; drawnItem: BoardGameItem | null };
}

export class StackFlip implements Flippable<StackState> {
	flip(state: StackState, setFaceUp: boolean) {
		const newState = { ...state, isFaceUp: setFaceUp };
		return newState;
	}
}

export class StackDraw implements Drawable<StackState> {
	draw(state: StackState) {
		if (state.stacks.length === 0) {
			throw new Error('Cannot draw from an empty stack');
		}
		const drawIndex = state.isFaceUp ? 0 : state.stacks.length - 1;
		const drawnItem = state.stacks[drawIndex];
		const remaining = state.isFaceUp
			? state.stacks.slice(1) // drop first
			: state.stacks.slice(0, -1);
		return { state: { ...state, stacks: remaining }, drawnItem };
	}
}
