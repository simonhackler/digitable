import { error, redirect } from '@sveltejs/kit';
import { getPrivateRoomByInviteCode, verifyPrivateRoomPassword } from '@svg-table/db/private-rooms';
import { grantPlaytestAccess, hasPlaytestAccess } from '$lib/server/playtest-access';
import { loadPlaytestProject } from '$lib/server/playtest-storage';
import type { Actions, PageServerLoad } from './$types';

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

export const load: PageServerLoad = async ({ cookies, locals, params, url }) => {
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
	const hasAccess = hasPlaytestAccess({
		cookies,
		playtestId,
		privateRoomId: room.id,
		passwordHash: room.passwordHash
	});

	if (room.passwordHash && !hasAccess) {
		return {
			projectName: playtest.metadata.projectName,
			next,
			requiresPassword: true,
			passwordError: null
		};
	}

	if (locals.user) {
		redirect(303, next);
	}

	return {
		projectName: playtest.metadata.projectName,
		next,
		requiresPassword: false,
		passwordError: null
	};
};

export const actions: Actions = {
	default: async ({ cookies, params, request, url }) => {
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

		const formData = await request.formData();
		const password = formData.get('password');
		if (typeof password !== 'string') {
			return {
				projectName: playtest.metadata.projectName,
				next:
					playtestReturnPath(playtestId, url.searchParams.get('next')) ?? playtestPath(playtestId),
				requiresPassword: true,
				passwordError: 'Enter the playtest password.'
			};
		}

		const verified = await verifyPrivateRoomPassword({ privateRoomId: room.id, password });
		if (!verified || !room.passwordHash) {
			return {
				projectName: playtest.metadata.projectName,
				next:
					playtestReturnPath(playtestId, url.searchParams.get('next')) ?? playtestPath(playtestId),
				requiresPassword: true,
				passwordError: 'Incorrect playtest password.'
			};
		}

		grantPlaytestAccess({
			cookies,
			playtestId,
			privateRoomId: room.id,
			passwordHash: room.passwordHash
		});

		redirect(
			303,
			playtestReturnPath(playtestId, url.searchParams.get('next')) ?? playtestPath(playtestId)
		);
	}
};
