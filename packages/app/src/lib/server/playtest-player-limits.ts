import type { IncomingPlaytestFile } from '$lib/server/playtest-storage';
import { Err, Ok, trySync, type Result } from 'wellcrafted/result';

const MAX_PLAYERS = 20;

export type PlaytestPlayerLimits = {
	minPlayers: number;
	maxPlayers: number;
};

function validLimit(value: unknown) {
	return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_PLAYERS;
}

export function playtestPlayerLimitsFromFiles(
	files: IncomingPlaytestFile[]
): Result<PlaytestPlayerLimits, Error> {
	const gameFile = files.find((file) => file.path === 'game.json');
	if (!gameFile) {
		return Err(new Error('Invalid game.json: file is required.'));
	}

	const parsed = trySync({
		try: () =>
			JSON.parse(Buffer.from(gameFile.contentBase64, 'base64').toString('utf8')) as Record<
				string,
				unknown
			>,
		catch: () => Err(new Error('Invalid game.json: expected valid JSON.'))
	});

	if (parsed.error) return Err(parsed.error);

	if (!validLimit(parsed.data.minPlayers)) {
		return Err(
			new Error(`Invalid game.json: minPlayers must be an integer from 1 to ${MAX_PLAYERS}.`)
		);
	}
	if (!validLimit(parsed.data.maxPlayers)) {
		return Err(
			new Error(`Invalid game.json: maxPlayers must be an integer from 1 to ${MAX_PLAYERS}.`)
		);
	}

	const minPlayers = parsed.data.minPlayers as number;
	const maxPlayers = parsed.data.maxPlayers as number;
	if (maxPlayers < minPlayers) {
		return Err(
			new Error('Invalid game.json: maxPlayers must be greater than or equal to minPlayers.')
		);
	}

	return Ok({ minPlayers, maxPlayers });
}
