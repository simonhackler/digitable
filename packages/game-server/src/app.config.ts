import config from '@colyseus/tools';
import { monitor } from '@colyseus/monitor';
import { playground } from '@colyseus/playground';
import { LobbyRoom } from 'colyseus';
import { createRequire } from 'node:module';

/**
 * Import your Room files
 */
import { CommandRoom } from './rooms/command-room';
import { PrivateCommandRoom } from './rooms/private-command-room';

const requireFromHere = createRequire(import.meta.url);
const requireFromColyseusCore = createRequire(
	requireFromHere.resolve('@colyseus/core/package.json')
);
// Bun can install a second @colyseus/core peer for ws-transport; load it from core's context.
const { WebSocketTransport } = requireFromColyseusCore(
	'@colyseus/ws-transport'
) as typeof import('@colyseus/ws-transport');

export default config({
	initializeTransport: (options) => {
		return new WebSocketTransport(options);
	},

	initializeGameServer: (gameServer) => {
		/**
		 * Define your room handlers:
		 */
		gameServer.define('lobby', LobbyRoom);
		gameServer.define('my_room', CommandRoom);
		gameServer
			.define('private_room', PrivateCommandRoom)
			.filterBy(['privateRoomId'])
			.enableRealtimeListing();
	},

	initializeExpress: (app) => {
		app.use((req, res, next) => {
			const allowedOrigins = [process.env.WEB_ORIGIN, process.env.SECOND_WEB_ORIGIN].filter(
				Boolean
			);
			const origin = req.headers.origin;

			if (origin && allowedOrigins.includes(origin)) {
				res.setHeader('Access-Control-Allow-Origin', origin);
				res.setHeader('Vary', 'Origin');
			}

			res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
			res.setHeader(
				'Access-Control-Allow-Headers',
				req.headers['access-control-request-headers'] || 'Content-Type'
			);

			if (req.method === 'OPTIONS') {
				res.sendStatus(204);
				return;
			}

			next();
		});

		/**
		 * Bind your custom express routes here:
		 * Read more: https://expressjs.com/en/starter/basic-routing.html
		 */
		app.get('/hello_world', (_req, res) => {
			res.send("It's time to kick ass and chew bubblegum!");
		});

		/**
		 * Use @colyseus/playground
		 * (It is not recommended to expose this route in a production environment)
		 */
		if (process.env.NODE_ENV !== 'production') {
			app.use('/', playground());
		}

		/**
		 * Use @colyseus/monitor
		 * It is recommended to protect this route with a password
		 * Read more: https://docs.colyseus.io/tools/monitor/#restrict-access-to-the-panel-using-a-password
		 */
		app.use('/monitor', monitor());
	},

	beforeListen: () => {
		/**
		 * Before before gameServer.listen() is called.
		 */
	}
});
