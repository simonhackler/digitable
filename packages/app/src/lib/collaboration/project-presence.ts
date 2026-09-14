import type {
	DocHandle,
	DocHandleEphemeralMessagePayload,
	PeerId
} from '@automerge/automerge-repo';
import type { ProjectDocument } from './model';

const VERSION = 1;
const HEARTBEAT_MS = 5_000;
const PEER_TTL_MS = 15_000;

export type PresenceCursor = { x: number; y: number };

export type LocalPresenceState = {
	name: string;
	scope: string;
	cursor: PresenceCursor | null;
};

export type RemotePresenceState = LocalPresenceState & { peerId: string };

export type ProjectPresence = {
	setLocalState(state: LocalPresenceState): void;
	subscribe(listener: (peers: RemotePresenceState[]) => void): () => void;
	close(): void;
};

type PresenceMessage =
	| { type: 'presence-hello'; version: typeof VERSION }
	| { type: 'presence-state'; version: typeof VERSION; state: LocalPresenceState }
	| { type: 'presence-leave'; version: typeof VERSION };

type PeerState = RemotePresenceState & { lastSeenAt: number };

export function createProjectPresence(handle: DocHandle<ProjectDocument>): ProjectPresence {
	const peers = new Map<PeerId, PeerState>();
	const listeners = new Set<(peers: RemotePresenceState[]) => void>();
	let local: LocalPresenceState | null = null;
	let closed = false;

	function snapshot(): RemotePresenceState[] {
		return [...peers.values()].map(({ peerId, name, scope, cursor }) => ({
			peerId,
			name,
			scope,
			cursor
		}));
	}

	function notify(): void {
		const value = snapshot();
		for (const listener of listeners) listener(value);
	}

	function broadcastState(): void {
		if (!local || closed) return;
		handle.broadcast({
			type: 'presence-state',
			version: VERSION,
			state: local
		} satisfies PresenceMessage);
	}

	function onMessage({
		senderId,
		message
	}: DocHandleEphemeralMessagePayload<ProjectDocument>): void {
		if (!isPresenceMessage(message)) return;
		if (message.type === 'presence-hello') {
			broadcastState();
			return;
		}
		if (message.type === 'presence-leave') {
			if (peers.delete(senderId)) notify();
			return;
		}
		peers.set(senderId, {
			peerId: senderId,
			...message.state,
			lastSeenAt: Date.now()
		});
		notify();
	}

	handle.on('ephemeral-message', onMessage);
	handle.broadcast({ type: 'presence-hello', version: VERSION } satisfies PresenceMessage);
	const heartbeat = window.setInterval(broadcastState, HEARTBEAT_MS);
	const pruning = window.setInterval(() => {
		const threshold = Date.now() - PEER_TTL_MS;
		let changed = false;
		for (const [peerId, peer] of peers) {
			if (peer.lastSeenAt >= threshold) continue;
			peers.delete(peerId);
			changed = true;
		}
		if (changed) notify();
	}, HEARTBEAT_MS);

	return {
		setLocalState(state) {
			if (closed) return;
			local = state;
			broadcastState();
		},
		subscribe(listener) {
			listeners.add(listener);
			listener(snapshot());
			return () => listeners.delete(listener);
		},
		close() {
			if (closed) return;
			handle.broadcast({ type: 'presence-leave', version: VERSION } satisfies PresenceMessage);
			closed = true;
			window.clearInterval(heartbeat);
			window.clearInterval(pruning);
			handle.off('ephemeral-message', onMessage);
			peers.clear();
			listeners.clear();
		}
	};
}

function isPresenceMessage(value: unknown): value is PresenceMessage {
	if (!value || typeof value !== 'object') return false;
	const message = value as Record<string, unknown>;
	if (message.version !== VERSION) return false;
	if (message.type === 'presence-hello' || message.type === 'presence-leave') return true;
	if (message.type !== 'presence-state' || !message.state || typeof message.state !== 'object') {
		return false;
	}
	const state = message.state as Record<string, unknown>;
	if (typeof state.name !== 'string' || state.name.length === 0 || state.name.length > 80)
		return false;
	if (typeof state.scope !== 'string' || state.scope.length === 0 || state.scope.length > 500) {
		return false;
	}
	if (state.cursor === null) return true;
	if (!state.cursor || typeof state.cursor !== 'object') return false;
	const cursor = state.cursor as Record<string, unknown>;
	return (
		typeof cursor.x === 'number' &&
		Number.isFinite(cursor.x) &&
		cursor.x >= 0 &&
		cursor.x <= 1 &&
		typeof cursor.y === 'number' &&
		Number.isFinite(cursor.y) &&
		cursor.y >= 0 &&
		cursor.y <= 1
	);
}
