import type {
	DocHandle,
	DocHandleEphemeralMessagePayload,
	PeerId
} from '@automerge/automerge-repo';
import { decodeHeads, type UrlHeads } from '@automerge/automerge-repo';
import type {
	NodeId,
	Paint,
	RemoteSvgInteraction,
	Stroke,
	SvgClaim,
	SvgInteractionKind,
	SvgInteractionPreview
} from '@svg-table/svgeditor';
import { isSvgClaimDomain, isSvgInteractionKind, svgInteractionClaims } from '@svg-table/svgeditor';
import type { ProjectDocument } from './model';

const NAMESPACE = 'svg-table/project-svg-interactions';
const PROTOCOL_VERSION = 2 as const;
const HEARTBEAT_MS = 1_500;
const LEASE_MS = 5_000;
const HANDOFF_MS = 2_000;
const TOMBSTONE_MS = 12_000;
const UPDATE_THROTTLE_MS = 40;
const MAX_ID_LENGTH = 500;
const MAX_TEXT_LENGTH = 4_096;
const MAX_NODE_IDS = 256;
const MAX_CLAIMS = MAX_NODE_IDS * 2;
const MAX_HEADS = 256;
const MAX_HANDOFFS = 32;
const MAX_NUMBER = 1_000_000_000;

export type ProjectSvgActiveInteraction = RemoteSvgInteraction & {
	instanceId: string;
	pageId: string;
	documentId: string;
};

export type ProjectSvgInteractionHandoff = ProjectSvgActiveInteraction & {
	commitHeads: UrlHeads;
};

export type ProjectSvgInteractionState = {
	active: ProjectSvgActiveInteraction[];
	handoffs: ProjectSvgInteractionHandoff[];
	claims: SvgClaim[];
};

export type ProjectSvgInteraction = {
	interactionId: string;
	pageId: string;
	documentId: string;
	nodeIds: NodeId[];
	preview: SvgInteractionPreview;
};

export type BeginProjectSvgInteraction = {
	interactionId: string;
	kind: SvgInteractionKind;
	nodeIds: NodeId[];
	claims: SvgClaim[];
	baseHeads: UrlHeads;
	preview: SvgInteractionPreview;
};

export type ProjectSvgInteractionLease = {
	update(preview: SvgInteractionPreview): void;
	handoff(commitHeads: UrlHeads): void;
	cancel(): void;
};

export type ProjectSvgInteractionChannel = {
	begin(interaction: BeginProjectSvgInteraction): ProjectSvgInteractionLease | null;
	subscribe(listener: (state: ProjectSvgInteractionState) => void): () => void;
	observeHeads(heads: UrlHeads | ((commitHeads: UrlHeads) => boolean)): void;
	dispose(): void;
};

export type ProjectSvgInteractions = {
	forDocument(documentId: string, pageId: string): ProjectSvgInteractionChannel;
	close(): void;
};

type WireInteraction = ProjectSvgInteraction;

type WireHandoff = WireInteraction & { commitHeads: UrlHeads };

export type ProjectSvgInteractionSnapshot = {
	protocolVersion: typeof PROTOCOL_VERSION;
	instanceId: string;
	revision: number;
	active: WireInteraction | null;
	handoffs: WireHandoff[];
};

type InteractionSnapshot = ProjectSvgInteractionSnapshot;

type InteractionMessage =
	| {
			namespace: typeof NAMESPACE;
			type: 'hello';
			protocolVersion: typeof PROTOCOL_VERSION;
	  }
	| {
			namespace: typeof NAMESPACE;
			type: 'state';
			protocolVersion: typeof PROTOCOL_VERSION;
			snapshot: InteractionSnapshot;
	  }
	| {
			namespace: typeof NAMESPACE;
			type: 'leave';
			protocolVersion: typeof PROTOCOL_VERSION;
			instanceId: string;
			revision: number;
	  };

type LocalHandoff = WireHandoff & { expiresAt: number };
type PeerState = {
	senderId: PeerId;
	snapshot: InteractionSnapshot;
	receivedAt: number;
	handoffSeenAt: Map<string, number>;
};
type Tombstone = { revision: number; expiresAt: number };
type Candidate = {
	instanceId: string;
	interaction: WireInteraction;
	local: boolean;
};
type ChannelRecord = {
	documentId: string;
	pageId: string;
	listeners: Set<(state: ProjectSvgInteractionState) => void>;
	containsHeads?: (commitHeads: UrlHeads) => boolean;
	disposed: boolean;
};

export function createProjectSvgInteractions(
	handle: DocHandle<ProjectDocument>
): ProjectSvgInteractions {
	const instanceId = createInstanceId();
	const peers = new Map<string, PeerState>();
	const tombstones = new Map<string, Tombstone>();
	const observedHandoffs = new Set<string>();
	const expiredHandoffs = new Set<string>();
	const channels = new Set<ChannelRecord>();
	let active: WireInteraction | null = null;
	let activeUpdatedAt = 0;
	let activeChannel: ChannelRecord | null = null;
	let handoffs: LocalHandoff[] = [];
	let revision = 0;
	let closed = false;
	let lastBroadcastAt = 0;
	let pendingBroadcast: ReturnType<typeof setTimeout> | undefined;

	function snapshot(): InteractionSnapshot {
		return {
			protocolVersion: PROTOCOL_VERSION,
			instanceId,
			revision,
			active: active ? cloneInteraction(active) : null,
			handoffs: handoffs.map(({ expiresAt: _expiresAt, ...handoff }) => cloneHandoff(handoff))
		};
	}

	function broadcastState(): void {
		if (closed) return;
		if (pendingBroadcast) {
			clearTimeout(pendingBroadcast);
			pendingBroadcast = undefined;
		}
		lastBroadcastAt = Date.now();
		handle.broadcast({
			namespace: NAMESPACE,
			type: 'state',
			protocolVersion: PROTOCOL_VERSION,
			snapshot: snapshot()
		} satisfies InteractionMessage);
	}

	function queueBroadcast(): void {
		if (closed || pendingBroadcast) return;
		const delay = Math.max(0, UPDATE_THROTTLE_MS - (Date.now() - lastBroadcastAt));
		pendingBroadcast = setTimeout(broadcastState, delay);
	}

	function handoffKey(owner: string, interactionId: string): string {
		return `${owner}\u0000${interactionId}`;
	}

	function liveCandidates(now: number): Candidate[] {
		const candidates: Candidate[] = [];
		if (active) candidates.push({ instanceId, interaction: active, local: true });
		for (const peer of peers.values()) {
			if (peer.receivedAt + LEASE_MS <= now) continue;
			const owner = peer.snapshot.instanceId;
			if (peer.snapshot.active) {
				candidates.push({
					instanceId: owner,
					interaction: peer.snapshot.active,
					local: false
				});
			}
		}
		return candidates.sort((left, right) => {
			if (left.instanceId !== right.instanceId) return left.instanceId < right.instanceId ? -1 : 1;
			if (left.interaction.interactionId === right.interaction.interactionId) return 0;
			return left.interaction.interactionId < right.interaction.interactionId ? -1 : 1;
		});
	}

	function winners(now: number): Candidate[] {
		const accepted: Candidate[] = [];
		for (const candidate of liveCandidates(now)) {
			if (
				accepted.some(
					(winner) =>
						winner.instanceId !== candidate.instanceId &&
						winner.interaction.documentId === candidate.interaction.documentId &&
						winner.interaction.pageId === candidate.interaction.pageId &&
						interactionsConflict(winner.interaction, candidate.interaction)
				)
			) {
				continue;
			}
			accepted.push(candidate);
		}
		return accepted;
	}

	function remoteState(channel: ChannelRecord, now: number): ProjectSvgInteractionState {
		const visible = winners(now).filter(
			(candidate) =>
				!candidate.local &&
				candidate.interaction.documentId === channel.documentId &&
				candidate.interaction.pageId === channel.pageId
		);
		const remoteActive = visible.map((candidate) =>
			publicInteraction(candidate.instanceId, candidate.interaction)
		);
		const remoteHandoffs = [...peers.values()].flatMap((peer) =>
			peer.snapshot.handoffs.flatMap((handoff) => {
				const key = handoffKey(peer.snapshot.instanceId, handoff.interactionId);
				if (observedHandoffs.has(key)) return [];
				if ((peer.handoffSeenAt.get(handoff.interactionId) ?? now) + HANDOFF_MS <= now) return [];
				if (handoff.documentId !== channel.documentId || handoff.pageId !== channel.pageId)
					return [];
				return [publicHandoff(peer.snapshot.instanceId, handoff)];
			})
		);
		return {
			active: remoteActive,
			handoffs: remoteHandoffs,
			claims: visible.flatMap((candidate) =>
				svgInteractionClaims(candidate.interaction.preview.kind, candidate.interaction.nodeIds)
			)
		};
	}

	function notify(): void {
		const now = Date.now();
		for (const channel of channels) {
			if (channel.disposed) continue;
			const state = remoteState(channel, now);
			for (const listener of channel.listeners) listener(state);
		}
	}

	function observeRemoteHandoffs(channel: ChannelRecord): boolean {
		if (!channel.containsHeads) return false;
		let changed = false;
		for (const peer of peers.values()) {
			for (const handoff of peer.snapshot.handoffs) {
				if (
					handoff.documentId !== channel.documentId ||
					handoff.pageId !== channel.pageId ||
					!channel.containsHeads(handoff.commitHeads)
				) {
					continue;
				}
				const key = handoffKey(peer.snapshot.instanceId, handoff.interactionId);
				if (observedHandoffs.has(key)) continue;
				observedHandoffs.add(key);
				changed = true;
			}
		}
		return changed;
	}

	function prune(): void {
		if (closed) return;
		const now = Date.now();
		let localChanged = false;
		if (active && activeUpdatedAt + LEASE_MS <= now) {
			active = null;
			activeChannel = null;
			revision += 1;
			localChanged = true;
		}
		const retained = handoffs.filter((handoff) => handoff.expiresAt > now);
		if (retained.length !== handoffs.length) {
			handoffs = retained;
			revision += 1;
			localChanged = true;
		}
		let remoteChanged = false;
		for (const [owner, peer] of peers) {
			if (peer.receivedAt + LEASE_MS > now) continue;
			peers.delete(owner);
			clearHandoffMarks(owner);
			const previous = tombstones.get(owner);
			tombstones.set(owner, {
				revision: Math.max(previous?.revision ?? -1, peer.snapshot.revision),
				expiresAt: now + TOMBSTONE_MS
			});
			remoteChanged = true;
		}
		for (const [owner, tombstone] of tombstones) {
			if (tombstone.expiresAt <= now) tombstones.delete(owner);
		}
		if (localChanged) broadcastState();
		if (localChanged || remoteChanged) notify();
		if (!localChanged && !remoteChanged) notifyExpiredHandoffs(now);
	}

	function notifyExpiredHandoffs(now: number): void {
		for (const peer of peers.values()) {
			for (const handoff of peer.snapshot.handoffs) {
				const key = handoffKey(peer.snapshot.instanceId, handoff.interactionId);
				const seenAt = peer.handoffSeenAt.get(handoff.interactionId);
				if (seenAt && seenAt + HANDOFF_MS <= now && !expiredHandoffs.has(key)) {
					expiredHandoffs.add(key);
					notify();
					return;
				}
			}
		}
	}

	function receiveState(senderId: PeerId, next: InteractionSnapshot): void {
		if (next.instanceId === instanceId) return;
		const now = Date.now();
		const tombstone = tombstones.get(next.instanceId);
		if (tombstone && tombstone.revision >= next.revision) return;
		const previous = peers.get(next.instanceId);
		if (previous && previous.senderId !== senderId) return;
		if (previous && next.revision < previous.snapshot.revision) return;
		if (previous && next.revision === previous.snapshot.revision) {
			previous.receivedAt = now;
			return;
		}
		const seen = new Map<string, number>();
		const nextIds = new Set(next.handoffs.map((handoff) => handoff.interactionId));
		if (previous) {
			for (const handoff of previous.snapshot.handoffs) {
				if (nextIds.has(handoff.interactionId)) continue;
				const key = handoffKey(next.instanceId, handoff.interactionId);
				observedHandoffs.delete(key);
				expiredHandoffs.delete(key);
			}
		}
		for (const handoff of next.handoffs) {
			seen.set(handoff.interactionId, previous?.handoffSeenAt.get(handoff.interactionId) ?? now);
		}
		peers.set(next.instanceId, {
			senderId,
			snapshot: cloneSnapshot(next),
			receivedAt: now,
			handoffSeenAt: seen
		});
		for (const channel of channels) observeRemoteHandoffs(channel);
		notify();
	}

	function onMessage({
		senderId,
		message
	}: DocHandleEphemeralMessagePayload<ProjectDocument>): void {
		if (!isInteractionMessage(message)) return;
		if (message.type === 'hello') {
			broadcastState();
			return;
		}
		if (message.type === 'state') {
			receiveState(senderId, message.snapshot);
			return;
		}
		if (message.instanceId === instanceId) return;
		const peer = peers.get(message.instanceId);
		if (peer && peer.senderId !== senderId) return;
		const now = Date.now();
		const previousRevision =
			peer?.snapshot.revision ?? tombstones.get(message.instanceId)?.revision ?? -1;
		if (message.revision < previousRevision) return;
		peers.delete(message.instanceId);
		clearHandoffMarks(message.instanceId);
		tombstones.set(message.instanceId, {
			revision: message.revision,
			expiresAt: now + TOMBSTONE_MS
		});
		notify();
	}

	function clearHandoffMarks(owner: string): void {
		const prefix = `${owner}\u0000`;
		for (const key of observedHandoffs) {
			if (key.startsWith(prefix)) observedHandoffs.delete(key);
		}
		for (const key of expiredHandoffs) {
			if (key.startsWith(prefix)) expiredHandoffs.delete(key);
		}
	}

	handle.on('ephemeral-message', onMessage);
	handle.broadcast({
		namespace: NAMESPACE,
		type: 'hello',
		protocolVersion: PROTOCOL_VERSION
	} satisfies InteractionMessage);
	const timer = setInterval(() => {
		broadcastState();
		prune();
	}, HEARTBEAT_MS);

	return {
		forDocument(documentId, pageId) {
			if (closed) throw new Error('Project SVG interactions are closed.');
			if (!validId(documentId) || !validId(pageId)) {
				throw new TypeError(
					'SVG interaction document and page IDs must be bounded non-empty strings.'
				);
			}
			const record: ChannelRecord = {
				documentId,
				pageId,
				listeners: new Set(),
				containsHeads: undefined,
				disposed: false
			};
			channels.add(record);

			return {
				begin(interaction) {
					if (closed || record.disposed || active || !isBeginInteraction(interaction)) return null;
					prune();
					const proposed: WireInteraction = {
						interactionId: interaction.interactionId,
						pageId,
						documentId,
						nodeIds: [...interaction.nodeIds],
						preview: structuredClone(interaction.preview)
					};
					if (
						winners(Date.now()).some(
							(candidate) =>
								!candidate.local &&
								candidate.interaction.documentId === documentId &&
								candidate.interaction.pageId === pageId &&
								interactionsConflict(candidate.interaction, proposed)
						)
					) {
						return null;
					}
					active = proposed;
					activeUpdatedAt = Date.now();
					activeChannel = record;
					revision += 1;
					broadcastState();
					const token = proposed;
					return {
						update(preview) {
							if (
								closed ||
								active !== token ||
								!isPreview(preview) ||
								preview.kind !== token.preview.kind
							) {
								return;
							}
							token.preview = structuredClone(preview);
							activeUpdatedAt = Date.now();
							revision += 1;
							queueBroadcast();
						},
						handoff(commitHeads) {
							if (closed || active !== token || !isHeads(commitHeads)) return;
							active = null;
							activeChannel = null;
							handoffs = [
								...handoffs,
								{
									...cloneInteraction(token),
									commitHeads: [...commitHeads] as UrlHeads,
									expiresAt: Date.now() + HANDOFF_MS
								}
							].slice(-MAX_HANDOFFS);
							revision += 1;
							broadcastState();
							notify();
						},
						cancel() {
							if (closed || active !== token) return;
							active = null;
							activeChannel = null;
							revision += 1;
							broadcastState();
							notify();
						}
					};
				},
				subscribe(listener) {
					if (closed || record.disposed) {
						listener({ active: [], handoffs: [], claims: [] });
						return () => undefined;
					}
					record.listeners.add(listener);
					listener(remoteState(record, Date.now()));
					return () => record.listeners.delete(listener);
				},
				observeHeads(headsOrPredicate) {
					if (closed || record.disposed) return;
					const predicate =
						typeof headsOrPredicate === 'function'
							? headsOrPredicate
							: (commitHeads: UrlHeads) =>
									commitHeads.every((head) => headsOrPredicate.includes(head));
					record.containsHeads = predicate;
					const remoteChanged = observeRemoteHandoffs(record);
					if (remoteChanged) notify();
				},
				dispose() {
					if (record.disposed) return;
					record.disposed = true;
					record.listeners.clear();
					channels.delete(record);
					if (activeChannel !== record) return;
					active = null;
					activeChannel = null;
					revision += 1;
					broadcastState();
				}
			};
		},
		close() {
			if (closed) return;
			if (pendingBroadcast) clearTimeout(pendingBroadcast);
			revision += 1;
			handle.broadcast({
				namespace: NAMESPACE,
				type: 'leave',
				protocolVersion: PROTOCOL_VERSION,
				instanceId,
				revision
			} satisfies InteractionMessage);
			closed = true;
			clearInterval(timer);
			handle.off('ephemeral-message', onMessage);
			active = null;
			activeChannel = null;
			handoffs = [];
			peers.clear();
			for (const channel of channels) {
				channel.disposed = true;
				for (const listener of channel.listeners) {
					listener({ active: [], handoffs: [], claims: [] });
				}
				channel.listeners.clear();
			}
			channels.clear();
		}
	};
}

function publicInteraction(
	owner: string,
	interaction: WireInteraction
): ProjectSvgActiveInteraction {
	return {
		instanceId: owner,
		interactionId: interaction.interactionId,
		pageId: interaction.pageId,
		documentId: interaction.documentId,
		nodeIds: [...interaction.nodeIds],
		claims: svgInteractionClaims(interaction.preview.kind, interaction.nodeIds),
		preview: structuredClone(interaction.preview)
	};
}

function publicHandoff(owner: string, handoff: WireHandoff): ProjectSvgInteractionHandoff {
	return {
		...publicInteraction(owner, handoff),
		commitHeads: [...handoff.commitHeads] as UrlHeads
	};
}

function cloneInteraction(interaction: WireInteraction): WireInteraction {
	return {
		...interaction,
		nodeIds: [...interaction.nodeIds],
		preview: structuredClone(interaction.preview)
	};
}

function cloneHandoff(handoff: WireHandoff): WireHandoff {
	return {
		...cloneInteraction(handoff),
		commitHeads: [...handoff.commitHeads] as UrlHeads
	};
}

function cloneSnapshot(snapshot: InteractionSnapshot): InteractionSnapshot {
	return {
		protocolVersion: PROTOCOL_VERSION,
		instanceId: snapshot.instanceId,
		revision: snapshot.revision,
		active: snapshot.active ? cloneInteraction(snapshot.active) : null,
		handoffs: snapshot.handoffs.map(cloneHandoff)
	};
}

function interactionsConflict(left: WireInteraction, right: WireInteraction): boolean {
	const leftClaims = svgInteractionClaims(left.preview.kind, left.nodeIds);
	const rightClaims = svgInteractionClaims(right.preview.kind, right.nodeIds);
	return leftClaims.some((claim) =>
		rightClaims.some(
			(candidate) => claim.nodeId === candidate.nodeId && claim.domain === candidate.domain
		)
	);
}

function createInstanceId(): string {
	if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isInteractionMessage(value: unknown): value is InteractionMessage {
	if (
		!isRecord(value) ||
		value.namespace !== NAMESPACE ||
		value.protocolVersion !== PROTOCOL_VERSION
	) {
		return false;
	}
	if (value.type === 'hello') return exactKeys(value, ['namespace', 'type', 'protocolVersion']);
	if (value.type === 'state') {
		return (
			exactKeys(value, ['namespace', 'type', 'protocolVersion', 'snapshot']) &&
			isSnapshot(value.snapshot)
		);
	}
	if (value.type !== 'leave') return false;
	return (
		exactKeys(value, ['namespace', 'type', 'protocolVersion', 'instanceId', 'revision']) &&
		validId(value.instanceId) &&
		isRevision(value.revision)
	);
}

function isSnapshot(value: unknown): value is InteractionSnapshot {
	if (!isRecord(value)) return false;
	if (!exactKeys(value, ['protocolVersion', 'instanceId', 'revision', 'active', 'handoffs'])) {
		return false;
	}
	return (
		value.protocolVersion === PROTOCOL_VERSION &&
		validId(value.instanceId) &&
		isRevision(value.revision) &&
		(value.active === null || isWireInteraction(value.active)) &&
		Array.isArray(value.handoffs) &&
		value.handoffs.length <= MAX_HANDOFFS &&
		value.handoffs.every(isWireHandoff) &&
		unique(value.handoffs.map((handoff) => handoff.interactionId))
	);
}

function isBeginInteraction(value: unknown): value is BeginProjectSvgInteraction {
	if (!isRecord(value)) return false;
	if (!exactKeys(value, ['interactionId', 'kind', 'nodeIds', 'claims', 'baseHeads', 'preview'])) {
		return false;
	}
	if (
		!isInteractionFields(value) ||
		!isSvgInteractionKind(value.kind) ||
		value.kind !== value.preview.kind ||
		!isHeads(value.baseHeads)
	) {
		return false;
	}
	if (
		!Array.isArray(value.claims) ||
		value.claims.length === 0 ||
		value.claims.length > MAX_CLAIMS ||
		!value.claims.every(isClaim) ||
		!unique(value.claims.map((claim) => `${claim.nodeId}\u0000${claim.domain}`))
	) {
		return false;
	}
	const expected = svgInteractionClaims(value.kind, value.nodeIds).map(
		(claim) => `${claim.nodeId}\u0000${claim.domain}`
	);
	const actual = value.claims.map((claim) => `${claim.nodeId}\u0000${claim.domain}`);
	return actual.length === expected.length && expected.every((claim) => actual.includes(claim));
}

function isWireInteraction(value: unknown): value is WireInteraction {
	if (!isRecord(value)) return false;
	if (
		!exactKeys(value, ['interactionId', 'pageId', 'documentId', 'nodeIds', 'preview']) ||
		!validId(value.pageId) ||
		!validId(value.documentId)
	) {
		return false;
	}
	return isInteractionFields(value);
}

function isWireHandoff(value: unknown): value is WireHandoff {
	if (!isRecord(value)) return false;
	if (
		!exactKeys(value, [
			'interactionId',
			'pageId',
			'documentId',
			'nodeIds',
			'preview',
			'commitHeads'
		]) ||
		!isHeads(value.commitHeads)
	) {
		return false;
	}
	const { commitHeads: _commitHeads, ...interaction } = value;
	return isWireInteraction(interaction);
}

function isInteractionFields(
	value: Record<string, unknown>
): value is Record<string, unknown> &
	Pick<WireInteraction, 'interactionId' | 'nodeIds' | 'preview'> {
	if (!validId(value.interactionId)) return false;
	if (
		!Array.isArray(value.nodeIds) ||
		value.nodeIds.length === 0 ||
		value.nodeIds.length > MAX_NODE_IDS ||
		!value.nodeIds.every(validId) ||
		!unique(value.nodeIds)
	) {
		return false;
	}
	return isPreview(value.preview);
}

function isClaim(value: unknown): value is SvgClaim {
	return (
		isRecord(value) &&
		exactKeys(value, ['nodeId', 'domain']) &&
		validId(value.nodeId) &&
		isSvgClaimDomain(value.domain)
	);
}

function isPreview(value: unknown): value is SvgInteractionPreview {
	if (!isRecord(value) || !isSvgInteractionKind(value.kind)) return false;
	if (value.kind === 'move') {
		return (
			exactOptionalKeys(value, ['kind', 'delta'], ['bounds']) &&
			isVec(value.delta) &&
			(!('bounds' in value) || isBounds(value.bounds))
		);
	}
	if (value.kind === 'resize') {
		return (
			exactKeys(value, ['kind', 'baseBounds', 'bounds']) &&
			isBounds(value.baseBounds) &&
			isBounds(value.bounds)
		);
	}
	if (value.kind === 'rotate') {
		return (
			exactOptionalKeys(value, ['kind', 'angle', 'pivot'], ['bounds']) &&
			isNumber(value.angle) &&
			isVec(value.pivot) &&
			(!('bounds' in value) || isBounds(value.bounds))
		);
	}
	if (value.kind === 'fill') {
		return exactKeys(value, ['kind', 'paint']) && isPaint(value.paint, 0);
	}
	return exactKeys(value, ['kind', 'stroke']) && isStroke(value.stroke);
}

function isPaint(value: unknown, depth: number): value is Paint {
	if (!isRecord(value) || depth > 4) return false;
	if (value.kind === 'none') return exactKeys(value, ['kind']);
	if (value.kind === 'color' || value.kind === 'raw') {
		return exactKeys(value, ['kind', 'value']) && validText(value.value);
	}
	if (value.kind !== 'resource') return false;
	return (
		exactOptionalKeys(value, ['kind', 'sourceId', 'resourceId'], ['fallback']) &&
		validId(value.sourceId) &&
		(value.resourceId === null || validId(value.resourceId)) &&
		(!('fallback' in value) || isPaint(value.fallback, depth + 1))
	);
}

function isStroke(value: unknown): value is Stroke {
	if (!isRecord(value)) return false;
	if (
		!exactOptionalKeys(
			value,
			[],
			['paint', 'width', 'lineCap', 'lineJoin', 'miterLimit', 'dashArray', 'dashOffset']
		)
	) {
		return false;
	}
	if ('paint' in value && !isPaint(value.paint, 0)) return false;
	if ('width' in value && !isNumber(value.width)) return false;
	if ('miterLimit' in value && !isNumber(value.miterLimit)) return false;
	if ('dashOffset' in value && !isNumber(value.dashOffset)) return false;
	if (
		'lineCap' in value &&
		(typeof value.lineCap !== 'string' || !['butt', 'round', 'square'].includes(value.lineCap))
	)
		return false;
	if (
		'lineJoin' in value &&
		(typeof value.lineJoin !== 'string' || !['miter', 'round', 'bevel'].includes(value.lineJoin))
	)
		return false;
	if ('dashArray' in value && value.dashArray !== 'none') {
		if (!Array.isArray(value.dashArray) || value.dashArray.length > 256) return false;
		if (!value.dashArray.every(isNumber)) return false;
	}
	return true;
}

function isVec(value: unknown): boolean {
	return isRecord(value) && exactKeys(value, ['x', 'y']) && isNumber(value.x) && isNumber(value.y);
}

function isBounds(value: unknown): boolean {
	return (
		isRecord(value) &&
		exactKeys(value, ['x', 'y', 'width', 'height']) &&
		isNumber(value.x) &&
		isNumber(value.y) &&
		isNumber(value.width) &&
		isNumber(value.height)
	);
}

function isHeads(value: unknown): value is UrlHeads {
	if (
		!Array.isArray(value) ||
		value.length > MAX_HEADS ||
		!value.every(validId) ||
		!unique(value)
	) {
		return false;
	}
	try {
		decodeHeads(value as UrlHeads);
		return true;
	} catch {
		return false;
	}
}

function isRevision(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_NUMBER;
}

function validId(value: unknown): value is string {
	if (typeof value !== 'string' || value.length === 0 || value.length > MAX_ID_LENGTH) return false;
	return !Array.from(value).some((character) => {
		const code = character.charCodeAt(0);
		return code <= 31 || code === 127;
	});
}

function validText(value: unknown): value is string {
	return typeof value === 'string' && value.length <= MAX_TEXT_LENGTH;
}

function unique(values: string[]): boolean {
	return new Set(values).size === values.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
	return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

function exactOptionalKeys(
	value: Record<string, unknown>,
	required: string[],
	optional: string[]
): boolean {
	const allowed = new Set([...required, ...optional]);
	return (
		required.every((key) => key in value) && Object.keys(value).every((key) => allowed.has(key))
	);
}
