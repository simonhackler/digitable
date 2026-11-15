export const ssr = false;
import { snapshot } from '$lib/collaboration/dependencies';
import type { PageLoad } from './$types';

export const load = (() => ({ projectNeeds: { snapshot: snapshot() } })) satisfies PageLoad;
