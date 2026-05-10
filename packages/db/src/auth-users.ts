import { eq } from 'drizzle-orm';

import { db } from './client';
import { user } from './schema';

export async function userExistsByEmail(email: string) {
	const [existingUser] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, email))
		.limit(1);
	return Boolean(existingUser);
}
