import { json, error } from '@sveltejs/kit';
import { recordCurrentPolicyAcceptances } from '@svg-table/db/policies';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request, getClientAddress }) => {
	if (!locals.user) {
		error(401, 'Not authenticated');
	}

	const acceptedPolicies = await recordCurrentPolicyAcceptances({
		userId: locals.user.id,
		ipAddress: getClientAddress(),
		userAgent: request.headers.get('user-agent')
	});

	return json({
		acceptedPolicyIds: acceptedPolicies.map((policy) => policy.id)
	});
};
