import type { Room } from '@colyseus/sdk';
import type { BoardGameRoomState } from 'boardgame-server/src/rooms/schema/MyRoomState';

export type PlayRoom = Room<unknown, BoardGameRoomState>;
export type LobbyRoom = Room<unknown, unknown>;
