import { expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export async function signUp(request: APIRequestContext, name: string, origin = '') {
	const response = await request.post(`${origin}/app/api/auth/sign-up/email`, {
		data: {
			name,
			email: `e2e-${randomUUID()}@example.com`,
			password: 'correct-horse-battery-staple'
		}
	});
	await expect(response).toBeOK();
	await expect(await request.post(`${origin}/app/api/legal/accept-current`)).toBeOK();
}
