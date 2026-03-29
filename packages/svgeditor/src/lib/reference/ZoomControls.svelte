<script lang="ts">
	import type { createEditorController } from '../svelte/createEditorController.svelte.ts';
	import { ZoomIn, ZoomOut } from '@lucide/svelte';
	import { Button } from '$svgeditor/components/ui/button/index.js';
	import { Input } from '$svgeditor/components/ui/input/index.js';

	type EditorController = ReturnType<typeof createEditorController>;

	let { controller } = $props<{ controller: EditorController }>();

	const zoomDisplay = $derived(Math.round((controller.zoom || 1) * 100));

	const applyZoom = (event: Event) => {
		const target = event.currentTarget as HTMLInputElement | null;
		if (!target) return;
		const parsed = Number(target.value);
		const value = Number.isFinite(parsed) ? parsed / 100 : 1;
		controller.setZoom(value);
	};
</script>

<div class="flex items-center gap-2">
	<Button
		size="icon-sm"
		variant="outline"
		title="Zoom out (Ctrl/Cmd+-)"
		onclick={() => controller.zoomOut()}
	>
		<ZoomOut class="size-4" />
	</Button>
	<div class="flex items-center gap-2">
		<Input
			id="zoom-input"
			type="number"
			min="10"
			max="800"
			step="10"
			class="w-20"
			aria-label="Zoom percentage"
			title="Reset zoom (Ctrl/Cmd+0)"
			value={zoomDisplay}
			onchange={applyZoom}
		/>
		<span class="text-muted-foreground text-sm">%</span>
	</div>
	<Button
		size="icon-sm"
		variant="outline"
		title="Zoom in (Ctrl/Cmd+= or Ctrl/Cmd++)"
		onclick={() => controller.zoomIn()}
	>
		<ZoomIn class="size-4" />
	</Button>
</div>
