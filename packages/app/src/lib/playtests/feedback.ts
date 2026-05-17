import {
	joinFsPath,
	type FsDir,
	type FsError
} from '$lib/components/file-browser/adapters/adapter';
import { Err, Ok, tryAsync, trySync, type Result } from 'wellcrafted/result';

const REGISTRY_PATH = 'feedback/playtests.json';

export type PlaytestFeedbackRegistry = {
	version: 1;
	playtests: {
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

export type PlaytestFeedbackImportError = FsError | FetchFeedbackError;

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

export async function readPlaytestFeedbackRegistry(
	gameDir: FsDir
): Promise<Result<PlaytestFeedbackRegistry, FsError>> {
	const existing = await gameDir.readText(REGISTRY_PATH);
	if (existing.error) {
		if (existing.error.name === 'NotFoundError') return Ok(emptyRegistry());
		return Err(existing.error);
	}

	return trySync({
		try: () => {
			const parsed = JSON.parse(existing.data) as PlaytestFeedbackRegistry;
			if (parsed.version !== 1 || !Array.isArray(parsed.playtests)) return emptyRegistry();
			return parsed;
		},
		catch: () => Ok(emptyRegistry())
	});
}

async function writePlaytestFeedbackRegistry(
	gameDir: FsDir,
	registry: PlaytestFeedbackRegistry
): Promise<Result<void, FsError>> {
	const written = await gameDir.write(REGISTRY_PATH, JSON.stringify(registry, null, 2));
	if (written.error) {
		return Err(written.error);
	}
	return Ok(undefined);
}

export async function registerPlaytestFeedbackImport(
	gameDir: FsDir,
	playtestId: string
): Promise<Result<void, FsError>> {
	const registry = await readPlaytestFeedbackRegistry(gameDir);
	if (registry.error) return Err(registry.error);

	const existing = registry.data.playtests.find((playtest) => playtest.playtestId === playtestId);
	if (existing) return Ok(undefined);

	return writePlaytestFeedbackRegistry(gameDir, {
		...registry.data,
		playtests: [
			...registry.data.playtests,
			{
				playtestId,
				createdAt: new Date().toISOString(),
				importedFeedbackIds: []
			}
		]
	});
}

export async function importRegisteredPlaytestFeedback(input: {
	gameDir: FsDir;
	fetchFeedback: (playtestId: string) => Promise<RemotePlaytestFeedback[]>;
}): Promise<Result<number, PlaytestFeedbackImportError>> {
	const registry = await readPlaytestFeedbackRegistry(input.gameDir);
	if (registry.error) return Err(registry.error);

	let importedCount = 0;
	let nextRegistry = registry.data;

	for (const playtest of registry.data.playtests) {
		const importedIds = new Set(playtest.importedFeedbackIds);
		const feedback = await tryAsync({
			try: () => input.fetchFeedback(playtest.playtestId),
			catch: (cause) => fetchFeedbackError(playtest.playtestId, cause)
		});
		if (feedback.error) return Err(feedback.error);
		const feedbackData = feedback.data ?? [];

		for (const note of feedbackData) {
			if (importedIds.has(note.id)) continue;

			const writePath = joinFsPath('feedback', sessionFolder(playtest), feedbackFileName(note));
			const written = await input.gameDir.write(writePath, note.markdown);
			if (written.error) {
				return Err(written.error);
			}
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
		const written = await writePlaytestFeedbackRegistry(input.gameDir, nextRegistry);
		if (written.error) return Err(written.error);
	}

	return Ok(importedCount);
}
