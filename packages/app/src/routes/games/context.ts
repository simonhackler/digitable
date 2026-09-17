import type { FsDir } from '$lib/components/file-browser/adapters/adapter';
import { getContext, setContext, createContext } from 'svelte';
import type { Game } from './types';
import type {
	DocumentState,
	GameMetadataDocument,
	ProjectSession,
	ProjectPresenceState,
	ReconciliationStatus
} from '$lib/collaboration';

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

export type ActiveProject = {
	key: string;
	session: ProjectSession;
	metadata: DocumentState<GameMetadataDocument>;
	presence: ProjectPresenceState;
};

export type ActiveProjectState = {
	phase: 'idle' | 'opening' | 'ready' | 'error';
	current: ActiveProject | null;
	reconciliation: ReconciliationStatus;
	error: string | null;
};

export const [getActiveProjectState, setActiveProjectState] = createContext<ActiveProjectState>();

export function getActiveProjectContext(): ActiveProject {
	const state = getActiveProjectState();
	if (state.phase !== 'ready' || !state.current) {
		throw new Error('Active project context is not ready');
	}
	return state.current;
}
