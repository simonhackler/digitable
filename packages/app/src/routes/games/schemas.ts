import { z } from 'zod';

const gameName = z
	.string()
	.min(1, 'Game name is required')
	.max(80, 'Game name must be 80 characters or less');

export const navigateToCreateGameSchema = z.object({
	name: gameName
});

export type NavigateToCreateGameSchema = z.infer<typeof navigateToCreateGameSchema>;

export const createGameSchema = z
	.object({
		name: gameName,
		minPlayers: z
			.number()
			.int()
			.min(1, 'Minimum players must be at least 1')
			.max(20, 'Minimum players cannot exceed 20'),
		maxPlayers: z
			.number()
			.int()
			.min(1, 'Maximum players must be at least 1')
			.max(20, 'Maximum players cannot exceed 20'),
		description: z
			.string()
			.min(1, 'Description must be at least 50 characters')
			.max(500, 'Description must be 500 characters or less'),
		tags: z
			.array(z.string())
			.min(1, 'At least one tag is required')
			.max(10, 'Maximum 10 tags allowed')
	})
	.refine((data) => data.minPlayers <= data.maxPlayers, {
		message: 'Minimum players must be less than or equal to maximum players',
		path: ['maxPlayers']
	});

export type CreateGameForm = z.infer<typeof createGameSchema>;
