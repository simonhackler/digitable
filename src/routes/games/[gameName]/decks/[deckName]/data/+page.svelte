<script lang="ts">
	import { page } from '$app/state';
	import { getFileSystemContext } from '../../../../context';
	import NewDeck from './new-deck.svelte';
	import SvgDataEditor from './svg-data-editor.svelte';
	import { loadSvgTemplate } from './svg-helpers';

	const currentProject = $derived(page.params.gameName);
	const currentCard = $derived(page.params.deckName);
	const fullFolderPath = $derived(`/${currentProject}/system/${currentCard}`);

	const fileSystem = getFileSystemContext();

	const svgFileResult = $derived(fileSystem.download([`${fullFolderPath}/front.svg`, `${fullFolderPath}/back.svg`]));


    let svgFileFront = $derived((await svgFileResult)[0].result?.data.text());
    let svgFileBack = $derived((await svgFileResult)[1].result?.data.text());
    let templateFront = $derived(svgFileFront ? loadSvgTemplate(await svgFileFront) : undefined);
    let templateBack = $derived(svgFileBack ? loadSvgTemplate(await svgFileBack) : undefined);

	const loadSvgsContext = getLoadSvgsContext();
	let { front: templateFront, back: templateBack } = $derived(await loadSvgsContext.loadTemplates);

    function onUpload(file: File) {
        if (file.type !== 'image/svg+xml') {
            throw new Error('Only SVG files are allowed.');
        }
        if (file.name == 'front.svg') {
            svgFileFront = file.text();
            console.log('Front SVG uploaded:', svgFileFront);
        } else if (file.name === 'back.svg') {
            svgFileBack = file.text();
        } else {
            throw new Error('Invalid file name. Expected front.svg or back.svg.');
        }
    }

</script>

<!-- {#if templateFront && templateBack && false} -->
{#if templateFront && templateBack }
    <SvgDataEditor svgTemplate={templateFront}></SvgDataEditor>
	<!-- fix returns null -->
{:else if true}
	<NewDeck {onUpload} {templateFront} {templateBack}></NewDeck>
{:else}{/if}
