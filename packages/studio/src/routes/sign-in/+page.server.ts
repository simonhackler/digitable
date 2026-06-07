import { redirect } from '@sveltejs/kit';
import { isGoogleAuthEnabled } from '@svg-table/auth/server';
import type { PageServerLoad } from './$types';

const DEFAULT_NEXT = '/app/games';
const LOCAL_ORIGIN = 'https://digitable.local';

function internalAppPath(value: string | null) {
	if (!value) return null;

	let parsed: URL;
	try {
		parsed = new URL(value, LOCAL_ORIGIN);
	} catch {
		return null;
	}

	if (parsed.origin !== LOCAL_ORIGIN) return null;
	if (parsed.pathname !== '/app' && !parsed.pathname.startsWith('/app/')) return null;
	if (parsed.pathname === '/app/sign-in' || parsed.pathname.startsWith('/app/sign-in/'))
		return null;
	if (parsed.pathname === '/app/sign-up' || parsed.pathname.startsWith('/app/sign-up/'))
		return null;

	return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export const load: PageServerLoad = ({ locals, url }) => {
	const next = internalAppPath(url.searchParams.get('next')) ?? DEFAULT_NEXT;

	if (locals.user) {
		redirect(302, next);
	}

	return {
		next,
		googleAuthEnabled: isGoogleAuthEnabled(),
		googleError:
			url.searchParams.get('error') === 'google'
				? 'Google sign in failed. Try again in a moment.'
				: ''
	};
};
