import { type AuthContext, type Client, ServerError } from 'colyseus';
import { verifyAndConsumeGameTicket } from '@svg-table/db/tickets';

import { CommandRoom } from './command-room';
import type { RoomPhase } from './schema/MyRoomState';

const PRIVATE_ROOM_RECONNECTION_SECONDS = 60;

type JoinOptions = {
	privateRoomId?: string;
	playtestId?: string;
	roomName?: string;
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
};

type PrivateCommandRoomClient = Client<{ auth: PrivateRoomAuth }>;

function normalizePlayerLimit(value: number | undefined, fallback: number) {
	if (!Number.isInteger(value) || value < 1 || value > 20) return fallback;
	return value;
}

function normalizeRoomName(value: string | undefined) {
	const roomName = value?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? '';
	if (!roomName) {
		throw new ServerError(400, 'Missing roomName');
	}
	return roomName;
}

export class PrivateCommandRoom extends CommandRoom<PrivateRoomMetadata, PrivateRoomAuth> {
	private privateRoomId = '';
	private playtestId = '';

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
		const minPlayers = normalizePlayerLimit(options.minPlayers, 1);
		const maxPlayers = Math.max(minPlayers, normalizePlayerLimit(options.maxPlayers, 4));
		const roomName = normalizeRoomName(options.roomName);
		this.maxClients = maxPlayers;

		super.onCreate();
		this.state.phase = 'lobby';
		this.state.roomName = roomName;
		this.state.minPlayers = minPlayers;
		this.state.maxPlayers = maxPlayers;

		await this.updateListingMetadata();
	}

	onJoin(client: PrivateCommandRoomClient, options: JoinOptions, auth?: PrivateRoomAuth) {
		if (auth) {
			client.auth = auth;
		}
		super.onJoin(client, options);
	}

	async onDrop(client: PrivateCommandRoomClient) {
		try {
			await this.allowReconnection(client, PRIVATE_ROOM_RECONNECTION_SECONDS);
		} catch {
			// Reconnection window expired.
		}
	}

	async onLobbyChanged() {
		if (this.state.phase === 'playing' && !this.locked) {
			await this.lock();
		}
		await this.updateListingMetadata();
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
			isFull: playerCount >= this.state.maxPlayers
		});
	}
}
