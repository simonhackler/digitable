import { type AuthContext, type Client, ServerError } from 'colyseus';
import { verifyAndConsumeGameTicket } from '@svg-table/db/tickets';

import { CommandRoom } from './command-room';
import type { RoomPhase } from './schema/MyRoomState';

const PRIVATE_ROOM_RECONNECTION_SECONDS = 60;
const MAX_PLAYERS = 20;

type JoinOptions = {
	privateRoomId?: string;
	playtestId?: string;
	roomName?: string;
	password?: string;
	minPlayers?: number;
	maxPlayers?: number;
};

type PrivateRoomAuth = {
	userId: string;
	privateRoomId: string;
	role: string;
	name: string;
};

type PrivateRoomMetadata = {
	privateRoomId: string;
	playtestId: string;
	roomName: string;
	phase: RoomPhase;
	playerCount: number;
	minPlayers: number;
	maxPlayers: number;
	isFull: boolean;
	hasPassword: boolean;
};

type PrivateCommandRoomClient = Client<{ auth: PrivateRoomAuth }>;

function requirePlayerLimit(value: number | undefined, label: string) {
	if (!Number.isInteger(value) || value < 1 || value > MAX_PLAYERS) {
		throw new ServerError(400, `${label} must be an integer from 1 to ${MAX_PLAYERS}`);
	}
	return value;
}

function normalizeRoomName(value: string | undefined) {
	const roomName = value?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? '';
	if (!roomName) {
		throw new ServerError(400, 'Missing roomName');
	}
	return roomName;
}

function normalizePassword(value: string | undefined) {
	return value?.trim() ?? '';
}

export class PrivateCommandRoom extends CommandRoom<PrivateRoomMetadata, PrivateRoomAuth> {
	private privateRoomId = '';
	private playtestId = '';
	private password = '';

	static async onAuth(
		token: string,
		options: JoinOptions,
		_context: AuthContext
	): Promise<PrivateRoomAuth> {
		if (!options.privateRoomId) {
			throw new ServerError(400, 'Missing privateRoomId');
		}

		if (!token) {
			throw new ServerError(401, 'Missing game ticket');
		}

		const ticket = await verifyAndConsumeGameTicket({
			token,
			expectedPrivateRoomId: options.privateRoomId
		});

		if (!ticket) {
			throw new ServerError(401, 'Invalid game ticket');
		}

		return ticket;
	}

	async onCreate(options: JoinOptions = {}) {
		if (!options.privateRoomId) {
			throw new ServerError(400, 'Missing privateRoomId');
		}
		if (!options.playtestId) {
			throw new ServerError(400, 'Missing playtestId');
		}

		this.privateRoomId = options.privateRoomId;
		this.playtestId = options.playtestId;
		const minPlayers = requirePlayerLimit(options.minPlayers, 'minPlayers');
		const maxPlayers = requirePlayerLimit(options.maxPlayers, 'maxPlayers');
		if (maxPlayers < minPlayers) {
			throw new ServerError(400, 'maxPlayers must be greater than or equal to minPlayers');
		}
		const roomName = normalizeRoomName(options.roomName);
		this.password = normalizePassword(options.password);
		this.maxClients = maxPlayers;

		super.onCreate();
		this.state.phase = 'lobby';
		this.state.roomName = roomName;
		this.state.minPlayers = minPlayers;
		this.state.maxPlayers = maxPlayers;

		await this.updateListingMetadata();
	}

	onJoin(client: PrivateCommandRoomClient, options: JoinOptions, auth?: PrivateRoomAuth) {
		if (!auth) {
			throw new ServerError(401, 'Missing private room auth');
		}

		if (options.privateRoomId !== this.privateRoomId || auth.privateRoomId !== this.privateRoomId) {
			throw new ServerError(403, 'Invalid private room');
		}
		if (this.password && normalizePassword(options.password) !== this.password) {
			throw new ServerError(403, 'Invalid room password');
		}

		const previousSessionId = this.sessionIdForUser(auth.userId);
		if (this.state.phase === 'playing' && !previousSessionId) {
			throw new ServerError(403, 'Playtest already started');
		}

		client.auth = auth;
		if (previousSessionId && previousSessionId !== client.sessionId) {
			this.movePlayerSession(previousSessionId, client.sessionId);
		}
		super.onJoin(client, options);
	}

	onLeave(client: PrivateCommandRoomClient) {
		if (this.state.phase === 'playing') {
			void this.onLobbyChanged();
			return;
		}

		super.onLeave(client);
	}

	async onDrop(client: PrivateCommandRoomClient) {
		try {
			await this.allowReconnection(client, PRIVATE_ROOM_RECONNECTION_SECONDS);
		} catch {
			// Reconnection window expired.
		}
	}

	async onLobbyChanged() {
		if (this.state.phase === 'playing') {
			// Participant access is enforced by userId after start; extra transport seats allow rejoin
			// to replace stale sessions or reconnection reservations.
			this.maxClients = MAX_PLAYERS;
			this.autoDispose = false;
		}
		await this.updateListingMetadata();
	}

	private sessionIdForUser(userId: string) {
		for (const [sessionId, player] of this.state.players.entries()) {
			if (player.userId === userId) return sessionId;
		}

		return null;
	}

	private movePlayerSession(previousSessionId: string, nextSessionId: string) {
		const player = this.state.players.get(previousSessionId);
		if (!player) return;

		this.state.players.delete(previousSessionId);
		player.id = nextSessionId;
		this.state.players.set(nextSessionId, player);

		for (const component of this.state.components.values()) {
			if (component.owner === previousSessionId) {
				component.owner = nextSessionId;
			}
		}
	}

	private async updateListingMetadata() {
		const playerCount = this.state.players.size;
		await this.setMetadata({
			privateRoomId: this.privateRoomId,
			playtestId: this.playtestId,
			roomName: this.state.roomName,
			phase: this.state.phase,
			playerCount,
			minPlayers: this.state.minPlayers,
			maxPlayers: this.state.maxPlayers,
			isFull: playerCount >= this.state.maxPlayers,
			hasPassword: Boolean(this.password)
		});
	}
}
