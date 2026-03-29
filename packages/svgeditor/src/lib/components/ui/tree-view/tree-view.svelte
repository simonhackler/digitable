<script lang="ts">
	import { cn } from '$svgeditor/utils.js';
	import type { TreeViewRootProps } from '$svgeditor/components/ui/tree-view/types';

	let { children, class: className }: TreeViewRootProps = $props();
</script>

<div class={cn('flex flex-col', className)}>
	{@render children?.()}
</div>
