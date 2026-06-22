import { error, redirect } from '@sveltejs/kit';
import { getPrivateRoomByInviteCode } from '@svg-table/db/private-rooms';
import { loadPlaytestProject } from '$lib/server/playtest-storage';
import type { PageServerLoad } from './$types';

const LOCAL_ORIGIN = 'https://digitable.local';
const APP_BASE = '/app';

function internalAppPath(value: string | null) {
	if (!value) return null;

	let parsed: URL;
	try {
		parsed = new URL(value, LOCAL_ORIGIN);
	} catch {
		return null;
	}

	if (parsed.origin !== LOCAL_ORIGIN) return null;

	let pathname = parsed.pathname;
	if (pathname !== APP_BASE && !pathname.startsWith(`${APP_BASE}/`)) {
		if (!pathname.startsWith('/')) return null;
		pathname = `${APP_BASE}${pathname}`;
	}

	return `${pathname}${parsed.search}${parsed.hash}`;
}

function playtestPath(playtestId: string) {
	return `${APP_BASE}/playtests/${encodeURIComponent(playtestId)}`;
}

function playtestReturnPath(playtestId: string, value: string | null) {
	const next = internalAppPath(value);
	if (!next) return null;

	const parsed = new URL(next, LOCAL_ORIGIN);
	const basePath = playtestPath(playtestId);
	const roomPath = new RegExp(`^${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/rooms/[^/]+$`);
	if (parsed.pathname !== basePath && !roomPath.test(parsed.pathname)) return null;

	return next;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const playtestId = params.playtestId;
	if (!playtestId) {
		error(400, 'Missing playtest id');
	}

	const playtest = await loadPlaytestProject(playtestId);
	if (!playtest) {
		error(404, 'Playtest not found');
	}

	const room = await getPrivateRoomByInviteCode(playtestId);
	if (!room || room.id !== playtest.metadata.privateRoomId) {
		error(404, 'Playtest room not found');
	}

	const next =
		playtestReturnPath(playtestId, url.searchParams.get('next')) ?? playtestPath(playtestId);
	if (locals.user) {
		redirect(303, next);
	}

	return {
		projectName: playtest.metadata.projectName,
		signInUrl: `/sign-in?next=${encodeURIComponent(next)}`,
		anonymousUrl: `${APP_BASE}/legal/accept?anonymous=playtest&next=${encodeURIComponent(next)}`
	};
};
