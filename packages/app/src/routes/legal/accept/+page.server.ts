import { resolve } from '$app/paths';
import { error, fail, redirect } from '@sveltejs/kit';
import {
	getCurrentPolicies,
	getMissingCurrentPolicies,
	recordCurrentPolicyAcceptances
} from '@svg-table/db/policies';

import type { Actions, PageServerLoad } from './$types';

const APP_BASE = '/app';

function internalAppPath(value: string | null) {
	if (!value) return null;

	let parsed: URL;
	try {
		parsed = new URL(value, 'https://digitable.local');
	} catch {
		return null;
	}

	if (parsed.origin !== 'https://digitable.local') return null;
	let pathname = parsed.pathname;
	if (pathname !== APP_BASE && !pathname.startsWith(`${APP_BASE}/`)) {
		if (!pathname.startsWith('/')) return null;
		pathname = `${APP_BASE}${pathname}`;
	}

	return `${pathname}${parsed.search}${parsed.hash}`;
}

function returnPath(input: FormData | URLSearchParams) {
	const anonymousMode = input.get('anonymous') === 'playtest';
	const nextValue = input.get('next');
	const next = internalAppPath(typeof nextValue === 'string' ? nextValue : null);

	if (!next) return { anonymousMode, next: null };

	const parsed = new URL(next, 'https://digitable.local');
	const playtestPrefix = `${APP_BASE}/playtests/`;
	if (anonymousMode && !parsed.pathname.startsWith(playtestPrefix)) {
		return { anonymousMode, next: null };
	}

	return { anonymousMode, next };
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const requestedReturnPath = returnPath(url.searchParams);
	const anonymousMode = requestedReturnPath.anonymousMode && !locals.user;
	const next = requestedReturnPath.next;

	if (!locals.user && !anonymousMode) {
		redirect(303, resolve('/sign-in'));
	}

	if (anonymousMode && !next) {
		error(400, 'Invalid playtest return path');
	}

	const missingPolicies = locals.user
		? await getMissingCurrentPolicies(locals.user.id)
		: await getCurrentPolicies();

	if (locals.user && missingPolicies.length === 0) {
		redirect(303, next ?? resolve('/games'));
	}

	return {
		anonymousMode,
		next: next ?? resolve('/games'),
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
		const { next } = returnPath(formData);

		if (formData.has('next') && !next) {
			return fail(400, {
				message: 'Invalid return path.'
			});
		}

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

		redirect(303, next ?? resolve('/games'));
	}
};
