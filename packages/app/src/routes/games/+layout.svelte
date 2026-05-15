<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from './app-sidebar.svelte';
	import PickFolder from '../../lib/components/pick-folder.svelte';
	import type { FsDir } from '$lib/components/file-browser/adapters/adapter';
	import type { Game } from './types';
	import { setFileSystemContext, setGamesContext } from './context';
	import { generateAgentFiles } from '$lib/utils/agent-generator.js';

	let fileSystemState: { adapter: FsDir | null } = $state({ adapter: null });
	const fileSystem = $derived(fileSystemState.adapter);
	setFileSystemContext(fileSystemState);
	const gamesState: { existingGames: Game[] | null } = $state({ existingGames: null });
	const games = $derived(gamesState.existingGames);
	setGamesContext(gamesState);

	async function getGames(fileSystem: Readonly<FsDir>) {
		const root = await fileSystem.list();
		if (root.error) return [];

		const games: Game[] = [];
		for (const entry of root.data) {
			if (entry.kind !== 'directory') continue;

			const projectPath = entry.name;
			const projectDir = await fileSystem.openDir(projectPath);
			if (projectDir.error) continue;

			const projectEntries = await projectDir.data.list();
			if (projectEntries.error) continue;
			if (!projectEntries.data.some((file) => file.name === 'game.json')) continue;

			const gameFile = await projectDir.data.readText('game.json');
			let description = '';
			let tags = [];
			if (!gameFile.error) {
				const gameData = JSON.parse(gameFile.data);
				description = gameData.description;
				tags = gameData.tags || [];
			}

			const systemFolder = projectEntries.data.find((child) => child.name === 'system');
			if (!systemFolder || systemFolder.kind !== 'directory') {
				games.push({ name: entry.name, decks: [], description, tags });
				continue;
			}

			const systemDir = await projectDir.data.openDir('system');
			const systemEntries = systemDir.error ? systemDir : await systemDir.data.list();
			const decks = systemEntries.error
				? []
				: systemEntries.data
						.filter((deck) => deck.kind === 'directory')
						.map((deck) => ({ name: deck.name }));

			games.push({
				name: entry.name,
				decks,
				description,
				tags
			});
		}
		return games;
	}

	async function onSetOpfsAdapter(adapter: FsDir) {
		fileSystemState.adapter = adapter;
		await generateAgentFiles(adapter);
		gamesState.existingGames = await getGames(adapter);
	}

	let { children } = $props();
</script>

<Sidebar.Provider>
	{#if fileSystem && games}
		<AppSidebar {games} {fileSystem} {onSetOpfsAdapter} />
	{/if}
	<Sidebar.Trigger class="z-50" />
	<main class="relative min-w-0 flex-1">
		{#if !fileSystem}
			<div class="mt-12 flex w-full flex-col items-center justify-center gap-4 text-xl">
				<PickFolder {onSetOpfsAdapter}></PickFolder>
			</div>
		{:else}
			<svelte:boundary>
				{#snippet pending()}
					<p>loading...</p>
				{/snippet}
				{@render children?.()}
			</svelte:boundary>
		{/if}
	</main>
</Sidebar.Provider>
