<script lang="ts">
	import PickFolder from '../writer/pick-folder.svelte';
	import type { Adapter } from '$lib/components/file-browser/adapters/adapter';
	import { setContext } from 'svelte';

	let fileSystem: Adapter | null = $state(null);
    let games: string[] = $state([]);
    async function onSetOpfsAdapter(adapter: Adapter) {
        fileSystem = adapter;
        const folder = await fileSystem.getRootFolder();
        if (folder.result) {
            games = folder.result.children.map((f) => f.name);
        }
    }

</script>

<!--
{#if !fileSystem}
	<div class="flex flex-col items-center justify-center gap-4 text-xl mt-12">
		<PickFolder {onSetOpfsAdapter}></PickFolder>
	</div>
{:else}
    <div class="flex flex-col items-center justify-center gap-4 text-xl mt-12">
        {#each games as game (game)}
            <div class="flex flex-row items-center justify-center gap-4">
                <a href={`/games/${game}`}>{game}</a>
            </div>
        {/each}
    </div>
{/if}
-->
