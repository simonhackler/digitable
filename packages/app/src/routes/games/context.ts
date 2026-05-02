import type { FsDir } from '$lib/components/file-browser/adapters/adapter';
import { getContext, setContext, createContext } from 'svelte';
import type { Game } from './types';

const key = 'filesystem';

export function setFileSystemContext(fileSystem: { adapter: FsDir | null }) {
	setContext(key, fileSystem);
}

export function getFileSystemContext(): FsDir {
	const context = getContext(key) as { adapter: FsDir | null } | undefined;
	if (!context?.adapter) {
		throw new Error('File system context not set');
	}
	return context.adapter;
}

export const [getGamesContext, setGamesContext] = createContext<{ existingGames: Game[] | null }>();
