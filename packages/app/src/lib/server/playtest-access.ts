import { createHash } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';

const COOKIE_PREFIX = 'playtest_access_';

function cookieName(playtestId: string) {
	return `${COOKIE_PREFIX}${playtestId}`;
}

function accessValue(input: { privateRoomId: string; passwordHash: string }) {
	return createHash('sha256')
		.update(`playtest-access:${input.privateRoomId}:${input.passwordHash}`)
		.digest('hex');
}

export function hasPlaytestAccess(input: {
	cookies: Cookies;
	playtestId: string;
	privateRoomId: string;
	passwordHash: string | null;
}) {
	if (!input.passwordHash) return true;
	return (
		input.cookies.get(cookieName(input.playtestId)) ===
		accessValue({ privateRoomId: input.privateRoomId, passwordHash: input.passwordHash })
	);
}

export function grantPlaytestAccess(input: {
	cookies: Cookies;
	playtestId: string;
	privateRoomId: string;
	passwordHash: string;
}) {
	input.cookies.set(
		cookieName(input.playtestId),
		accessValue({ privateRoomId: input.privateRoomId, passwordHash: input.passwordHash }),
		{
			httpOnly: true,
			path: '/',
			sameSite: 'lax',
			secure: false,
			maxAge: 60 * 60 * 24 * 30
		}
	);
}
