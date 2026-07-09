<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	let {
		title,
		'aria-label': ariaLabel,
		children,
		status,
		statusError
	}: {
		title?: string;
		'aria-label'?: string;
		children?: Snippet;
		status?: string;
		statusError?: string | null;
	} = $props();
</script>

<header
	class="bg-background flex h-12 shrink-0 items-center gap-3 border-b px-3"
	role={ariaLabel ? 'toolbar' : undefined}
	aria-label={ariaLabel}
>
	<Sidebar.Trigger class="shrink-0" />
	<Separator orientation="vertical" class="h-5" />
	{#if title}
		<h1 class="text-sm font-medium whitespace-nowrap">{title}</h1>
		<Separator orientation="vertical" class="h-5" />
	{/if}
	{#if children}
		{@render children()}
	{/if}
	{#if statusError}
		<div class="text-destructive ml-auto shrink-0 text-sm" role="alert">
			{statusError}
		</div>
	{:else if status}
		<div class="text-muted-foreground ml-auto shrink-0 text-sm" role="status" aria-live="polite">
			{status}
		</div>
	{/if}
</header>
