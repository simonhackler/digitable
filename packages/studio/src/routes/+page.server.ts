import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms/server';
import { zod4 } from 'sveltekit-superforms/adapters';
import { env } from '$env/dynamic/private';
import { subscribeSchema } from './subscribe/schema';

export const load: PageServerLoad = async () => {
	return {
		form: await superValidate(zod4(subscribeSchema))
	};
};

async function kitFetch(path: string, body: unknown) {
	const res = await fetch(`https://api.kit.com${path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Kit-Api-Key': env.KIT_API_KEY
		},
		body: JSON.stringify(body)
	});

	const text = await res.text();
	return { ok: res.ok, status: res.status, text };
}

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event, zod4(subscribeSchema));
		if (!form.valid) {
			form.message = { text: 'Please check the form and try again.', tone: 'error' };
			return fail(400, { form });
		}

		if (form.data.company) {
			return message(form, 'Thanks! Please check your inbox.');
		}

		if (!env.KIT_API_KEY || !env.KIT_FORM_ID) {
			console.error('Kit env vars are missing');
			form.valid = false;
			form.message = { text: 'Could not subscribe right now. Please try again.', tone: 'error' };
			return fail(500, { form });
		}

		const email_address = form.data.email.toLowerCase().trim();
		const first_name = form.data.firstName?.trim() || undefined;
		const referrer = event.request.headers.get('referer') ?? undefined;

		const created = await kitFetch('/v4/subscribers', {
			email_address,
			first_name,
			state: 'inactive'
		});

		if (!created.ok) {
			console.error('Kit subscriber create failed', {
				status: created.status,
				body: created.text
			});
			form.valid = false;
			form.message = { text: 'Could not subscribe right now. Please try again.', tone: 'error' };
			return fail(502, { form });
		}

		const added = await kitFetch(`/v4/forms/${env.KIT_FORM_ID}/subscribers`, {
			email_address,
			...(referrer ? { referrer } : {})
		});

		if (!added.ok) {
			console.error('Kit form add failed', {
				status: added.status,
				body: added.text
			});
			form.valid = false;
			form.message = { text: 'Could not subscribe right now. Please try again.', tone: 'error' };
			return fail(502, { form });
		}

		return message(form, { text: 'Success — check your inbox to confirm!', tone: 'success' });
	}
};
