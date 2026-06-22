import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';

import { db } from './client';
import { getActiveMembership } from './private-rooms';
import { gameTickets, user } from './schema';

function hashToken(token: string) {
	return createHash('sha256').update(token).digest('hex');
}

export async function createGameTicket(input: {
	userId: string;
	privateRoomId: string;
	ttlSeconds?: number;
}) {
	const membership = await getActiveMembership({
		userId: input.userId,
		privateRoomId: input.privateRoomId
	});

	if (!membership) {
		return null;
	}

	const token = `gt_${randomBytes(32).toString('base64url')}`;
	const expiresAt = new Date(Date.now() + (input.ttlSeconds ?? 60) * 1000);

	await db.insert(gameTickets).values({
		tokenHash: hashToken(token),
		userId: input.userId,
		privateRoomId: input.privateRoomId,
		expiresAt
	});

	return token;
}

export async function verifyAndConsumeGameTicket(input: {
	token: string;
	expectedPrivateRoomId: string;
}) {
	const now = new Date();
	const [ticket] = await db
		.update(gameTickets)
		.set({ usedAt: now })
		.where(
			and(
				eq(gameTickets.tokenHash, hashToken(input.token)),
				eq(gameTickets.privateRoomId, input.expectedPrivateRoomId),
				gt(gameTickets.expiresAt, now),
				isNull(gameTickets.usedAt)
			)
		)
		.returning({
			userId: gameTickets.userId,
			privateRoomId: gameTickets.privateRoomId
		});

	if (!ticket) {
		return null;
	}

	const membership = await getActiveMembership({
		userId: ticket.userId,
		privateRoomId: ticket.privateRoomId
	});

	if (!membership) {
		return null;
	}

	const [ticketUser] = await db
		.select({ name: user.name })
		.from(user)
		.where(eq(user.id, ticket.userId))
		.limit(1);

	if (!ticketUser) {
		return null;
	}

	return {
		userId: ticket.userId,
		privateRoomId: ticket.privateRoomId,
		role: membership.role,
		name: ticketUser.name
	};
}
