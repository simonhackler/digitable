import { redirect } from '@sveltejs/kit';
import { isDiscordAuthEnabled, isGoogleAuthEnabled } from '@svg-table/auth/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) {
		redirect(302, '/app/games');
	}

	return {
		discordAuthEnabled: isDiscordAuthEnabled(),
		googleAuthEnabled: isGoogleAuthEnabled()
	};
};
