import type { IncomingPlaytestFile } from '$lib/server/playtest-storage';

export type PlaytestPlayerLimits = {
	minPlayers: number;
	maxPlayers: number;
};

function normalizeLimit(value: unknown, fallback: number) {
	if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 20) return fallback;
	return value as number;
}

export function playtestPlayerLimitsFromFiles(files: IncomingPlaytestFile[]): PlaytestPlayerLimits {
	const gameFile = files.find((file) => file.path === 'game.json');
	if (!gameFile) {
		return { minPlayers: 1, maxPlayers: 4 };
	}

	const game = JSON.parse(Buffer.from(gameFile.contentBase64, 'base64').toString('utf8')) as Record<
		string,
		unknown
	>;
	const minPlayers = normalizeLimit(game.minPlayers, 1);
	const maxPlayers = Math.max(minPlayers, normalizeLimit(game.maxPlayers, 4));
	return { minPlayers, maxPlayers };
}
