<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		playtestRoomHref,
		setPlaytestReconnectToken,
		setPlaytestRoomPassword
	} from '$lib/play/playtest-room-helpers';
	import type { LobbyRoom } from '$lib/play/room-types';
	import { Client, type RoomAvailable } from '@colyseus/sdk';
	import type { BoardGameRoomState } from 'boardgame-server/src/rooms/schema/MyRoomState';
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';
	import CreateRoomModal from './create-room-modal.svelte';

	type PlaytestRoomMetadata = {
		privateRoomId: string;
		playtestId: string;
		roomName: string;
		phase: 'lobby' | 'playing';
		playerCount: number;
		minPlayers: number;
		maxPlayers: number;
		isFull: boolean;
		hasPassword: boolean;
	};

	let { data }: PageProps = $props();
	let rooms = $state<RoomAvailable<PlaytestRoomMetadata>[]>([]);
	let selectedRoom = $state<RoomAvailable<PlaytestRoomMetadata> | null>(null);
	let joinRoomOpen = $state(false);
	let joinPassword = $state('');
	let errorMessage = $state('');
	let lobby: LobbyRoom | null = null;
	const e2e = $derived(page.url.searchParams.has('e2e'));
	const gameServerUrl = env.PUBLIC_GAME_SERVER_URL;

	function setRooms(nextRooms: RoomAvailable<PlaytestRoomMetadata>[]) {
		rooms = nextRooms
			.filter((room) => room.metadata?.phase === 'lobby' && room.metadata.isFull === false)
			.sort((a, b) => (a.metadata?.roomName ?? '').localeCompare(b.metadata?.roomName ?? ''));
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

	async function createRoom(name: string, password?: string) {
		const trimmedRoomName = name.trim().replace(/\s+/g, ' ');
		const trimmedPassword = password?.trim();
		if (!trimmedRoomName) {
			errorMessage = 'Enter a room name.';
			return;
		}
		if (!gameServerUrl) {
			errorMessage = 'Game server URL is not configured.';
			return;
		}

		errorMessage = '';
		try {
			const client = new Client(gameServerUrl);
			client.auth.token = await getGameTicket();
			const room = await client.create<BoardGameRoomState>('private_room', {
				privateRoomId: data.privateRoomId,
				playtestId: data.playtestId,
				roomName: trimmedRoomName,
				password: trimmedPassword || undefined,
				minPlayers: data.minPlayers,
				maxPlayers: data.maxPlayers
			});
			if (trimmedPassword) {
				setPlaytestRoomPassword(data.privateRoomId, room.roomId, trimmedPassword);
			}
			setPlaytestReconnectToken(data.privateRoomId, room.roomId, room.reconnectionToken);
			room.reconnection.enabled = false;
			void room.leave(false);
			await goto(
				resolve(playtestRoomHref({ playtestId: data.playtestId, roomId: room.roomId, e2e }))
			);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not create room.';
		}
	}

	async function joinRoom(room: RoomAvailable<PlaytestRoomMetadata>) {
		const href = playtestRoomHref({ playtestId: data.playtestId, roomId: room.roomId, e2e });
		if (room.metadata?.hasPassword) {
			selectedRoom = room;
			joinPassword = '';
			joinRoomOpen = true;
			return;
		}
		await goto(resolve(href));
	}

	async function joinSelectedRoom() {
		if (!selectedRoom) return;
		setPlaytestRoomPassword(data.privateRoomId, selectedRoom.roomId, joinPassword);
		await goto(
			resolve(playtestRoomHref({ playtestId: data.playtestId, roomId: selectedRoom.roomId, e2e }))
		);
	}

	onMount(async () => {
		if (!gameServerUrl) {
			errorMessage = 'Game server URL is not configured.';
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

		<CreateRoomModal
			onSubmit={createRoom}
			title="Create Room"
			actionName="Create Room"
			creatingName="Creating..."
		/>

		{#if errorMessage}
			<p class="text-destructive text-sm" role="alert">{errorMessage}</p>
		{/if}

		<section class="flex flex-col gap-3" aria-label="Open rooms">
			{#each rooms as room (room.roomId)}
				{@const metadata = room.metadata}
				<button
					type="button"
					onclick={() => void joinRoom(room)}
					class="hover:bg-accent flex items-center justify-between gap-4 rounded-lg border p-4 text-left"
				>
					<span class="flex min-w-0 flex-col gap-1">
						<span class="truncate font-medium">{metadata?.roomName ?? 'Room'}</span>
						<span class="text-muted-foreground text-sm">
							{metadata?.playerCount ?? room.clients} / {metadata?.maxPlayers ?? room.maxClients}
							players{metadata?.hasPassword ? ' · Password required' : ''}
						</span>
					</span>
					<span class="text-primary text-sm font-medium">Join</span>
				</button>
			{/each}
		</section>

		<Dialog.Root bind:open={joinRoomOpen}>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Enter room password</Dialog.Title>
					<Dialog.Description>
						{selectedRoom?.metadata?.roomName ?? 'This room'} requires a password to join.
					</Dialog.Description>
				</Dialog.Header>
				<form
					class="flex flex-col gap-4"
					onsubmit={(event) => {
						event.preventDefault();
						void joinSelectedRoom();
					}}
				>
					<label class="text-sm font-medium" for="join-room-password">Password</label>
					<Input
						id="join-room-password"
						type="password"
						bind:value={joinPassword}
						autocomplete="current-password"
					/>
					<Dialog.Footer>
						<Dialog.Close>
							{#snippet child({ props })}
								<Button {...props} variant="outline">Cancel</Button>
							{/snippet}
						</Dialog.Close>
						<Button type="submit">Join room</Button>
					</Dialog.Footer>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	</div>
</main>
