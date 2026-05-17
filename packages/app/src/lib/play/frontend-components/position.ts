import {
	type BoardGameRoomState,
	Positionable,
	type Component,
	Flippable,
	Stack
} from 'boardgame-server/src/rooms/schema/MyRoomState';
import { type SchemaCallbackProxy } from '@colyseus/schema';
import type { Room } from 'colyseus.js';

type Handler<T> = (payload: T) => void;

const POSITION_EPSILON = 0.001;
const POSITION_INTERPOLATION = 0.2;

type PositionSnapshot = {
	x: number;
	y: number;
	visible: boolean;
};

type PendingPrediction = {
	x: number;
	y: number;
	visible: boolean;
	reconcileOnRelease: boolean;
};

function arraysEqual<T>(a: ArrayLike<T>, b: ArrayLike<T>): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

function samePoint(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
	return Math.abs(a.x - b.x) <= POSITION_EPSILON && Math.abs(a.y - b.y) <= POSITION_EPSILON;
}

function samePosition(a: PositionSnapshot, b: PositionSnapshot): boolean {
	return samePoint(a, b) && a.visible === b.visible;
}

function lerp(start: number, end: number, amount: number): number {
	return start + (end - start) * amount;
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
	clientPositionState: Positionable;
	onPositionChanged: Event<Positionable> = new Event();
	private serverPositionState: PositionSnapshot;
	private pendingPrediction: PendingPrediction | null = null;

	constructor(sharedValues: SharedClientValues, position: Positionable) {
		this.sharedValues = sharedValues;
		this.clientPositionState = new Positionable(position.x, position.y, position.visible);
		this.serverPositionState = { x: position.x, y: position.y, visible: position.visible };

		sharedValues.s(position).onChange(() => {
			this.serverPositionState = {
				x: position.x,
				y: position.y,
				visible: position.visible
			};
			this.handleServerPositionChanged();
		});
	}

	private applyClientPosition(next: PositionSnapshot): boolean {
		if (samePosition(this.clientPositionState, next)) {
			return false;
		}
		this.clientPositionState.x = next.x;
		this.clientPositionState.y = next.y;
		this.clientPositionState.visible = next.visible;
		this.onPositionChanged.emit(this.clientPositionState);
		return true;
	}

	private handleServerPositionChanged() {
		if (!this.pendingPrediction) {
			if (this.clientPositionState.visible !== this.serverPositionState.visible) {
				this.applyClientPosition({
					x: this.clientPositionState.x,
					y: this.clientPositionState.y,
					visible: this.serverPositionState.visible
				});
			}
			return;
		}

		if (samePosition(this.pendingPrediction, this.serverPositionState)) {
			this.pendingPrediction = null;
			this.applyClientPosition(this.serverPositionState);
			return;
		}

		const owner = this.sharedValues.component.owner;
		const ownedByAnotherPlayer = owner !== '' && owner !== this.sharedValues.sessionId;
		const releasedAfterMoveEnd = this.pendingPrediction.reconcileOnRelease && owner === '';

		if (ownedByAnotherPlayer || releasedAfterMoveEnd) {
			this.pendingPrediction = null;
			this.applyClientPosition(this.serverPositionState);
		}
	}

	tick(): boolean {
		if (this.pendingPrediction) {
			return false;
		}
		if (samePoint(this.clientPositionState, this.serverPositionState)) {
			return false;
		}

		const next = {
			x: lerp(this.clientPositionState.x, this.serverPositionState.x, POSITION_INTERPOLATION),
			y: lerp(this.clientPositionState.y, this.serverPositionState.y, POSITION_INTERPOLATION),
			visible: this.serverPositionState.visible
		};
		if (samePoint(next, this.serverPositionState)) {
			next.x = this.serverPositionState.x;
			next.y = this.serverPositionState.y;
		}
		return this.applyClientPosition(next);
	}

	// IDEA: Refactor these functions into the commands itself. A command should then handle execution on the server and the client
	// Or I will need a frontend command or something like that?
	// I somehow want to tightly couple server and frontend commands
	// How will the commands then have to look like?
	moveTo(x: number, y: number) {
		if (
			this.sharedValues.component.owner !== this.sharedValues.sessionId &&
			this.sharedValues.component.owner !== ''
		) {
			console.warn(
				`Component ${this.sharedValues.component.id} is currently owned by another player.`
			);
			return;
		}
		this.pendingPrediction = {
			x,
			y,
			visible: this.clientPositionState.visible,
			reconcileOnRelease: false
		};
		this.applyClientPosition({ x, y, visible: this.clientPositionState.visible });

		this.sharedValues.room.send('cmd', {
			commandType: 'move',
			payload: {
				componentId: this.sharedValues.component.id,
				x,
				y
			}
		});
	}

	moveEnd(x: number, y: number) {
		this.pendingPrediction = {
			x,
			y,
			visible: this.clientPositionState.visible,
			reconcileOnRelease: true
		};
		this.applyClientPosition({ x, y, visible: this.clientPositionState.visible });
		this.sharedValues.room.send('cmd', {
			commandType: 'moveend',
			payload: {
				cardId: this.sharedValues.component.id,
				x,
				y
			}
		});
	}

	predictPosition(x: number, y: number, visible: boolean) {
		this.pendingPrediction = { x, y, visible, reconcileOnRelease: true };
		this.applyClientPosition({ x, y, visible });
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
