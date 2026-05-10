import { randomUUID } from 'node:crypto';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createPrivateRoom } from '@svg-table/db/private-rooms';
import { savePlaytestProject, type IncomingPlaytestFile } from '$lib/server/playtest-storage';

type CreatePlaytestBody = {
	projectName?: unknown;
	files?: unknown;
};

function validateFile(file: unknown): IncomingPlaytestFile {
	if (!file || typeof file !== 'object') {
		error(400, 'Invalid file entry');
	}

	const input = file as Record<string, unknown>;
	if (
		typeof input.path !== 'string' ||
		typeof input.contentBase64 !== 'string' ||
		typeof input.contentType !== 'string' ||
		typeof input.size !== 'number'
	) {
		error(400, 'Invalid file entry');
	}

	return {
		path: input.path,
		contentBase64: input.contentBase64,
		contentType: input.contentType,
		size: input.size
	};
}

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		error(401, 'Not authenticated');
	}

	const body = (await request.json()) as CreatePlaytestBody;
	if (typeof body.projectName !== 'string' || body.projectName.length === 0) {
		error(400, 'Missing projectName');
	}

	if (!Array.isArray(body.files) || body.files.length === 0) {
		error(400, 'Missing project files');
	}

	const playtestId = randomUUID();
	const files = body.files.map(validateFile);
	const room = await createPrivateRoom({
		ownerUserId: locals.user.id,
		inviteCode: playtestId
	});

	await savePlaytestProject({
		metadata: {
			version: 1,
			id: playtestId,
			projectName: body.projectName,
			privateRoomId: room.id,
			createdByUserId: locals.user.id,
			createdAt: new Date().toISOString(),
			files: files.map(({ path, contentType, size }) => ({ path, contentType, size }))
		},
		files
	});

	return json({
		playtestId,
		privateRoomId: room.id,
		invitePath: `/playtests/${playtestId}`
	});
};
