const POINTER_DISABLED_ROUTES = new Set(['/games/[gameName]/play']);

export type PresencePage = {
	id: string;
	pointerEnabled: boolean;
};

export function projectPresencePage(
	routeId: string | null,
	params: Record<string, string | undefined>
): PresencePage {
	const route = routeId ?? 'unknown';
	const values = Object.entries(params)
		.filter((entry): entry is [string, string] => entry[1] !== undefined)
		.sort(([left], [right]) => left.localeCompare(right));
	return {
		id: JSON.stringify([route, values]),
		pointerEnabled: !POINTER_DISABLED_ROUTES.has(route)
	};
}

export function peersOnProjectPages<T extends { pageId: string | null }>(
	peers: T[],
	routeIds: string | string[],
	params: Record<string, string | undefined>
): T[] {
	const routes = typeof routeIds === 'string' ? [routeIds] : routeIds;
	const pageIds = new Set(routes.map((routeId) => projectPresencePage(routeId, params).id));
	return peers.filter((peer) => peer.pageId !== null && pageIds.has(peer.pageId));
}
