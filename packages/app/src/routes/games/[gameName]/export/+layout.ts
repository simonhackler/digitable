export const ssr = false;
import { snapshot } from '$lib/collaboration/dependencies';
import type { LayoutLoad } from './$types';

export const load = (() => ({ exportNeeds: { snapshot: snapshot() } })) satisfies LayoutLoad;
