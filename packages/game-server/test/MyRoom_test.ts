import assert from 'assert';
import { ColyseusTestServer, boot } from '@colyseus/testing';

import appConfig from '../src/app.config';
import { BoardGameRoomState } from '../src/rooms/schema/MyRoomState';

describe('testing your Colyseus app', () => {
	let colyseus: ColyseusTestServer;

	before(async () => (colyseus = await boot(appConfig)));
	after(async () => colyseus.shutdown());

	beforeEach(async () => await colyseus.cleanup());

	it('connecting into a room', async () => {
		const room = await colyseus.createRoom<BoardGameRoomState>('my_room', {});
		const client1 = await colyseus.connectTo(room);

		assert.strictEqual(client1.sessionId, room.clients[0].sessionId);

		await room.waitForNextPatch();

		assert.deepStrictEqual(client1.state.toJSON(), {
			components: {},
			positions: {},
			flippable: {},
			stacks: {},
			players: {
				[client1.sessionId]: {
					id: client1.sessionId,
					hand: []
				}
			},
			strokes: {}
		});
	});
});
