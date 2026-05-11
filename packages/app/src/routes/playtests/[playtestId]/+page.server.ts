import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const ssr = false;

export const load: PageServerLoad = ({ locals, params }) => {
	if (!locals.user) {
		redirect(302, '/app/sign-in');
	}

	return {
		playtestId: params.playtestId
	};
};
