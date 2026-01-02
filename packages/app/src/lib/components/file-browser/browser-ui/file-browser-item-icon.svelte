<script lang="ts">
	import { FolderIcon, FileIcon } from '@lucide/svelte';
	import {
		isFolder,
		type ExplorerNode
	} from '$lib/components/file-browser/browser-utils/types.svelte';

	let { node }: { node: ExplorerNode } = $props();
</script>

{#if isFolder(node)}
	<FolderIcon class="size-8" />
{:else if node?.fileData?.url != undefined}
	{#await node.fileData.url}
		<FileIcon class="size-8" />
	{:then url}
		<img src={url} class="size-8 object-contain" alt={`preview for ${node.name}`} />
	{/await}
{:else}
	<FileIcon class="size-8" />
{/if}
