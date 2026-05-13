import { resolve } from '$app/paths';
import { fail, redirect } from '@sveltejs/kit';
import { getMissingCurrentPolicies, recordCurrentPolicyAcceptances } from '@svg-table/db/policies';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(303, resolve('/sign-in'));
	}

	const missingPolicies = await getMissingCurrentPolicies(locals.user.id);

	if (missingPolicies.length === 0) {
		redirect(303, resolve('/games'));
	}

	return {
		missingPolicies: missingPolicies.map((policy) => ({
			id: policy.id,
			policyType: policy.policyType,
			version: policy.version
		}))
	};
};

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		if (!locals.user) {
			redirect(303, resolve('/sign-in'));
		}

		const formData = await request.formData();
		const accepted = formData.get('accepted') === 'on';

		if (!accepted) {
			return fail(400, {
				message: 'Accept the current Terms & Conditions and acknowledge the Privacy Policy.'
			});
		}

		await recordCurrentPolicyAcceptances({
			userId: locals.user.id,
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		redirect(303, resolve('/games'));
	}
};
