import { error } from '@sveltejs/kit';

export function GET({ locals }) {
	if (!locals.user) error(401, 'Not authenticated');
	return new Response(null, { status: 204 });
}
