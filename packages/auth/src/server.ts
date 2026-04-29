import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { db } from '@svg-table/db';

type AuthPlugin = NonNullable<Parameters<typeof betterAuth>[0]['plugins']>[number];

function compact(values: Array<string | undefined>) {
	return values.filter((value): value is string => Boolean(value));
}

function env(name: string, fallback: string) {
	const value = process.env[name];

	if (value) {
		return value;
	}

	if (process.env.NODE_ENV === 'production') {
		throw new Error(`${name} is required`);
	}

	return fallback;
}

export function createAuth(plugins: AuthPlugin[] = []) {
	const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;
	const baseURL = env('BETTER_AUTH_URL', `http://localhost:${process.env.PORT ?? '5173'}/app`);

	return betterAuth({
		appName: 'Digitable',
		database: drizzleAdapter(db, {
			provider: 'pg'
		}),
		baseURL,
		basePath: '/api/auth',
		secret: env('BETTER_AUTH_SECRET', 'dev-only-better-auth-secret-change-me'),
		trustedOrigins: compact([process.env.WEB_ORIGIN, process.env.SECOND_WEB_ORIGIN, baseURL]),
		emailAndPassword: {
			enabled: true
		},
		plugins,
		advanced: {
			useSecureCookies: process.env.NODE_ENV === 'production',
			...(cookieDomain
				? {
						crossSubDomainCookies: {
							enabled: true,
							domain: cookieDomain
						}
					}
				: {})
		}
	});
}

export const auth = createAuth();

export type Auth = typeof auth;
export type AuthSessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;
export type AuthUser = NonNullable<AuthSessionResult>['user'];
export type AuthSession = NonNullable<AuthSessionResult>['session'];
