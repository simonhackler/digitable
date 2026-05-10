<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { getToLoadSvgsContext } from '../svg-context.svelte';
	import SvgDataEditor from './svg-data-editor.svelte';

	const currentProject = $derived(page.params.gameName);
	const currentCard = $derived(page.params.deckName);

	const svgs = getToLoadSvgsContext();
	let { front: templateFront, back: templateBack } = $derived(await svgs());
	const editorPath = $derived(`/games/${currentProject}/decks/${currentCard}/editor`);
</script>

{#if templateFront && templateBack}
	<SvgDataEditor svgTemplateFront={templateFront} svgTemplateBack={templateBack}></SvgDataEditor>
{:else}
	<div
		class="mx-auto flex min-h-80 max-w-xl flex-col items-center justify-center gap-3 p-6 text-center"
	>
		<h1 class="text-xl font-semibold">SVG templates missing</h1>
		<p class="text-muted-foreground text-sm">
			Add front and back SVGs in the deck editor before editing data.
		</p>
		<Button href={editorPath}>Open editor</Button>
	</div>
{/if}
