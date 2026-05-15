import { redirect } from '@sveltejs/kit';
import { isGoogleAuthEnabled } from '@svg-table/auth/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) {
		redirect(302, '/app/games');
	}

	return {
		googleAuthEnabled: isGoogleAuthEnabled(),
		googleError:
			url.searchParams.get('error') === 'google'
				? 'Google sign in failed. Try again in a moment.'
				: ''
	};
};
