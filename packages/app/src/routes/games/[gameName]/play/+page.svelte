<script lang="ts">
	import { page } from '$app/state';
	import PlaySurface from '$lib/play/PlaySurface.svelte';
	import { requireParam } from '$lib/utils/assert';
	import { getFileSystemContext } from '../../context';

	const fileSystem = getFileSystemContext();
	const projectName = $derived(requireParam('gameName'));
	const e2e = $derived(page.url.searchParams.has('e2e'));
</script>

<main class="relative h-svh min-h-0 w-full overflow-hidden">
	<PlaySurface {projectName} {fileSystem} {e2e} />
</main>
