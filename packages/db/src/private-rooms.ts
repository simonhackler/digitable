import { and, eq } from 'drizzle-orm';

import { db } from './client';
import { privateRoomMembers, privateRooms } from './schema';

export type PrivateRoomRole = 'owner' | 'player' | 'spectator';

export async function createPrivateRoom(input: {
	ownerUserId: string;
	inviteCode?: string | null;
}) {
	const [room] = await db
		.insert(privateRooms)
		.values({
			ownerUserId: input.ownerUserId,
			inviteCode: input.inviteCode ?? null
		})
		.returning();

	if (!room) {
		throw new Error('Could not create private room');
	}

	await db.insert(privateRoomMembers).values({
		privateRoomId: room.id,
		userId: input.ownerUserId,
		role: 'owner',
		status: 'active'
	});

	return room;
}

export async function addPrivateRoomMember(input: {
	privateRoomId: string;
	userId: string;
	role?: PrivateRoomRole;
}) {
	await db.insert(privateRoomMembers).values({
		privateRoomId: input.privateRoomId,
		userId: input.userId,
		role: input.role ?? 'player',
		status: 'active'
	});
}

export async function getPrivateRoomByInviteCode(inviteCode: string) {
	const [room] = await db
		.select()
		.from(privateRooms)
		.where(eq(privateRooms.inviteCode, inviteCode))
		.limit(1);

	return room ?? null;
}

export async function getActiveMembership(input: { privateRoomId: string; userId: string }) {
	const [membership] = await db
		.select()
		.from(privateRoomMembers)
		.where(
			and(
				eq(privateRoomMembers.privateRoomId, input.privateRoomId),
				eq(privateRoomMembers.userId, input.userId),
				eq(privateRoomMembers.status, 'active')
			)
		)
		.limit(1);

	return membership ?? null;
}
