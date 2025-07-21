<script lang="ts">
	import { page } from '$app/state';
	import { getFileSystemContext } from '../../../../context';
	import NewDeck from './new-deck.svelte';
	import SvgDataEditor from './svg-data-editor.svelte';

	const currentProject = $derived(page.params.gameName);
	const currentCard = $derived(page.params.deckName);
	const fullFolderPath = $derived(`/${currentProject}/system/${currentCard}/image.svg`);
	const fileSystem = getFileSystemContext();
	const svgFileResult = $derived(fileSystem.download([fullFolderPath]));


    let svgFile = $derived((await svgFileResult)[0].result?.data);

    function onUpload(file: File) {
        if (file.type !== 'image/svg+xml') {
            throw new Error('Only SVG files are allowed.');
        }
        svgFile = file;
    }

</script>

{#if svgFile}
    <SvgDataEditor svgFileText={await svgFile.text()}></SvgDataEditor>
	<!-- fix returns null -->
{:else if (await svgFileResult)[0].error}
	<!-- <div class="text-red-500">
        <p>Error loading SVG file: {svgFile.error.message}</p>
    </div> -->
	<NewDeck {onUpload}></NewDeck>
{:else}{/if}
