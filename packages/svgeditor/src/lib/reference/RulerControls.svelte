<script lang="ts">
	import type { createEditorController } from '../svelte/createEditorController.svelte.ts';
	import { Card, CardContent, CardHeader, CardTitle } from '$svgeditor/components/ui/card/index.js';
	import { Label } from '$svgeditor/components/ui/label/index.js';
	import { Switch } from '$svgeditor/components/ui/switch/index.js';

	type EditorController = ReturnType<typeof createEditorController>;

	let { controller } = $props<{ controller: EditorController }>();
</script>

<Card>
	<CardHeader>
		<CardTitle>Rulers</CardTitle>
	</CardHeader>
	<CardContent class="flex items-center justify-between gap-3">
		<Label for="rulers-visible" title="Toggle rulers (Ctrl/Cmd+;)">Show rulers</Label>
		<Switch
			id="rulers-visible"
			checked={controller.rulersVisible}
			disabled={!controller.isReady}
			onCheckedChange={(checked) => controller.setRulersVisible(checked)}
		/>
	</CardContent>
</Card>
