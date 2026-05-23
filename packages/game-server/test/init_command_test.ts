import assert from 'assert';
import { InitCommand } from '../src/rooms/command-room';
import { BoardGameRoomState } from '../src/rooms/schema/MyRoomState';

describe('InitCommand', () => {
	it('initializes explicit setup items at their saved positions', () => {
		const command = new InitCommand();
		command.state = new BoardGameRoomState();

		const payload = {
			sessionId: 'player-1',
			setupItems: [
				{
					id: 'deck-placement',
					type: 'stack' as const,
					componentIds: ['card-1', 'card-2'],
					x: 100,
					y: 80
				},
				{
					id: 'card-3',
					type: 'card' as const,
					componentIds: ['card-3'],
					x: 500,
					y: 650
				}
			]
		};

		assert.strictEqual(command.validate?.(payload), true);
		command.execute(payload);

		assert.strictEqual(command.state.components.get('deck-placement')?.type, 'stack');
		assert.deepStrictEqual(Array.from(command.state.stacks.get('deck-placement')!.componentIds), [
			'card-1',
			'card-2'
		]);
		assert.deepStrictEqual(command.state.positions.get('deck-placement')?.toJSON(), {
			x: 100,
			y: 80,
			visible: true
		});
		assert.deepStrictEqual(command.state.positions.get('card-1')?.toJSON(), {
			x: 100,
			y: 80,
			visible: false
		});
		assert.deepStrictEqual(command.state.positions.get('card-3')?.toJSON(), {
			x: 500,
			y: 650,
			visible: true
		});
	});
});
