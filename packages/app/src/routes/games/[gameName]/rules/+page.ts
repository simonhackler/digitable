import { member } from '$lib/collaboration/dependencies';
import type { PageLoad } from './$types';

export const load = (() => ({
	projectNeeds: { rules: member('rules', 'rules.md') }
})) satisfies PageLoad;
