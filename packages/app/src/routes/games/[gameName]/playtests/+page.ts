import { member, optional } from '$lib/collaboration/dependencies';
import type { PageLoad } from './$types';

export const load = (() => ({
	projectNeeds: {
		registry: optional(member('feedback-registry', 'feedback/playtests.json'))
	}
})) satisfies PageLoad;
