<!--
	Installed from github/simonhackler/svelte-file-explorer
-->

<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Ellipsis, Trash2, Folders, FolderOutput, Download } from '@lucide/svelte';
	import { isFolder, type ExplorerNode, type Folder } from '$lib/components/file-browser/browser-utils/types.svelte';

	let {
		node,
		onDownload,
		onDelete,
		onMove,
		onCopy
	}: {
		node: ExplorerNode;
		onDelete: (node: ExplorerNode) => Promise<void>;
		onDownload: (node: ExplorerNode) => Promise<void>;
		onMove: (node: ExplorerNode) => void;
		onCopy: (node: ExplorerNode) => void;
	} = $props();

	const url = $derived(!isFolder(node) && node.fileData?.url?.then((url) => url));
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		<Ellipsis />
	</DropdownMenu.Trigger>
	<DropdownMenu.Content>
		<DropdownMenu.Group>
			<DropdownMenu.Item onclick={() => onDelete(node)}
				><Trash2 /> <span>Delete</span></DropdownMenu.Item
			>
			<DropdownMenu.Item onclick={() => onCopy(node)}
				><Folders /><span>Copy</span></DropdownMenu.Item
			>
			<DropdownMenu.Item onclick={() => onMove(node)}>
				<FolderOutput />Move</DropdownMenu.Item
			>
			{#if url}
				{#await url then url}
					<DropdownMenu.Item>
						<a class="flex cursor-default gap-2" href={url} download={node.name}>
							<Download /> Download
						</a>
					</DropdownMenu.Item>
				{/await}
			{:else}
				<DropdownMenu.Item onclick={() => onDownload(node)}>
					<Download />Download</DropdownMenu.Item
				>
			{/if}
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
