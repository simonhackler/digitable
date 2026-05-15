import { error, redirect } from '@sveltejs/kit';
import {
	addPrivateRoomMember,
	getActiveMembership,
	getPrivateRoomByInviteCode
} from '@svg-table/db/private-rooms';
import { loadPlaytestProject } from '$lib/server/playtest-storage';
import type { PageServerLoad } from './$types';

export const ssr = false;

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		redirect(302, '/app/sign-in');
	}

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
		projectName: playtest.metadata.projectName,
		privateRoomId: playtest.metadata.privateRoomId,
		files: playtest.files
	};
};
