import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins';

import { db } from '@svg-table/db';
import * as schema from '@svg-table/db/schema';

type AuthPlugin = NonNullable<Parameters<typeof betterAuth>[0]['plugins']>[number];

type CreateAuthOptions = {
	baseURL?: string;
};

function googleCredentials() {
	const clientId = process.env.GOOGLE_CLIENT_ID;
	const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

	return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function isGoogleAuthEnabled() {
	return googleCredentials() !== null;
}

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

export function createAuth(plugins: AuthPlugin[] = [], options: CreateAuthOptions = {}) {
	const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;
	const cookiePrefix = process.env.BETTER_AUTH_COOKIE_PREFIX;
	const google = googleCredentials();
	const baseURL =
		options.baseURL ?? env('BETTER_AUTH_URL', `http://localhost:${process.env.PORT ?? '5173'}/app`);

	return betterAuth({
		appName: 'Digitable',
		database: drizzleAdapter(db, {
			provider: 'pg',
			schema
		}),
		baseURL,
		basePath: '/api/auth',
		secret: env('BETTER_AUTH_SECRET', 'dev-only-better-auth-secret-change-me'),
		trustedOrigins: compact([process.env.WEB_ORIGIN, process.env.SECOND_WEB_ORIGIN, baseURL]),
		emailAndPassword: {
			enabled: true
		},
		...(google
			? {
					socialProviders: {
						google
					}
				}
			: {}),
		plugins: [
			anonymous({
				disableDeleteAnonymousUser: true,
				emailDomainName: 'anonymous.digitable.invalid',
				generateName: () => 'Playtester'
			}),
			...plugins
		],
		advanced: {
			useSecureCookies: process.env.NODE_ENV === 'production',
			...(cookiePrefix ? { cookiePrefix } : {}),
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
