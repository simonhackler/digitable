<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import type { FsDir } from '$lib/components/file-browser/adapters/adapter';
	import { OPFSAdapter } from '$lib/components/file-browser/adapters/opfs/opdfs-adapter';
	import PlaySurface from '$lib/play/PlaySurface.svelte';
	import type { PlayRoom } from '$lib/play/room-types';
	import { importPlaytestProject, playtestImportFolderName } from '$lib/playtests/project-transfer';
	import { Client, getStateCallbacks } from '@colyseus/sdk';
	import type { BoardGameRoomState } from 'boardgame-server/src/rooms/schema/MyRoomState';
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';

	type LobbyPlayer = {
		id: string;
		name: string;
		ready: boolean;
	};

	let { data }: PageProps = $props();
	let status = $state('Joining room...');
	let failure = $state<string | null>(null);
	let room = $state<PlayRoom | null>(null);
	let roomName = $state('Room');
	let phase = $state<'lobby' | 'playing'>('lobby');
	let players = $state<LobbyPlayer[]>([]);
	let importedPlaytest = $state<{
		projectName: string;
		privateRoomId: string;
		roomId: string;
		fileSystem: FsDir;
	} | null>(null);
	let playReady = $state(false);
	let transitioningToPlay = false;
	const e2e = $derived(page.url.searchParams.has('e2e'));
	const gameServerUrl = env.PUBLIC_GAME_SERVER_URL;
	const reconnectTokenPrefix = 'svg-table:playtest-reconnect-token:';
	const currentPlayer = $derived(players.find((player) => player.id === room?.sessionId) ?? null);
	const readyCount = $derived(players.filter((player) => player.ready).length);
	const canReady = $derived(phase === 'lobby' && Boolean(currentPlayer) && !currentPlayer?.ready);

	function reconnectTokenKey() {
		return `${reconnectTokenPrefix}${data.privateRoomId}:${data.roomId}`;
	}

	function getReconnectToken() {
		if (typeof sessionStorage === 'undefined') return null;
		return sessionStorage.getItem(reconnectTokenKey());
	}

	function setReconnectToken(playRoom: PlayRoom) {
		if (typeof sessionStorage === 'undefined') return;
		sessionStorage.setItem(reconnectTokenKey(), playRoom.reconnectionToken);
	}

	function clearReconnectToken() {
		if (typeof sessionStorage === 'undefined') return;
		sessionStorage.removeItem(reconnectTokenKey());
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

	function refreshLobbyState(playRoom: PlayRoom) {
		phase = playRoom.state.phase ?? phase;
		roomName = playRoom.state.roomName || roomName;
		if (playRoom.state.players) {
			players = Array.from(playRoom.state.players.values()).map((player) => ({
				id: player.id,
				name: player.name,
				ready: player.ready
			}));
		}
		if (phase === 'lobby') {
			status =
				players.length < data.minPlayers
					? `Waiting for ${data.minPlayers - players.length} more player${
							data.minPlayers - players.length === 1 ? '' : 's'
						}...`
					: 'Waiting for everyone to ready up...';
		}
		void enterPlayIfReady();
	}

	async function connectRoom() {
		if (!gameServerUrl) {
			throw new Error('Game server URL is not configured.');
		}

		const client = new Client(gameServerUrl);
		let playRoom: PlayRoom | null = null;
		const reconnectToken = getReconnectToken();
		if (reconnectToken) {
			try {
				playRoom = await client.reconnect<BoardGameRoomState>(reconnectToken);
			} catch {
				clearReconnectToken();
			}
		}

		if (!playRoom) {
			client.auth.token = await getGameTicket();
			playRoom = await client.joinById<BoardGameRoomState>(data.roomId, {
				privateRoomId: data.privateRoomId
			});
		}

		room = playRoom;
		setReconnectToken(playRoom);
		const callbacks = getStateCallbacks(playRoom);
		callbacks(playRoom.state).onChange(() => refreshLobbyState(playRoom));
		callbacks(playRoom.state).players.onAdd((player) => {
			callbacks(player).onChange(() => refreshLobbyState(playRoom));
			refreshLobbyState(playRoom);
		});
		callbacks(playRoom.state).players.onRemove(() => refreshLobbyState(playRoom));
		refreshLobbyState(playRoom);
	}

	async function importProject() {
		const fsDir = await OPFSAdapter.create();
		const folderName = playtestImportFolderName(data.projectName, data.playtestId);
		status = 'Saving playtest locally...';
		await importPlaytestProject(fsDir, folderName, data.files);

		importedPlaytest = {
			projectName: folderName,
			privateRoomId: data.privateRoomId,
			roomId: data.roomId,
			fileSystem: fsDir
		};
		await enterPlayIfReady();
	}

	async function enterPlayIfReady() {
		if (transitioningToPlay || playReady || !room || !importedPlaytest || phase !== 'playing')
			return;

		transitioningToPlay = true;
		setReconnectToken(room);
		playReady = true;
	}

	function readyUp() {
		room?.send('cmd', { commandType: 'ready', payload: {} });
	}

	function privatePlaytestConnection(privateRoomId: string, roomId: string, playRoom: PlayRoom) {
		return {
			kind: 'privatePlaytest' as const,
			privateRoomId,
			roomId,
			room: playRoom,
			getAuthToken: () => getGameTicket()
		};
	}

	onMount(async () => {
		try {
			await Promise.all([connectRoom(), importProject()]);
		} catch (error) {
			failure = error instanceof Error ? error.message : 'Could not join room';
			status = '';
		}
	});

	onDestroy(() => {
		if (room && !playReady) {
			void room.leave();
		}
	});
</script>

{#if playReady && importedPlaytest && room}
	<PlaySurface
		projectName={importedPlaytest.projectName}
		fileSystem={importedPlaytest.fileSystem}
		roomConnection={privatePlaytestConnection(
			importedPlaytest.privateRoomId,
			importedPlaytest.roomId,
			room
		)}
		playtestFeedback={{ playtestId: data.playtestId }}
		{e2e}
	/>
{:else}
	<main class="bg-background flex min-h-screen w-full items-center justify-center p-6">
		<div class="flex w-full max-w-lg flex-col gap-5 rounded-lg border p-6 shadow-sm">
			<header class="flex flex-col gap-2">
				<p class="text-muted-foreground text-sm">Playtest lobby</p>
				<h1 class="text-2xl font-semibold">{roomName}</h1>
				<p class="text-muted-foreground text-sm">
					{players.length} / {data.maxPlayers} players, minimum {data.minPlayers}
				</p>
			</header>

			{#if failure}
				<p class="text-destructive text-sm" role="alert">{failure}</p>
				<a
					class="text-primary text-sm underline"
					href={resolve('/playtests/[playtestId]', { playtestId: data.playtestId })}
				>
					Back to rooms
				</a>
			{:else}
				<div class="flex flex-col gap-2">
					<div class="flex items-center justify-between text-sm">
						<span class="text-muted-foreground">{status}</span>
						<span>{readyCount} ready</span>
					</div>
					<div class="flex flex-col gap-2">
						{#each players as player (player.id)}
							<div class="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
								<span>
									{player.id === room?.sessionId
										? `${player.name || 'Player'} (You)`
										: player.name || `Player ${player.id.slice(0, 4)}`}
								</span>
								<span class={player.ready ? 'text-primary' : 'text-muted-foreground'}>
									{player.ready ? 'Ready' : 'Waiting'}
								</span>
							</div>
						{/each}
					</div>
				</div>

				<button
					type="button"
					disabled={!canReady}
					class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:pointer-events-none disabled:opacity-50"
					onclick={readyUp}
				>
					{currentPlayer?.ready ? 'Ready' : 'Ready up'}
				</button>
			{/if}
		</div>
	</main>
{/if}
