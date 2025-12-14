<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getLoadSvgsContext } from '../svg-context.svelte';
	import SvgDataEditor from './svg-data-editor.svelte';

	const currentProject = $derived(page.params.gameName);
	const currentCard = $derived(page.params.deckName);

	const loadSvgsContext = getLoadSvgsContext();
	let { front: templateFront, back: templateBack } = $derived(await loadSvgsContext.loadTemplates);
    $effect(() => {
        if (!templateFront || !templateBack) {
            console.warn('SVG templates not loaded yet, redirecting to layout page');
            goto(resolve(`/games/${currentProject}/decks/${currentCard}/layout`));
        } else {
            console.log('SVG templates loaded', templateFront, templateBack);
        }
    });
</script>

{#if templateFront && templateBack }
	<SvgDataEditor svgTemplateFront={templateFront} svgTemplateBack={templateBack}
	></SvgDataEditor>
{/if}
