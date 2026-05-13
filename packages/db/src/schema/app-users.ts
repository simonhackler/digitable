import { text, integer, pgTable } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const appUser = pgTable('app_user', {
	id: integer('id').primaryKey(),
	authId: text('auth_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

export const policyVersions;

export const consentTracking;
