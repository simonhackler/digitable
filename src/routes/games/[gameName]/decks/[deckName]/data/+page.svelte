<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getFileSystemContext } from '../../../../context';
	import { getLoadSvgsContext } from '../svg-context.svelte';
	import NewDeck from './new-deck.svelte';
	import SvgDataEditor from './svg-data-editor.svelte';
	import { loadSvgTemplate } from './svg-helpers';

	const currentProject = $derived(page.params.gameName);
	const currentCard = $derived(page.params.deckName);

	const loadSvgsContext = getLoadSvgsContext();
	let { front: templateFront, back: templateBack } = $derived(await loadSvgsContext.loadTemplates);

    $effect(() => {
        if (!templateFront || !templateBack) {
            goto(`/games/${currentProject}/decks/${currentCard}/layout`);
        }
    })

</script>

{#if templateFront && templateBack }
    <SvgDataEditor svgTemplate={templateFront}></SvgDataEditor>
{/if}
