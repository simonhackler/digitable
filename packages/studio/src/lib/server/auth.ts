import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from '@svg-table/auth/svelte-kit';

import { createAuth } from '@svg-table/auth/server';

const studioBaseURL =
	process.env.BETTER_AUTH_URL ??
	(process.env.NODE_ENV === 'production'
		? undefined
		: `http://localhost:${process.env.PORT ?? '5173'}`);

export const auth = createAuth([sveltekitCookies(getRequestEvent)], {
	baseURL: studioBaseURL
});
