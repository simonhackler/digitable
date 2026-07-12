import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';

import { db } from './client';
import { privateRoomMembers, privateRooms } from './schema';

export type PrivateRoomRole = 'owner' | 'player' | 'spectator';

const PASSWORD_HASH_PREFIX = 'scrypt';
const PASSWORD_KEY_LENGTH = 64;

function normalizePassword(value: string | null | undefined) {
	return value?.trim() ?? '';
}

function hashPassword(password: string) {
	const salt = randomBytes(16).toString('base64url');
	const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('base64url');
	return `${PASSWORD_HASH_PREFIX}$${salt}$${hash}`;
}

function verifyPassword(password: string, passwordHash: string) {
	const [prefix, salt, hash] = passwordHash.split('$');
	if (prefix !== PASSWORD_HASH_PREFIX || !salt || !hash) return false;

	const expected = Buffer.from(hash, 'base64url');
	const actual = scryptSync(password, salt, expected.length);
	if (actual.length !== expected.length) return false;
	return timingSafeEqual(actual, expected);
}

export async function createPrivateRoom(input: {
	ownerUserId: string;
	inviteCode?: string | null;
	password?: string | null;
}) {
	const password = normalizePassword(input.password);
	const [room] = await db
		.insert(privateRooms)
		.values(
			password
				? {
						ownerUserId: input.ownerUserId,
						inviteCode: input.inviteCode ?? null,
						passwordHash: hashPassword(password)
					}
				: {
						ownerUserId: input.ownerUserId,
						inviteCode: input.inviteCode ?? null
					}
		)
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

export async function verifyPrivateRoomPassword(input: {
	privateRoomId: string;
	password: string;
}) {
	const [room] = await db
		.select({ passwordHash: privateRooms.passwordHash })
		.from(privateRooms)
		.where(eq(privateRooms.id, input.privateRoomId))
		.limit(1);

	if (!room?.passwordHash) return true;
	return verifyPassword(normalizePassword(input.password), room.passwordHash);
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
