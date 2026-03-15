<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from './app-sidebar.svelte';
	import PickFolder from '../../lib/components/pick-folder.svelte';
	import type { Adapter } from '$lib/components/file-browser/adapters/adapter';
	import { isFolder } from '$lib/components/file-browser/browser-utils/types.svelte';
	import type { Game } from './types';
	import { setFileSystemContext, setGamesContext } from './context';
	import { generateAgentFiles } from '$lib/utils/agent-generator.js';

	let fileSystemState: { adapter: Adapter | null } = $state({ adapter: null });
	const fileSystem = $derived(fileSystemState.adapter);
	setFileSystemContext(fileSystemState);
	const gamesState: { existingGames: Game[] } = $state({ existingGames: [] });
	const games = $derived(gamesState.existingGames);
	setGamesContext(gamesState);
	// let games: Game[] = $state([]);

	async function onSetOpfsAdapter(adapter: Adapter) {
		fileSystemState.adapter = adapter;

		await generateAgentFiles(adapter);

		const folder = await fileSystem?.getRootFolder();
		if (folder?.result) {
			gamesState.existingGames = await Promise.all(
				folder.result.children
					.filter(isFolder)
					.filter((f) => f.children.find((file) => file.name == 'game.json'))
					.map(async (f) => {
						const systemFolder = f.children.find((child) => child.name === 'system');
						const gameJsonPath = `${f.name}/game.json`;
						const [gameFileResult] = await fileSystem!.download([gameJsonPath]);
						let description = '';
						let tags = [];
						if (gameFileResult.result?.data) {
							const gameFileText = await gameFileResult.result.data.text();
							const gameData = JSON.parse(gameFileText);
							description = gameData.description;
							tags = gameData.tags || [];
						}

						if (!systemFolder || !isFolder(systemFolder)) {
							return { name: f.name, decks: [], description, tags };
						}

						const decks = systemFolder.children
							.filter((f) => isFolder(f))
							.map((deck) => ({ name: deck.name }));

						return {
							name: f.name,
							decks,
							description,
							tags
						};
					})
			);
		}
	}

	let { children } = $props();
</script>

<Sidebar.Provider>
	<AppSidebar {games} />
	<Sidebar.Trigger class="z-50" />
	<main class="w-full">
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
