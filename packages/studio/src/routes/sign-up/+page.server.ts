import { redirect } from '@sveltejs/kit';
import { isGoogleAuthEnabled } from '@svg-table/auth/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) {
		redirect(302, '/app/games');
	}

	return {
		googleAuthEnabled: isGoogleAuthEnabled()
	};
};
