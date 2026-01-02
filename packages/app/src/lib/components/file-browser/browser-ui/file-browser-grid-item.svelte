<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	import { displaySize } from '$lib/components/ui/file-drop-zone';
	import {
		isFolder,
		type ExplorerNode
	} from '$lib/components/file-browser/browser-utils/types.svelte';
	import FileBrowserItemIcon from './file-browser-item-icon.svelte';
	import type { Snippet } from 'svelte';
	import type { ButtonProps } from '$lib/components/ui/button';

	let {
		child,
		showActions = true,
		actionList,
		checkbox,
		...restProps
	}: {
		child: ExplorerNode;
		showActions?: boolean;
		actionList: Snippet<[ExplorerNode]>;
		checkbox?: Snippet;
	} & Omit<ButtonProps, 'children'> = $props();
</script>

<Button class="relative h-full w-full" variant="ghost" data-testid={child.name} {...restProps}>
	<div class="flex h-full w-full flex-col items-center justify-center gap-4">
		{#if checkbox}
			{@render checkbox()}
		{/if}
		<FileBrowserItemIcon node={child} />
		<p>{child.name}</p>
		<div class="flex w-full items-center justify-between">
			{#if isFolder(child)}
				<p class="text-muted-foreground text-xs">{child.children.length} items</p>
			{:else}
				<p class="text-muted-foreground text-xs">{displaySize(child.fileData?.size || 0)}</p>
			{/if}
			{#if showActions}
				{@render actionList(child)}
			{/if}
		</div>
	</div>
</Button>
