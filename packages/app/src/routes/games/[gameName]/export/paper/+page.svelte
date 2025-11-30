<script lang="ts">
	import { page } from '$app/state';
	import ExportPages from '../export-pages.svelte';
	import { getProjectDataContext } from '../export-context.svelte';

	const projectName = $derived(page.params.gameName);
	const projectData = await getProjectDataContext()();
</script>

<ExportPages projects={projectData.projects} gameName={projectName} />
