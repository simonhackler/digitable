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

const POSITION_EPSILON = 0.001;
const POSITION_INTERPOLATION = 0.2;

export type ClientPlacement = {
	x: number;
	y: number;
	rotation: number;
	parentId: string;
	visible?: boolean;
};

type PositionSnapshot = {
	x: number;
	y: number;
	rotation: number;
	parentId: string;
	visible: boolean;
};

type PendingPrediction = PositionSnapshot & {
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
	return (
		samePoint(a, b) &&
		Math.abs(a.rotation - b.rotation) <= POSITION_EPSILON &&
		a.parentId === b.parentId &&
		a.visible === b.visible
	);
}

function lerp(start: number, end: number, amount: number): number {
	return start + (end - start) * amount;
}

function cloneLayoutNode(position: LayoutNode): LayoutNode {
	const clone = new LayoutNode(position.id, position.kind, position.x, position.y, position.visible);
	clone.parentId = position.parentId;
	clone.componentId = position.componentId;
	clone.width = position.width;
	clone.height = position.height;
	clone.rotation = position.rotation;
	clone.locked = position.locked;
	clone.layout = position.layout;
	return clone;
}

function positionSnapshot(position: LayoutNode): PositionSnapshot {
	return {
		x: position.x,
		y: position.y,
		rotation: position.rotation,
		parentId: position.parentId,
		visible: position.visible
	};
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
	private serverPositionState: LayoutNode;
	private pendingPrediction: PendingPrediction | null = null;

	constructor(sharedValues: SharedClientValues, position: LayoutNode) {
		this.sharedValues = sharedValues;
		this.clientPositionState = cloneLayoutNode(position);
		this.serverPositionState = position;

		sharedValues.s(position).onChange(() => {
			this.handleServerPositionChanged();
		});
		sharedValues.s(sharedValues.component).onChange(() => {
			this.handleServerPositionChanged();
		});
	}

	private placementSnapshot(placement: ClientPlacement): PositionSnapshot {
		return {
			x: placement.x,
			y: placement.y,
			rotation: placement.rotation,
			parentId: placement.parentId,
			visible: placement.visible ?? this.clientPositionState.visible
		};
	}

	private applyClientPosition(next: PositionSnapshot): boolean {
		const current = positionSnapshot(this.clientPositionState);
		if (samePosition(current, next)) {
			return false;
		}
		this.clientPositionState.x = next.x;
		this.clientPositionState.y = next.y;
		this.clientPositionState.rotation = next.rotation;
		this.clientPositionState.parentId = next.parentId;
		this.clientPositionState.visible = next.visible;
		this.onPositionChanged.emit(this.clientPositionState);
		return true;
	}

	private handleServerPositionChanged() {
		const serverPosition = positionSnapshot(this.serverPositionState);
		if (!this.pendingPrediction) {
			if (samePoint(this.clientPositionState, serverPosition)) {
				this.applyClientPosition(serverPosition);
			} else {
				this.applyClientPosition({
					...serverPosition,
					x: this.clientPositionState.x,
					y: this.clientPositionState.y
				});
			}
			return;
		}

		if (samePosition(this.pendingPrediction, serverPosition)) {
			this.pendingPrediction = null;
			this.applyClientPosition(serverPosition);
			return;
		}

		const owner = this.sharedValues.component.owner;
		const ownedByAnotherPlayer = owner !== '' && owner !== this.sharedValues.sessionId;
		const releasedAfterMoveEnd = this.pendingPrediction.reconcileOnRelease && owner === '';

		if (ownedByAnotherPlayer || releasedAfterMoveEnd) {
			this.pendingPrediction = null;
			this.applyClientPosition(serverPosition);
		}
	}

	tick(): boolean {
		if (this.pendingPrediction) {
			return false;
		}
		const serverPosition = positionSnapshot(this.serverPositionState);
		if (samePoint(this.clientPositionState, serverPosition)) {
			return false;
		}

		const next = {
			...serverPosition,
			x: lerp(this.clientPositionState.x, serverPosition.x, POSITION_INTERPOLATION),
			y: lerp(this.clientPositionState.y, serverPosition.y, POSITION_INTERPOLATION)
		};
		if (samePoint(next, serverPosition)) {
			next.x = serverPosition.x;
			next.y = serverPosition.y;
		}
		return this.applyClientPosition(next);
	}

	// IDEA: Refactor these functions into the commands itself. A command should then handle execution on the server and the client
	// Or I will need a frontend command or something like that?
	// I somehow want to tightly couple server and frontend commands
	// How will the commands then have to look like?
	applyLocalPlacement(placement: ClientPlacement) {
		return this.applyClientPosition(this.placementSnapshot(placement));
	}

	moveTo(placement: ClientPlacement) {
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
			...this.placementSnapshot(placement),
			reconcileOnRelease: false
		};
		this.applyClientPosition(this.pendingPrediction);

		this.sharedValues.room.send('cmd', {
			commandType: 'move',
			payload: {
				componentId: this.sharedValues.component.id,
				x: placement.x,
				y: placement.y,
				rotation: placement.rotation,
				targetNodeId: placement.parentId
			}
		});
	}

	moveEnd(placement: ClientPlacement) {
		this.pendingPrediction = {
			...this.placementSnapshot(placement),
			reconcileOnRelease: true
		};
		this.applyClientPosition(this.pendingPrediction);
		this.sharedValues.room.send('cmd', {
			commandType: 'moveend',
			payload: {
				cardId: this.sharedValues.component.id,
				x: placement.x,
				y: placement.y,
				rotation: placement.rotation,
				targetNodeId: placement.parentId
			}
		});
	}

	predictPlacement(placement: ClientPlacement) {
		this.pendingPrediction = {
			...this.placementSnapshot(placement),
			reconcileOnRelease: true
		};
		this.applyClientPosition(this.pendingPrediction);
	}

	predictPosition(x: number, y: number, visible: boolean) {
		this.predictPlacement({
			x,
			y,
			rotation: this.clientPositionState.rotation,
			parentId: this.clientPositionState.parentId,
			visible
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
