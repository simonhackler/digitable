import { resolve } from '$app/paths';

const reconnectTokenPrefix = 'svg-table:playtest-reconnect-token:';
const roomPasswordPrefix = 'svg-table:playtest-room-password:';

export function playtestRoomHref(input: { playtestId: string; roomId: string; e2e?: boolean }) {
	const path = resolve('/playtests/[playtestId]/rooms/[roomId]', {
		playtestId: input.playtestId,
		roomId: input.roomId
	});

	return input.e2e ? `${path}?e2e=1` : path;
}

function playtestReconnectTokenKey(privateRoomId: string, roomId: string) {
	return `${reconnectTokenPrefix}${privateRoomId}:${roomId}`;
}

function playtestRoomPasswordKey(privateRoomId: string, roomId: string) {
	return `${roomPasswordPrefix}${privateRoomId}:${roomId}`;
}

export function getPlaytestReconnectToken(privateRoomId: string, roomId: string) {
	if (typeof sessionStorage === 'undefined') return null;
	return sessionStorage.getItem(playtestReconnectTokenKey(privateRoomId, roomId));
}

export function setPlaytestReconnectToken(privateRoomId: string, roomId: string, token: string) {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.setItem(playtestReconnectTokenKey(privateRoomId, roomId), token);
}

export function clearPlaytestReconnectToken(privateRoomId: string, roomId: string) {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.removeItem(playtestReconnectTokenKey(privateRoomId, roomId));
}

export function getPlaytestRoomPassword(privateRoomId: string, roomId: string) {
	if (typeof sessionStorage === 'undefined') return null;
	return sessionStorage.getItem(playtestRoomPasswordKey(privateRoomId, roomId));
}

export function setPlaytestRoomPassword(privateRoomId: string, roomId: string, password: string) {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.setItem(playtestRoomPasswordKey(privateRoomId, roomId), password);
}

export function clearPlaytestRoomPassword(privateRoomId: string, roomId: string) {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.removeItem(playtestRoomPasswordKey(privateRoomId, roomId));
}
