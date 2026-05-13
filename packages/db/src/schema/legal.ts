import { relations, sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { user } from './auth';

export const policyVersion = pgTable(
	'policy_version',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		policyType: text('policy_type', {
			enum: ['terms', 'privacy_policy']
		}).notNull(),
		version: text('version').notNull(),
		contentSha256: text('content_sha256').notNull(),
		content: text('content').notNull(),
		publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow().notNull(),
		effectiveAt: timestamp('effective_at', { withTimezone: true }).defaultNow().notNull(),
		isCurrent: boolean('is_current').default(false).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		uniqueIndex('policy_version_type_version_idx').on(table.policyType, table.version),
		uniqueIndex('policy_version_type_hash_idx').on(table.policyType, table.contentSha256),
		uniqueIndex('policy_version_current_type_idx')
			.on(table.policyType)
			.where(sql`${table.isCurrent}`),
		index('policy_version_current_idx').on(table.policyType, table.isCurrent)
	]
);

export const userPolicyAcceptance = pgTable(
	'user_policy_acceptance',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		policyVersionId: text('policy_version_id')
			.notNull()
			.references(() => policyVersion.id, { onDelete: 'restrict' }),
		action: text('action', {
			enum: ['accepted', 'acknowledged']
		}).notNull(),
		acceptedAt: timestamp('accepted_at', { withTimezone: true }).defaultNow().notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		uniqueIndex('user_policy_acceptance_user_policy_idx').on(table.userId, table.policyVersionId),
		index('user_policy_acceptance_user_idx').on(table.userId)
	]
);

export const policyVersionRelations = relations(policyVersion, ({ many }) => ({
	acceptances: many(userPolicyAcceptance)
}));

export const userPolicyAcceptanceRelations = relations(userPolicyAcceptance, ({ one }) => ({
	user: one(user, {
		fields: [userPolicyAcceptance.userId],
		references: [user.id]
	}),
	policyVersion: one(policyVersion, {
		fields: [userPolicyAcceptance.policyVersionId],
		references: [policyVersion.id]
	})
}));
