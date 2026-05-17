import { describe, expect, test } from 'vitest';
import { type SchemaCallbackProxy } from '@colyseus/schema';
import type { Room } from 'colyseus.js';
import {
	BoardGameRoomState,
	Component,
	Positionable
} from 'boardgame-server/src/rooms/schema/MyRoomState';
import { ClientPosition, type SharedClientValues } from './position';

function createClientPosition(initialPosition = new Positionable(0, 0, true)) {
	const callbacks = new Map<object, () => void>();
	const sentMessages: unknown[] = [];
	const component = new Component('card-1', '', 'card');
	const position = initialPosition;
	const s = ((target: object) => ({
		onChange(callback: () => void) {
			callbacks.set(target, callback);
		}
	})) as unknown as SchemaCallbackProxy<BoardGameRoomState>;
	const room = {
		sessionId: 'player-1',
		send(_type: string, message: unknown) {
			sentMessages.push(message);
		}
	} as Room<BoardGameRoomState>;
	const sharedValues: SharedClientValues = {
		component,
		room,
		sessionId: room.sessionId,
		s
	};
	const clientPosition = new ClientPosition(sharedValues, position);

	function applyServerPosition(input: { x: number; y: number; visible?: boolean; owner?: string }) {
		position.x = input.x;
		position.y = input.y;
		position.visible = input.visible ?? position.visible;
		if (input.owner !== undefined) {
			component.owner = input.owner;
		}
		callbacks.get(position)?.();
	}

	return {
		clientPosition,
		component,
		sentMessages,
		applyServerPosition
	};
}

describe('ClientPosition', () => {
	test('keeps predicted local movement when a stale server position arrives', () => {
		const { clientPosition, applyServerPosition } = createClientPosition();

		clientPosition.moveTo(100, 120);
		expect(clientPosition.clientPositionState.x).toBe(100);
		expect(clientPosition.clientPositionState.y).toBe(120);

		applyServerPosition({ x: 40, y: 50, owner: 'player-1' });

		expect(clientPosition.clientPositionState.x).toBe(100);
		expect(clientPosition.clientPositionState.y).toBe(120);
	});

	test('reconciles to the server position after ownership is released', () => {
		const { clientPosition, applyServerPosition } = createClientPosition();

		clientPosition.moveEnd(100, 120);
		applyServerPosition({ x: 94, y: 116, owner: '' });

		expect(clientPosition.clientPositionState.x).toBe(94);
		expect(clientPosition.clientPositionState.y).toBe(116);
	});

	test('interpolates non-predicted server movement through tick', () => {
		const { clientPosition, applyServerPosition } = createClientPosition();

		applyServerPosition({ x: 100, y: 50 });

		expect(clientPosition.clientPositionState.x).toBe(0);
		expect(clientPosition.clientPositionState.y).toBe(0);
		expect(clientPosition.tick()).toBe(true);
		expect(clientPosition.clientPositionState.x).toBeGreaterThan(0);
		expect(clientPosition.clientPositionState.x).toBeLessThan(100);
		expect(clientPosition.clientPositionState.y).toBeGreaterThan(0);
		expect(clientPosition.clientPositionState.y).toBeLessThan(50);
	});

	test('keeps predicted hand placement when server confirms the play position', () => {
		const { clientPosition, sentMessages, applyServerPosition } = createClientPosition(
			new Positionable(10, 20, false)
		);

		clientPosition.predictPosition(320, 240, true);

		expect(sentMessages).toEqual([]);
		expect(clientPosition.clientPositionState.x).toBe(320);
		expect(clientPosition.clientPositionState.y).toBe(240);
		expect(clientPosition.clientPositionState.visible).toBe(true);

		applyServerPosition({ x: 320, y: 240, visible: true, owner: '' });

		expect(clientPosition.clientPositionState.x).toBe(320);
		expect(clientPosition.clientPositionState.y).toBe(240);
		expect(clientPosition.clientPositionState.visible).toBe(true);
	});
});
