<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	let {
		children,
		status,
		statusError
	}: {
		children?: Snippet;
		status?: string;
		statusError?: string | null;
	} = $props();
</script>

<header class="bg-background flex h-12 shrink-0 items-center gap-3 border-b px-3">
	<Sidebar.Trigger class="shrink-0" />
	<Separator orientation="vertical" class="h-5" />
	{#if children}
		{@render children()}
	{/if}
	{#if statusError}
		<div class="text-destructive ml-auto shrink-0 text-sm" role="alert">
			{statusError}
		</div>
	{:else if status}
		<div class="text-muted-foreground ml-auto shrink-0 text-sm" aria-live="polite">
			{status}
		</div>
	{/if}
</header>
