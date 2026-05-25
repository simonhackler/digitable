import {
	type BoardGameRoomState,
	LayoutNode,
	type Component,
	Flippable,
	Stack
} from 'boardgame-server/src/rooms/schema/MyRoomState';
import { type SchemaCallbackProxy } from '@colyseus/schema';
import type { Room } from 'colyseus.js';

type Handler<T> = (payload: T) => void;

function arraysEqual<T>(a: ArrayLike<T>, b: ArrayLike<T>): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

export class Event<T> {
	private handlers = new Set<Handler<T>>();

	subscribe(handler: Handler<T>): () => void {
		this.handlers.add(handler);
		return () => this.handlers.delete(handler);
	}

	emit(payload: T): void {
		for (const h of this.handlers) h(payload);
	}

	clear(): void {
		this.handlers.clear();
	}
}

export interface SharedClientValues {
	component: Component;
	room: Room<BoardGameRoomState>;
	sessionId: string;
	s: SchemaCallbackProxy<BoardGameRoomState>;
}

// Is this the correct way?
// I am still not sure. I can't rely on the backend state only.
export class ClientPosition {
	sharedValues: SharedClientValues;
	clientPositionState: LayoutNode;
	onPositionChanged: Event<LayoutNode> = new Event();

	constructor(sharedValues: SharedClientValues, position: LayoutNode) {
		this.sharedValues = sharedValues;
		this.clientPositionState = new LayoutNode(
			position.id,
			position.kind,
			position.x,
			position.y,
			position.visible
		);

		sharedValues.s(position).onChange(() => {
			console.log('position changed', position.x, position.y);
			this.clientPositionState.x = position.x;
			this.clientPositionState.y = position.y;
			this.clientPositionState.visible = position.visible;
			this.onPositionChanged.emit(position);
		});
	}
	// IDEA: Refactor these functions into the commands itself. A command should then handle execution on the server and the client
	// Or I will need a frontend command or something like that?
	// I somehow want to tightly couple server and frontend commands
	// How will the commands then have to look like?
	moveTo(x: number, y: number, targetNodeId?: string) {
		if (
			this.sharedValues.component.owner !== this.sharedValues.sessionId &&
			this.sharedValues.component.owner !== ''
		) {
			console.warn(
				`Component ${this.sharedValues.component.id} is currently owned by another player.`
			);
			return;
		}
		this.clientPositionState.x = x;
		this.clientPositionState.y = y;
		this.onPositionChanged.emit(this.clientPositionState);
		console.log(this.sharedValues.component.owner);

		this.sharedValues.room.send('cmd', {
			commandType: 'move',
			payload: {
				componentId: this.sharedValues.component.id,
				x,
				y,
				targetNodeId
			}
		});
	}

	moveEnd(x: number, y: number, targetNodeId?: string) {
		this.clientPositionState.x = x;
		this.clientPositionState.y = y;
		this.onPositionChanged.emit(this.clientPositionState);
		this.sharedValues.room.send('cmd', {
			commandType: 'moveend',
			payload: {
				cardId: this.sharedValues.component.id,
				x,
				y,
				targetNodeId
			}
		});
	}
}

export class ClientFlippable {
	sharedValues: SharedClientValues;
	clientFlippableState: Flippable;
	onFlipped: Event<Flippable> = new Event();

	constructor(sharedValues: SharedClientValues, flippable: Flippable) {
		this.sharedValues = sharedValues;
		this.clientFlippableState = new Flippable(flippable.isFaceUp);

		console.log(`Initial flippable state: ${flippable.isFaceUp}`);
		sharedValues.s(flippable).onChange(() => {
			if (this.clientFlippableState.isFaceUp != flippable.isFaceUp) {
				this.clientFlippableState.isFaceUp = flippable.isFaceUp;
				this.onFlipped.emit(flippable);
			}
		});
	}
	// IDEA: Refactor these functions into the commands itself. A command should then handle execution on the server and the client
	// Or I will need a frontend command or something like that?
	// I somehow want to tightly couple server and frontend commands
	// How will the commands then have to look like?
	flip() {
		if (
			this.sharedValues.component.owner !== this.sharedValues.sessionId &&
			this.sharedValues.component.owner !== ''
		) {
			console.warn(
				`Component ${this.sharedValues.component.id} is currently owned by another player.`
			);
			return;
		}
		this.clientFlippableState.isFaceUp = !this.clientFlippableState.isFaceUp;
		this.onFlipped.emit(this.clientFlippableState);
		this.sharedValues.room.send('cmd', {
			commandType: 'flip',
			payload: {
				componentId: this.sharedValues.component.id,
				isFaceUp: this.clientFlippableState.isFaceUp
			}
		});
	}
}

// How to handle draw is still a big question here, is this something that is on the card or the stack since it is basically a draw into a move
// or something like that.
export class ClientStack {
	sharedValues: SharedClientValues;
	clientStackState: Stack;
	onAdded: Event<{ id: string; index: number }> = new Event();
	onRemoved: Event<string> = new Event();
	onReordered: Event<string[]> = new Event();

	constructor(sharedValues: SharedClientValues, stack: Stack) {
		this.sharedValues = sharedValues;
		this.clientStackState = new Stack([...stack.componentIds]);

		sharedValues.s(stack.componentIds).onAdd((item, index) => {
			const next = [...this.clientStackState.componentIds];
			const existingIndex = next.indexOf(item);
			if (existingIndex === index) return;
			if (existingIndex !== -1) {
				next.splice(existingIndex, 1);
			}
			next.splice(index, 0, item);
			this.clientStackState.componentIds.length = 0;
			this.clientStackState.componentIds.push(...next);
			this.onAdded.emit({ id: item, index });
		});

		sharedValues.s(stack.componentIds).onRemove((item, index) => {
			const next = [...this.clientStackState.componentIds];
			let removed = next.splice(index, 1)[0];
			if (removed !== item) {
				const fallbackIndex = next.indexOf(item);
				if (fallbackIndex === -1) return;
				removed = next.splice(fallbackIndex, 1)[0];
			}
			this.clientStackState.componentIds.length = 0;
			this.clientStackState.componentIds.push(...next);
			this.onRemoved.emit(removed);
		});

		sharedValues.s(stack.componentIds).onChange(() => {
			const next = [...stack.componentIds];
			if (arraysEqual(this.clientStackState.componentIds, next)) {
				return;
			}
			this.clientStackState.componentIds.length = 0;
			this.clientStackState.componentIds.push(...next);
			this.onReordered.emit(next);
		});
	}

	shuffle() {
		this.sharedValues.room.send('cmd', {
			commandType: 'shuffle',
			payload: {
				stackId: this.sharedValues.component.id
			}
		});
	}
}
