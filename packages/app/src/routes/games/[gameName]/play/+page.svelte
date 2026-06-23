<script lang="ts">
	import { page } from '$app/state';
	import PlaySurface from '$lib/play/PlaySurface.svelte';
	import { requireParam } from '$lib/utils/assert';
	import { getFileSystemContext } from '../../context';
	import GameTopBar from '../../game-top-bar.svelte';

	const fileSystem = getFileSystemContext();
	const projectName = $derived(requireParam('gameName'));
	const e2e = $derived(page.url.searchParams.has('e2e'));
</script>

<main class="flex h-svh min-h-0 w-full flex-col overflow-hidden">
	<GameTopBar />
	<div class="relative min-h-0 flex-1 overflow-hidden">
		<PlaySurface {projectName} {fileSystem} {e2e} />
	</div>
</main>
