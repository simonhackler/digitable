import { building } from '$app/environment';
import { base, resolve as resolvePath } from '$app/paths';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { redirect, type Handle } from '@sveltejs/kit';
import { getMissingCurrentPolicies } from '@svg-table/db/policies';

import { auth } from '$lib/server/auth';

const publicPathPrefixes = [
	`${base}/api/auth`,
	resolvePath('/legal/accept'),
	resolvePath('/sign-in'),
	resolvePath('/sign-up')
];

function isPublicPath(pathname: string) {
	return publicPathPrefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export const handle: Handle = async ({ event, resolve }) => {
	const session = process.env.DATABASE_URL
		? await auth.api.getSession({
				headers: event.request.headers
			})
		: null;

	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;

	if (event.locals.user && !isPublicPath(event.url.pathname)) {
		const missingPolicies = await getMissingCurrentPolicies(event.locals.user.id);

		if (missingPolicies.length > 0) {
			redirect(303, resolvePath('/legal/accept'));
		}
	}

	return svelteKitHandler({
		event,
		resolve,
		auth,
		building
	});
};
