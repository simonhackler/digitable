<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import type { LobbyRoom } from '$lib/play/room-types';
	import { Client, type RoomAvailable } from '@colyseus/sdk';
	import type { BoardGameRoomState } from 'boardgame-server/src/rooms/schema/MyRoomState';
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';

	type PlaytestRoomMetadata = {
		privateRoomId: string;
		playtestId: string;
		roomName: string;
		phase: 'lobby' | 'playing';
		playerCount: number;
		minPlayers: number;
		maxPlayers: number;
		isFull: boolean;
	};

	let { data }: PageProps = $props();
	let rooms = $state<RoomAvailable<PlaytestRoomMetadata>[]>([]);
	let roomName = $state('');
	let status = $state('Loading rooms...');
	let errorMessage = $state('');
	let creating = $state(false);
	let lobby: LobbyRoom | null = null;
	const e2e = $derived(page.url.searchParams.has('e2e'));
	const gameServerUrl = env.PUBLIC_GAME_SERVER_URL;
	const reconnectTokenPrefix = 'svg-table:playtest-reconnect-token:';

	function reconnectTokenKey(roomId: string) {
		return `${reconnectTokenPrefix}${data.privateRoomId}:${roomId}`;
	}

	function setRooms(nextRooms: RoomAvailable<PlaytestRoomMetadata>[]) {
		rooms = nextRooms
			.filter((room) => room.metadata?.phase === 'lobby' && room.metadata.isFull === false)
			.sort((a, b) => (a.metadata?.roomName ?? '').localeCompare(b.metadata?.roomName ?? ''));
		status = rooms.length === 0 ? 'No open rooms yet.' : '';
	}

	async function getGameTicket() {
		const response = await fetch(resolve('/api/game-ticket'), {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({ privateRoomId: data.privateRoomId })
		});

		if (!response.ok) {
			throw new Error(await response.text());
		}

		const { ticket } = (await response.json()) as { ticket: string };
		return ticket;
	}

	async function createRoom() {
		const trimmedRoomName = roomName.trim().replace(/\s+/g, ' ');
		if (!trimmedRoomName) {
			errorMessage = 'Enter a room name.';
			return;
		}
		if (!gameServerUrl) {
			errorMessage = 'Game server URL is not configured.';
			return;
		}

		creating = true;
		errorMessage = '';
		try {
			const client = new Client(gameServerUrl);
			client.auth.token = await getGameTicket();
			const room = await client.create<BoardGameRoomState>('private_room', {
				privateRoomId: data.privateRoomId,
				playtestId: data.playtestId,
				roomName: trimmedRoomName,
				minPlayers: data.minPlayers,
				maxPlayers: data.maxPlayers
			});
			sessionStorage.setItem(reconnectTokenKey(room.roomId), room.reconnectionToken);
			room.reconnection.enabled = false;
			void room.leave(false);
			await goto(
				resolve('/playtests/[playtestId]/rooms/[roomId]', {
					playtestId: data.playtestId,
					roomId: e2e ? `${room.roomId}?e2e=1` : room.roomId
				})
			);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not create room.';
		} finally {
			creating = false;
		}
	}

	onMount(async () => {
		if (!gameServerUrl) {
			errorMessage = 'Game server URL is not configured.';
			status = '';
			return;
		}

		try {
			const client = new Client(gameServerUrl);
			lobby = await client.joinOrCreate('lobby', {
				filter: {
					name: 'private_room',
					metadata: {
						playtestId: data.playtestId,
						phase: 'lobby',
						isFull: false
					}
				}
			});

			lobby.onMessage<RoomAvailable<PlaytestRoomMetadata>[]>('rooms', setRooms);
			lobby.onMessage<[string, RoomAvailable<PlaytestRoomMetadata>]>('+', ([roomId, room]) => {
				const existingIndex = rooms.findIndex((candidate) => candidate.roomId === roomId);
				const nextRooms =
					existingIndex === -1
						? [...rooms, room]
						: rooms.map((candidate, index) => (index === existingIndex ? room : candidate));
				setRooms(nextRooms);
			});
			lobby.onMessage<string>('-', (roomId) => {
				setRooms(rooms.filter((room) => room.roomId !== roomId));
			});
		} catch (error) {
			status = '';
			errorMessage = error instanceof Error ? error.message : 'Could not load rooms.';
		}
	});

	onDestroy(() => {
		void lobby?.leave();
	});
</script>

<main class="bg-background min-h-screen px-4 py-8 sm:px-6 lg:px-8">
	<div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
		<header class="flex flex-col gap-2">
			<p class="text-muted-foreground text-sm">Playtest</p>
			<h1 class="text-2xl font-semibold sm:text-3xl">Rooms for {data.projectName}</h1>
			<p class="text-muted-foreground text-sm">
				{data.minPlayers}-{data.maxPlayers} players per room
			</p>
		</header>

		<form
			class="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row"
			onsubmit={(event) => {
				event.preventDefault();
				void createRoom();
			}}
		>
			<label class="flex flex-1 flex-col gap-1 text-sm font-medium">
				Room name
				<input
					class="border-input bg-background rounded-md border px-3 py-2 text-sm"
					bind:value={roomName}
					maxlength="80"
					placeholder="Friday test"
				/>
			</label>
			<button
				type="submit"
				disabled={creating}
				class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:pointer-events-none disabled:opacity-50 sm:self-end"
			>
				{creating ? 'Creating...' : 'Create room'}
			</button>
		</form>

		{#if errorMessage}
			<p class="text-destructive text-sm" role="alert">{errorMessage}</p>
		{/if}

		<section class="flex flex-col gap-3" aria-label="Open rooms">
			{#if status}
				<p class="text-muted-foreground text-sm">{status}</p>
			{/if}

			{#each rooms as room (room.roomId)}
				{@const metadata = room.metadata}
				<a
					href={resolve('/playtests/[playtestId]/rooms/[roomId]', {
						playtestId: data.playtestId,
						roomId: e2e ? `${room.roomId}?e2e=1` : room.roomId
					})}
					class="hover:bg-accent flex items-center justify-between gap-4 rounded-lg border p-4"
				>
					<span class="flex min-w-0 flex-col gap-1">
						<span class="truncate font-medium">{metadata?.roomName ?? 'Room'}</span>
						<span class="text-muted-foreground text-sm">
							{metadata?.playerCount ?? room.clients} / {metadata?.maxPlayers ?? room.maxClients}
							players
						</span>
					</span>
					<span class="text-primary text-sm font-medium">Join</span>
				</a>
			{/each}
		</section>
	</div>
</main>
