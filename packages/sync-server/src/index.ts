import { createServer } from 'node:http';
import { Repo } from '@automerge/automerge-repo';
import { WebSocketServerAdapter } from '@automerge/automerge-repo-network-websocket';
import { NodeFSStorageAdapter } from '@automerge/automerge-repo-storage-nodefs';
import { WebSocketServer } from 'ws';

const port = Number(process.env.PORT ?? '3030');
const dataDir = process.env.AUTOMERGE_DATA_DIR ?? 'automerge-sync-data';
const origin = process.env.AUTOMERGE_SYNC_ORIGIN;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
	throw new Error('PORT must be a valid TCP port.');
}

if (!origin) {
	throw new Error('AUTOMERGE_SYNC_ORIGIN must be configured.');
}

const sockets = new WebSocketServer({ noServer: true });
const repo = new Repo({
	storage: new NodeFSStorageAdapter(dataDir),
	network: [new WebSocketServerAdapter(sockets)],
	// Clients request known document IDs; never reveal every stored document to a new peer.
	shareConfig: {
		announce: async () => false,
		access: async () => true
	}
});
const server = createServer((_, response) => {
	response.writeHead(404);
	response.end();
});

server.on('upgrade', (request, socket, head) => {
	const path = new URL(request.url ?? '/', 'http://localhost').pathname;
	if (path !== '/app/sync' || request.headers.origin !== origin) {
		socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
		socket.destroy();
		return;
	}

	sockets.handleUpgrade(request, socket, head, (webSocket) => {
		sockets.emit('connection', webSocket, request);
	});
});

server.listen(port, '127.0.0.1');

let stopping = false;
async function stop() {
	if (stopping) return;
	stopping = true;
	sockets.close();
	server.close();
	await repo.shutdown();
}

process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
