import { error, redirect } from '@sveltejs/kit';
import {
	addPrivateRoomMember,
	getActiveMembership,
	getPrivateRoomByInviteCode
} from '@svg-table/db/private-rooms';
import { playtestPlayerLimitsFromFiles } from '$lib/server/playtest-player-limits';
import { loadPlaytestProject } from '$lib/server/playtest-storage';
import type { PageServerLoad } from './$types';

export const ssr = false;
const APP_BASE = '/app';

export const load: PageServerLoad = async ({ locals, params, url }) => {
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

	return {
		playtestId: playtest.metadata.id,
		roomId,
		projectName: playtest.metadata.projectName,
		privateRoomId: playtest.metadata.privateRoomId,
		files: playtest.files,
		...playtestPlayerLimitsFromFiles(playtest.files)
	};
};
