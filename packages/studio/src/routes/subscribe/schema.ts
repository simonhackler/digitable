import { z } from 'zod/v4';

export const subscribeSchema = z.object({
	email: z.email(),
	firstName: z.string().max(50).optional(),
	company: z.string().optional()
});

export type SubscribeSchema = typeof subscribeSchema;
