import { error, json } from '@sveltejs/kit';
import { createPrivateRoom } from '@svg-table/db/private-rooms';

export async function POST({ locals }) {
	if (!locals.user) {
		error(401, 'Not authenticated');
	}

	const room = await createPrivateRoom({
		ownerUserId: locals.user.id
	});

	return json({
		privateRoomId: room.id
	});
}
