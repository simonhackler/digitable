import { member } from '$lib/collaboration/dependencies';
import type { PageLoad } from './$types';

export const load = (() => ({
	projectNeeds: { metadata: member('game-metadata', 'game.json') }
})) satisfies PageLoad;
