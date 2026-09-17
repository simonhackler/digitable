import type {
	DocHandle,
	DocHandleEphemeralMessagePayload,
	PeerId
} from '@automerge/automerge-repo';
import type { ProjectDocument } from './model';

const VERSION = 2;
const HEARTBEAT_MS = 5_000;
const PEER_TTL_MS = 60_000;

export type PresenceSurfaceLayout = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type PresenceCoordinates = { x: number; y: number };

export type PresencePointer =
	| (PresenceCoordinates & {
			kind: 'surface';
			surfaceId: string;
			layout: PresenceSurfaceLayout;
	  })
	| (PresenceCoordinates & {
			kind: 'region';
			surfaceId: string;
			regionId: string;
	  });

export type PresenceParticipant = { displayName: string };

export type LocalPresenceState = {
	participant: PresenceParticipant;
	pageId: string | null;
	pointer: PresencePointer | null;
};

export type RemotePresenceState = LocalPresenceState & { peerId: string };

export type ProjectPresence = {
	setParticipant(participant: PresenceParticipant): void;
	setPage(pageId: string | null): void;
	setPointer(pointer: PresencePointer | null): void;
	reannounce(): void;
	subscribe(listener: (peers: RemotePresenceState[]) => void): () => void;
	close(): void;
};

export function presenceColor(peerId: string): string {
	let hash = 0;
	for (const character of peerId) hash = (hash * 31 + character.charCodeAt(0)) | 0;
	return `hsl(${Math.abs(hash) % 360} 72% 45%)`;
}

type PresenceMessage =
	| { type: 'presence-hello'; version: typeof VERSION }
	| { type: 'presence-state'; version: typeof VERSION; state: LocalPresenceState }
	| { type: 'presence-leave'; version: typeof VERSION };

type PeerState = RemotePresenceState & { lastSeenAt: number };

export function createProjectPresence(handle: DocHandle<ProjectDocument>): ProjectPresence {
	const peers = new Map<PeerId, PeerState>();
	const listeners = new Set<(peers: RemotePresenceState[]) => void>();
	let local: LocalPresenceState = {
		participant: { displayName: 'Collaborator' },
		pageId: null,
		pointer: null
	};
	let active = false;
	let closed = false;

	function snapshot(): RemotePresenceState[] {
		return [...peers.values()].map(({ peerId, participant, pageId, pointer }) => ({
			peerId,
			participant,
			pageId,
			pointer
		}));
	}

	function notify(): void {
		const value = snapshot();
		for (const listener of listeners) listener(value);
	}

	function broadcastState(): void {
		if (!active || closed) return;
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
		setParticipant(participant) {
			if (closed) return;
			local = { ...local, participant };
			active = true;
			broadcastState();
		},
		setPage(pageId) {
			if (closed) return;
			local = { ...local, pageId, pointer: null };
			broadcastState();
		},
		setPointer(pointer) {
			if (closed) return;
			local = { ...local, pointer };
			broadcastState();
		},
		reannounce() {
			if (closed) return;
			handle.broadcast({ type: 'presence-hello', version: VERSION } satisfies PresenceMessage);
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
			notify();
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
	if (!state.participant || typeof state.participant !== 'object') return false;
	const participant = state.participant as Record<string, unknown>;
	if (
		typeof participant.displayName !== 'string' ||
		participant.displayName.length === 0 ||
		participant.displayName.length > 80
	) {
		return false;
	}
	if (
		state.pageId !== null &&
		(typeof state.pageId !== 'string' || state.pageId.length === 0 || state.pageId.length > 500)
	) {
		return false;
	}
	if (state.pointer === null) return true;
	if (!state.pointer || typeof state.pointer !== 'object') return false;
	const pointer = state.pointer as Record<string, unknown>;
	if (pointer.kind !== 'surface' && pointer.kind !== 'region') return false;
	if (!validId(pointer.surfaceId)) return false;
	if (pointer.kind === 'region' && !validId(pointer.regionId)) return false;
	if (
		pointer.kind === 'surface' &&
		!['xs', 'sm', 'md', 'lg', 'xl'].includes(String(pointer.layout))
	) {
		return false;
	}
	return (
		typeof pointer.x === 'number' &&
		Number.isFinite(pointer.x) &&
		pointer.x >= 0 &&
		pointer.x <= 1 &&
		typeof pointer.y === 'number' &&
		Number.isFinite(pointer.y) &&
		pointer.y >= 0 &&
		pointer.y <= 1
	);
}

function validId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= 120;
}
