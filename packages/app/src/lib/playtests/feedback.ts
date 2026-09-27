import type { ProjectSession } from '$lib/collaboration';
import { Err, Ok, tryAsync, trySync, type Result } from 'wellcrafted/result';

const REGISTRY_PATH = 'feedback/playtests.json';

export type PlaytestFeedbackRegistry = {
	version: 1;
	playtests: {
		name: string;
		playtestId: string;
		createdAt: string;
		importedFeedbackIds: string[];
	}[];
};

export type RemotePlaytestFeedback = {
	id: string;
	title: string;
	authorName: string;
	submittedAt: string;
	markdown: string;
	fileName: string;
};

type FetchFeedbackError = {
	name: 'FetchFeedbackError';
	message: string;
	playtestId: string;
	cause: unknown;
};

export type PlaytestFeedbackImportError = Error | FetchFeedbackError;

const emptyRegistry = (): PlaytestFeedbackRegistry => ({
	version: 1,
	playtests: []
});

function fetchFeedbackError(playtestId: string, cause: unknown): Result<never, FetchFeedbackError> {
	return Err({
		name: 'FetchFeedbackError',
		message: `Could not fetch playtest feedback for ${playtestId}.`,
		playtestId,
		cause
	});
}

function safeFilePart(value: string): string {
	const safe = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
	return safe || 'note';
}

function sessionFolder(playtest: PlaytestFeedbackRegistry['playtests'][number]): string {
	const date = new Date(playtest.createdAt);
	const timestamp = Number.isNaN(date.getTime())
		? 'unknown'
		: date.toISOString().replace(/[:.]/g, '-');
	return `playtest-session-${timestamp}-${playtest.playtestId.slice(0, 8)}`;
}

function feedbackFileName(feedback: RemotePlaytestFeedback): string {
	const date = new Date(feedback.submittedAt);
	const time = Number.isNaN(date.getTime())
		? 'unknown'
		: date.toISOString().slice(11, 16).replace(':', '');
	return `${time}-${safeFilePart(feedback.authorName || 'player')}-${safeFilePart(feedback.title)}-${feedback.id.slice(0, 8)}.md`;
}

export function readPlaytestFeedbackRegistry(session: ProjectSession): PlaytestFeedbackRegistry {
	const document = session.member('feedback-registry', REGISTRY_PATH)?.handle.doc();
	if (!document) return emptyRegistry();
	const parsedResult = trySync({
		try: () => JSON.parse(document.content) as PlaytestFeedbackRegistry,
		catch: () => Ok(emptyRegistry())
	});
	const parsed = parsedResult.data;
	if (parsed.version !== 1 || !Array.isArray(parsed.playtests)) return emptyRegistry();
	return parsed;
}

export async function registerPlaytestFeedbackImport(
	session: ProjectSession,
	playtestId: string,
	playtestName: string
): Promise<Result<void, Error>> {
	const registry = readPlaytestFeedbackRegistry(session);
	const existing = registry.playtests.find((playtest) => playtest.playtestId === playtestId);
	if (existing) return Ok(undefined);
	const written = await session.put({
		path: REGISTRY_PATH,
		data: JSON.stringify(
			{
				...registry,
				playtests: [
					...registry.playtests,
					{
						playtestId,
						name: playtestName,
						createdAt: new Date().toISOString(),
						importedFeedbackIds: []
					}
				]
			},
			null,
			2
		)
	});
	return written.error ? Err(new Error(written.error.message)) : Ok(undefined);
}

export async function importRegisteredPlaytestFeedback(input: {
	session: ProjectSession;
	fetchFeedback: (playtestId: string) => Promise<RemotePlaytestFeedback[]>;
}): Promise<Result<number, PlaytestFeedbackImportError>> {
	const registry = readPlaytestFeedbackRegistry(input.session);
	let importedCount = 0;
	let nextRegistry = registry;
	const files: Array<{ path: `feedback/${string}.md`; data: string }> = [];

	for (const playtest of registry.playtests) {
		const importedIds = new Set(playtest.importedFeedbackIds);
		const feedback = await tryAsync({
			try: () => input.fetchFeedback(playtest.playtestId),
			catch: (cause) => fetchFeedbackError(playtest.playtestId, cause)
		});
		if (feedback.error) return Err(feedback.error);
		const feedbackData = feedback.data ?? [];

		for (const note of feedbackData) {
			if (importedIds.has(note.id)) continue;

			const writePath = `feedback/${sessionFolder(playtest)}/${feedbackFileName(note)}` as `feedback/${string}.md`;
			files.push({ path: writePath, data: note.markdown });
			importedIds.add(note.id);
			importedCount += 1;
		}

		nextRegistry = {
			...nextRegistry,
			playtests: nextRegistry.playtests.map((candidate) =>
				candidate.playtestId === playtest.playtestId
					? { ...candidate, importedFeedbackIds: [...importedIds].sort() }
					: candidate
			)
		};
	}

	if (importedCount > 0) {
		const written = await input.session.put([
			...files,
			{ path: REGISTRY_PATH, data: JSON.stringify(nextRegistry, null, 2) }
		]);
		if (written.error) return Err(new Error(written.error.message));
	}

	return Ok(importedCount);
}
