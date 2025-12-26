<script lang="ts">
	import { page } from '$app/state';
	import ExportPages from '../export-pages.svelte';
	import { getProjectDataContext } from '../export-context.svelte';
	import { requireParam } from '$lib/utils/assert';

	const gameName = $derived(requireParam('gameName'));
	const projectData = await getProjectDataContext()();
</script>

<ExportPages projects={projectData.projects} {gameName} />
