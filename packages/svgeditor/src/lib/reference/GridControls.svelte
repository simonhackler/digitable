<script lang="ts">
	import type { createEditorController } from '../svelte/createEditorController.svelte.ts';
	import { Card, CardContent, CardHeader, CardTitle } from '$svgeditor/components/ui/card/index.js';
	import { Input } from '$svgeditor/components/ui/input/index.js';
	import { Label } from '$svgeditor/components/ui/label/index.js';
	import { Switch } from '$svgeditor/components/ui/switch/index.js';

	type EditorController = ReturnType<typeof createEditorController>;

	let { controller } = $props<{ controller: EditorController }>();

	const handleStepInput = () => {
		controller.setGridStep(controller.gridStep);
	};

	const handleColorInput = () => {
		controller.setGridColor(controller.gridColor);
	};
</script>

<Card>
	<CardHeader>
		<CardTitle>Grid</CardTitle>
	</CardHeader>
	<CardContent class="flex flex-col gap-3">
		<div class="flex items-center justify-between gap-3">
			<Label for="grid-visible" title="Toggle grid (Ctrl/Cmd+')">Show grid</Label>
			<Switch
				id="grid-visible"
				checked={controller.gridVisible}
				disabled={!controller.isReady}
				onCheckedChange={(checked) => controller.setGridVisible(checked)}
			/>
		</div>
		<div class="flex items-center justify-between gap-3">
			<Label for="grid-snap" title="Toggle snap to grid (Ctrl/Cmd+Shift+')">Snap to grid</Label>
			<Switch
				id="grid-snap"
				checked={controller.gridSnapping}
				disabled={!controller.isReady}
				onCheckedChange={(checked) => controller.setGridSnapping(checked)}
			/>
		</div>
		<div class="flex items-center justify-between gap-3">
			<Label for="page-border-snap">Snap to page</Label>
			<Switch
				id="page-border-snap"
				checked={controller.pageBorderSnapping}
				disabled={!controller.isReady}
				onCheckedChange={(checked) => controller.setPageBorderSnapping(checked)}
			/>
		</div>
		<div class="grid gap-2">
			<Label for="grid-step">Grid step</Label>
			<Input
				id="grid-step"
				type="number"
				min="0.1"
				step="0.1"
				class="max-w-28"
				bind:value={controller.gridStep}
				disabled={!controller.isReady}
				oninput={handleStepInput}
			/>
		</div>
		<div class="grid gap-2">
			<Label for="grid-color">Grid color</Label>
			<Input
				id="grid-color"
				type="color"
				class="h-10 w-20 p-1"
				bind:value={controller.gridColor}
				disabled={!controller.isReady}
				oninput={handleColorInput}
			/>
		</div>
	</CardContent>
</Card>
