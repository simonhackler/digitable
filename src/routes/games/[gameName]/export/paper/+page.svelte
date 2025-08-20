<script lang="ts">
	import { page } from '$app/state';
	import ExportPages from '../export-pages.svelte';
	import { getExportContext } from '../export-context.svelte';

	const projectName = $derived(page.params.gameName);
	const projectData = getExportContext();
</script>

<ExportPages projects={projectData.projects} gameName={projectName} />
