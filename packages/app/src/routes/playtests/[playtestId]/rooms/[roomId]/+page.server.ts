import { error, redirect } from '@sveltejs/kit';
import {
	addPrivateRoomMember,
	getActiveMembership,
	getPrivateRoomByInviteCode
} from '@svg-table/db/private-rooms';
import { hasPlaytestAccess } from '$lib/server/playtest-access';
import { playtestPlayerLimitsFromFiles } from '$lib/server/playtest-player-limits';
import { loadPlaytestProject } from '$lib/server/playtest-storage';
import type { PageServerLoad } from './$types';

export const ssr = false;
const APP_BASE = '/app';

export const load: PageServerLoad = async ({ cookies, locals, params, url }) => {
	const playtestId = params.playtestId;
	const roomId = params.roomId;
	if (!playtestId) {
		error(400, 'Missing playtest id');
	}
	if (!roomId) {
		error(400, 'Missing room id');
	}

	if (!locals.user) {
		const next = `${url.pathname}${url.search}`;
		const joinPath = `${APP_BASE}/playtests/${encodeURIComponent(playtestId)}/join`;
		redirect(303, `${joinPath}?next=${encodeURIComponent(next)}`);
	}

	const playtest = await loadPlaytestProject(playtestId);
	if (!playtest) {
		error(404, 'Playtest not found');
	}

	const room = await getPrivateRoomByInviteCode(playtestId);
	if (!room || room.id !== playtest.metadata.privateRoomId) {
		error(404, 'Playtest room not found');
	}

	if (
		!hasPlaytestAccess({
			cookies,
			playtestId,
			privateRoomId: room.id,
			passwordHash: room.passwordHash
		})
	) {
		const next = `${url.pathname}${url.search}`;
		const joinPath = `${APP_BASE}/playtests/${encodeURIComponent(playtestId)}/join`;
		redirect(303, `${joinPath}?next=${encodeURIComponent(next)}`);
	}

	const membership = await getActiveMembership({
		privateRoomId: room.id,
		userId: locals.user.id
	});

	if (!membership) {
		await addPrivateRoomMember({
			privateRoomId: room.id,
			userId: locals.user.id,
			role: 'player'
		});
	}

	const playerLimits = playtestPlayerLimitsFromFiles(playtest.files);
	if (playerLimits.error) {
		error(400, playerLimits.error.message);
	}

	return {
		playtestId: playtest.metadata.id,
		roomId,
		projectName: playtest.metadata.projectName,
		privateRoomId: playtest.metadata.privateRoomId,
		files: playtest.files,
		...playerLimits.data
	};
};
