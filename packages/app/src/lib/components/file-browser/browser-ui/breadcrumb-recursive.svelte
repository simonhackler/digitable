<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { Folder } from '$lib/components/file-browser/browser-utils/types.svelte';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import BreadcrumbRecursive from '$lib/components/file-browser/browser-ui/breadcrumb-recursive.svelte';

	interface Props {
		folder: Folder;
		isLast?: boolean;
		onBreadCrumbClick: (folder: Folder) => void;
	}

	let { folder, isLast = true, onBreadCrumbClick }: Props = $props();
</script>

{#if folder.parent}
	<BreadcrumbRecursive {onBreadCrumbClick} folder={folder.parent} isLast={false} />
{/if}
{#if !isLast}
	<Breadcrumb.Item>
		<Button variant="ghost" onclick={() => onBreadCrumbClick(folder)}>{folder.name}</Button>
	</Breadcrumb.Item>
	<Breadcrumb.Separator />
{:else}
	<Breadcrumb.Item>
		<Button variant="ghost" onclick={() => onBreadCrumbClick(folder)}>{folder.name}</Button>
	</Breadcrumb.Item>
{/if}
