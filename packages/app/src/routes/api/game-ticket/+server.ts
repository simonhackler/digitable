import { error, json } from '@sveltejs/kit';
import { createGameTicket } from '@svg-table/db/tickets';

export async function POST({ locals, request }) {
	if (!locals.user) {
		error(401, 'Not authenticated');
	}

	const body = await request.json();
	const privateRoomId = body.privateRoomId;

	if (typeof privateRoomId !== 'string') {
		error(400, 'Missing privateRoomId');
	}

	const ticket = await createGameTicket({
		userId: locals.user.id,
		privateRoomId,
		ttlSeconds: 60
	});

	if (!ticket) {
		error(403, 'Not a member of this private room');
	}

	return json({ ticket });
}
