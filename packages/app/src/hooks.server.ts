import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';

import { auth } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const session = process.env.DATABASE_URL
		? await auth.api.getSession({
				headers: event.request.headers
			})
		: null;

	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;

	return svelteKitHandler({
		event,
		resolve,
		auth,
		building
	});
};
