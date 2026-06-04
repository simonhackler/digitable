import { env } from '$env/dynamic/private';

export const DEFAULT_PLAYTEST_BYTE_LIMIT = 1024 * 1024 * 1024;

export function parsePositiveByteCount(
	value: string | undefined,
	name: string,
	fallback: number
): number {
	if (value === undefined) return fallback;

	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new Error(`${name} must be a positive integer byte count`);
	}

	return parsed;
}

export function formatByteLimit(bytes: number): string {
	const gib = 1024 * 1024 * 1024;
	const mib = 1024 * 1024;

	if (bytes % gib === 0) return `${bytes / gib} GiB`;
	if (bytes % mib === 0) return `${bytes / mib} MiB`;
	return `${bytes} bytes`;
}

export function getPlaytestProjectMaxBytes(): number {
	return parsePositiveByteCount(
		env.PLAYTEST_PROJECT_MAX_BYTES,
		'PLAYTEST_PROJECT_MAX_BYTES',
		DEFAULT_PLAYTEST_BYTE_LIMIT
	);
}

export function getPlaytestProjectSize(files: { size: number }[]): number {
	return files.reduce((total, file) => {
		if (!Number.isSafeInteger(file.size) || file.size < 0) {
			throw new Error(`Invalid playtest file size: ${file.size}`);
		}

		const nextTotal = total + file.size;
		if (!Number.isSafeInteger(nextTotal)) {
			throw new Error('Playtest project size is too large');
		}

		return nextTotal;
	}, 0);
}
