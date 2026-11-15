import {
	isValidAutomergeUrl,
	parseAutomergeUrl,
	type AutomergeUrl,
	type NetworkAdapterInterface
} from '@automerge/automerge-repo';
import { BroadcastChannelNetworkAdapter } from '@automerge/automerge-repo-network-broadcastchannel';
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import { Ok, trySync } from 'wellcrafted/result';

export type ProjectInvitation =
	| { state: 'none' }
	| { state: 'invalid' }
	| { state: 'valid'; historyUrl: AutomergeUrl };

export function parseProjectInvitation(value: string): ProjectInvitation {
	const input = value.trim();
	if (!input || input === '#') return { state: 'none' };

	let candidate = input;
	if (!candidate.startsWith('automerge:')) {
		const parsed = URL.parse(candidate, 'https://digitable.local');
		if (!parsed?.hash) return { state: 'invalid' };
		candidate = parsed.hash.slice(1);
	}

	const { data: decoded } = trySync({
		try: () => decodeURIComponent(candidate),
		catch: () => Ok(null)
	});
	if (!decoded) return { state: 'invalid' };
	if (!isValidAutomergeUrl(decoded)) return { state: 'invalid' };
	const parsed = parseAutomergeUrl(decoded);
	if (parsed.segments?.length || parsed.heads !== undefined) return { state: 'invalid' };
	return { state: 'valid', historyUrl: decoded };
}

export function buildProjectShareUrl(
	historyUrl: AutomergeUrl,
	currentUrl: string,
	joinPath: string
): string {
	const url = new URL(joinPath, currentUrl);
	url.hash = historyUrl;
	return url.toString();
}

export function createProjectNetwork(currentUrl: string, authenticated: boolean) {
	const network: NetworkAdapterInterface[] = [new BroadcastChannelNetworkAdapter()];
	if (!authenticated) return network;

	const url = new URL('/app/sync', currentUrl);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	network.push(new WebSocketClientAdapter(url.href));
	return network;
}
