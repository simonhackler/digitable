import { Client, Room } from 'colyseus.js';
import { cli, Options } from '@colyseus/loadtest';

export async function main(options: Options) {
	const client = new Client(options.endpoint);
	const room: Room = await client.joinOrCreate(options.roomName, {
		// your join options here...
	});

	console.log('joined successfully!');

	room.onMessage('message-type', (_payload) => {
		// logic
	});

	room.onStateChange((state) => {
		console.log('state change:', state);
	});

	room.onLeave((_code) => {
		console.log('left');
	});
}

cli(main);
