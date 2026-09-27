<script lang="ts">
	import { page } from '$app/state';
	import PlaySurface from '$lib/play/PlaySurface.svelte';
	import { requireParam } from '$lib/utils/assert';
	import { getActiveProjectContext } from '../../context';
	import GameTopBar from '../../game-top-bar.svelte';

	const project = getActiveProjectContext();
	const projectName = $derived(requireParam('gameName'));
	const e2e = $derived(page.url.searchParams.has('e2e'));
	const captured = await project.session.snapshot();
	if (captured.error) throw new Error(captured.error.message);
	const snapshot = captured.data;
</script>

<main class="flex h-svh min-h-0 w-full flex-col overflow-hidden">
	<GameTopBar />
	<div class="relative min-h-0 flex-1 overflow-hidden">
		<PlaySurface {projectName} {snapshot} {e2e} />
	</div>
</main>
