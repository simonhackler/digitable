import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from 'better-auth/svelte-kit';

import { createAuth } from '@svg-table/auth/server';

function appAuthBaseURL() {
	const baseURL = process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? '5173'}`;

	const url = new URL(baseURL);
	url.pathname = '';
	url.search = '';
	url.hash = '';
	return url.toString().replace(/\/$/, '');
}

const baseURL = appAuthBaseURL();

export const auth = createAuth([sveltekitCookies(getRequestEvent)], {
	baseURL,
	basePath: '/app/api/auth'
});
