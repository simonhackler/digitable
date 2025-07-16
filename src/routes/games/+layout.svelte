<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from './app-sidebar.svelte';
	import PickFolder from '../writer/pick-folder.svelte';
	import type { Adapter } from '$lib/components/file-browser/adapters/adapter';
	import { isFolder } from '$lib/components/file-browser/browser-utils/types.svelte';
	import type { Game } from './types';

	let fileSystem: Adapter | null = $state(null);
	let games: Game[] = $state([]);

	async function onSetOpfsAdapter(adapter: Adapter) {
		fileSystem = adapter;
		const folder = await fileSystem.getRootFolder();
		if (folder.result) {
			games = folder.result.children.map((f) => {
				if (!isFolder(f)) return { name: f.name, decks: [] };

				const systemFolder = f.children.find((child) => child.name === 'system');
				if (!systemFolder || !isFolder(systemFolder)) {
					return { name: f.name, decks: [] };
				}

				const decks = systemFolder.children.map((deck) => ({ name: deck.name }));
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
			<div class="mt-12 flex flex-col items-center justify-center gap-4 text-xl w-full">
				<PickFolder {onSetOpfsAdapter}></PickFolder>
			</div>
		{:else}
			{@render children?.()}
		{/if}
	</main>
</Sidebar.Provider>
