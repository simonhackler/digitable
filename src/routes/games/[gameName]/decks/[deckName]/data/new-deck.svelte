<script lang="ts">
	import { page } from '$app/state';
	import FileUpload from '$lib/components/file-browser/browser-ui/file-upload.svelte';
	import { getFileSystemContext } from '../../../../context';

    let { onUpload }: { onUpload?: (files: File) => void } = $props();

	const currentProject = $derived(page.params.gameName);
	const currentCard = $derived(page.params.deckName);
	const fullFolderPath = $derived(`/${currentProject}/system/${currentCard}`);
	const fileSystem = getFileSystemContext();

	async function uploadToAdapter(file: File, overwrite: boolean = false) {
		const result = await fileSystem.upload(file, fullFolderPath, overwrite);
		if (result) {
			throw new Error(result.message);
		}
		return result;
	}
</script>

<div class="text-center">
	<h1 class="mb-4 text-2xl font-bold">New Deck</h1>
	<p class="mb-4">Upload an SVG file for your deck.</p>
	<FileUpload {uploadToAdapter} filesInFolder={[]}></FileUpload>
</div>
