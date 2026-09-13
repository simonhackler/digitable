<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="empty-content"
	class={cn(
		'flex w-full max-w-md min-w-0 flex-col items-center gap-2.5 text-xl text-balance',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
