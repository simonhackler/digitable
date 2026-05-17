import { randomUUID } from 'node:crypto';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getActiveMembership } from '@svg-table/db/private-rooms';
import {
	listPlaytestFeedback,
	loadPlaytestMetadata,
	savePlaytestFeedback,
	validatePlaytestStorageConfig
} from '$lib/server/playtest-storage';
import { Err, tryAsync } from 'wellcrafted/result';

type SubmitFeedbackBody = {
	title?: unknown;
	markdown?: unknown;
};

async function requirePlaytest(playtestId: string) {
	const metadata = await loadPlaytestMetadata(playtestId);
	if (!metadata) {
		error(404, 'Playtest not found');
	}
	return metadata;
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		error(401, 'Not authenticated');
	}

	validatePlaytestStorageConfig();

	const playtestId = params.playtestId;
	if (!playtestId) {
		error(400, 'Missing playtest id');
	}

	const metadata = await requirePlaytest(playtestId);
	const membership = await getActiveMembership({
		privateRoomId: metadata.privateRoomId,
		userId: locals.user.id
	});

	if (!membership) {
		error(403, 'Not a playtest member');
	}

	const parsedBody = await tryAsync({
		try: () => request.json() as Promise<SubmitFeedbackBody>,
		catch: (cause) => Err(cause instanceof Error ? cause : new Error(String(cause)))
	});
	if (parsedBody.error) {
		error(400, 'Invalid feedback payload');
	}

	const body = parsedBody.data;
	if (typeof body.markdown !== 'string' || body.markdown.trim().length === 0) {
		error(400, 'Missing feedback note');
	}

	const feedback = await savePlaytestFeedback({
		playtestId,
		id: randomUUID(),
		title: typeof body.title === 'string' ? body.title : '',
		markdown: body.markdown,
		authorUserId: locals.user.id,
		authorName: locals.user.name,
		submittedAt: new Date()
	});

	return json({
		id: feedback.id,
		submittedAt: feedback.submittedAt
	});
};

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		error(401, 'Not authenticated');
	}

	validatePlaytestStorageConfig();

	const playtestId = params.playtestId;
	if (!playtestId) {
		error(400, 'Missing playtest id');
	}

	const metadata = await requirePlaytest(playtestId);
	if (metadata.createdByUserId !== locals.user.id) {
		error(403, 'Only the playtest creator can import feedback');
	}

	return json({
		feedback: await listPlaytestFeedback(playtestId)
	});
};
