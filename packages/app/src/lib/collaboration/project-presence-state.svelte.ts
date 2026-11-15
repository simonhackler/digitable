import type { ProjectPresence, RemotePresenceState } from './project-presence';

export type ProjectPresenceState = {
	readonly peers: RemotePresenceState[];
	destroy(): void;
};

export function createProjectPresenceState(presence: ProjectPresence): ProjectPresenceState {
	let peers = $state.raw<RemotePresenceState[]>([]);
	const unsubscribe = presence.subscribe((next) => (peers = next));
	let destroyed = false;

	return {
		get peers() {
			return peers;
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			unsubscribe();
			peers = [];
		}
	};
}
