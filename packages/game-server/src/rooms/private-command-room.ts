import { type AuthContext, Client, ServerError } from 'colyseus';
import { verifyAndConsumeGameTicket } from '@svg-table/db/tickets';

import { CommandRoom } from './command-room';

type JoinOptions = {
	privateRoomId?: string;
};

type PrivateRoomAuth = {
	userId: string;
	privateRoomId: string;
	role: string;
};

export class PrivateCommandRoom extends CommandRoom {
	private privateRoomId = '';

	async onCreate(options: JoinOptions = {}) {
		if (!options.privateRoomId) {
			throw new ServerError(400, 'Missing privateRoomId');
		}

		this.privateRoomId = options.privateRoomId;
		super.onCreate();

		await this.setMetadata({
			privateRoomId: this.privateRoomId
		});
		await this.setPrivate(true);
	}

	async onAuth(
		_client: Client,
		options: JoinOptions,
		context: AuthContext
	): Promise<PrivateRoomAuth> {
		if (!options.privateRoomId || options.privateRoomId !== this.privateRoomId) {
			throw new ServerError(400, 'Invalid privateRoomId');
		}

		if (!context.token) {
			throw new ServerError(401, 'Missing game ticket');
		}

		const ticket = await verifyAndConsumeGameTicket({
			token: context.token,
			expectedPrivateRoomId: options.privateRoomId
		});

		if (!ticket) {
			throw new ServerError(401, 'Invalid game ticket');
		}

		return ticket;
	}

	onJoin(client: Client<unknown, PrivateRoomAuth>, options: JoinOptions, auth?: PrivateRoomAuth) {
		if (auth) {
			client.auth = auth;
		}
		super.onJoin(client, options);
	}
}
