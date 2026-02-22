import type {
	BoardGameRoomState,
	Component,
	Stack
} from 'boardgame-server/src/rooms/schema/MyRoomState';
import { Room } from 'colyseus.js';
import type { BoardGameItemNew } from '$lib/pixi/item';
import { assert } from '$lib/utils/assert';

interface StackState {
	readonly serverStack: Stack;
	readonly sessionId: string;
	readonly room: Room<BoardGameRoomState>;
	readonly component: Component;
	items: BoardGameItemNew[]; // state;
	isFaceUp: boolean; // state;
}

// Drawable is a client site "nicety" for moving something onto the server
interface Drawable<T> {
	draw(component: Component, state: T): BoardGameItemNew | null;
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
