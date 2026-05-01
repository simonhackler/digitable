import { index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const privateRooms = pgTable('private_room', {
	id: uuid('id').primaryKey().defaultRandom(),
	ownerUserId: text('owner_user_id').notNull(),
	inviteCode: text('invite_code').unique(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const privateRoomMembers = pgTable(
	'private_room_member',
	{
		privateRoomId: uuid('private_room_id')
			.notNull()
			.references(() => privateRooms.id, { onDelete: 'cascade' }),
		userId: text('user_id').notNull(),
		role: text('role').notNull().default('player'),
		status: text('status').notNull().default('active'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => ({
		pk: primaryKey({ columns: [table.privateRoomId, table.userId] }),
		userIdx: index('private_room_member_user_idx').on(table.userId)
	})
);

export const gameTickets = pgTable(
	'game_ticket',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tokenHash: text('token_hash').notNull().unique(),
		userId: text('user_id').notNull(),
		privateRoomId: uuid('private_room_id')
			.notNull()
			.references(() => privateRooms.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		usedAt: timestamp('used_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => ({
		tokenHashIdx: index('game_ticket_token_hash_idx').on(table.tokenHash),
		roomUserIdx: index('game_ticket_room_user_idx').on(table.privateRoomId, table.userId)
	})
);
