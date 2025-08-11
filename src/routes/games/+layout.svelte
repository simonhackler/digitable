<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from './app-sidebar.svelte';
	import PickFolder from '../../lib/components/pick-folder.svelte';
	import type { Adapter } from '$lib/components/file-browser/adapters/adapter';
	import { isFolder } from '$lib/components/file-browser/browser-utils/types.svelte';
	import type { Game } from './types';
	import { setFileSystemContext } from './context';

	let fileSystemState: { adapter: Adapter | null } = $state({ adapter: null });
	const fileSystem = $derived(fileSystemState.adapter);
	let games: Game[] = $state([]);

	setFileSystemContext(fileSystemState);

	async function onSetOpfsAdapter(adapter: Adapter) {
		fileSystemState.adapter = adapter;

		const folder = await fileSystem.getRootFolder();
		if (folder.result) {
			games = folder.result.children
				.filter(isFolder)
				.filter((f) => f.children.find((file) => file.name == 'game.json'))
				.map((f) => {
					const systemFolder = f.children.find((child) => child.name === 'system');
					if (!systemFolder || !isFolder(systemFolder)) {
						return { name: f.name, decks: [] };
					}

					const decks = systemFolder.children
						.filter((f) => isFolder(f))
						.map((deck) => ({ name: deck.name }));

					return {
						name: f.name,
						decks
					};
				});
		}
	}

	let { children } = $props();
</script>

<Sidebar.Provider>
	<AppSidebar {games} />
	<main class="w-full">
		<Sidebar.Trigger />
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
