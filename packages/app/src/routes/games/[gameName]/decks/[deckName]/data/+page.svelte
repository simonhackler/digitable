<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getLoadSvgsContext } from '../svg-context.svelte';
	import SvgDataEditor from './svg-data-editor.svelte';

	const currentProject = $derived(page.params.gameName);
	const currentCard = $derived(page.params.deckName);

	const loadSvgsContext = getLoadSvgsContext();
	// let { front: templateFront, back: templateBack } = $derived(await loadSvgsContext.loadTemplates);
	let prom = $derived(loadSvgsContext.loadTemplates);

	$inspect(prom);
	$effect(async () => {
		const { front: templateFront, back: templateBack } = await prom;
		if (!templateFront || !templateBack) {
			console.warn('SVG templates not loaded yet, redirecting to layout page');
			goto(`/games/${currentProject}/decks/${currentCard}/layout`);
		} else {
			console.log('SVG templates loaded', templateFront, templateBack);
		}
	});
</script>

<!-- {#if templateFront && templateBack } -->

{#if (await prom).front && (await prom).back}
	<SvgDataEditor svgTemplateFront={(await prom).front} svgTemplateBack={(await prom).back}
	></SvgDataEditor>
{/if}
