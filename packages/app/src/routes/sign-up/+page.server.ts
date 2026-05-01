import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

export const load = ({ locals }) => {
	if (locals.user) {
		throw redirect(302, resolve('/games'));
	}
};
