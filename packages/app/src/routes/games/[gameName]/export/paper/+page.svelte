<script lang="ts">
	import ExportPages from '../export-pages.svelte';
	import { getProjectDataContext } from '../export-context.svelte';

	const projectData = await getProjectDataContext()();
</script>

<ExportPages projects={projectData.projects} />
