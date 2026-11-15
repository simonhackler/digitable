<script lang="ts">
	import { decodeText } from '$lib/collaboration/filesystem';
	import { serializeProjectMember } from '$lib/collaboration/project-member-codec';
	import { requireParam } from '$lib/utils/assert';
	import { getActiveProjectContext } from '../../../context';
	import { loadSvgTemplate } from '../../svg-helpers';
	import {
		createDeckSideIndexState,
		setDeckSideIndexContext,
		setToLoadSvgsContext,
		type LoadedSvgTemplates
	} from './svg-context.svelte';

	let { children, data }: import('./$types').LayoutProps = $props();

	const currentProject = $derived(requireParam('gameName'));
	const currentCard = $derived(requireParam('deckName'));
	const project = getActiveProjectContext();
	const deckSideIndex = createDeckSideIndexState();

	async function loadSvgTemplates(): Promise<LoadedSvgTemplates> {
		const loaded = await project.session.require(data.componentNeeds);
		const frontDocument = loaded.front?.handle.doc();
		const backDocument = loaded.back?.handle.doc();
		const frontText = frontDocument
			? decodeText(serializeProjectMember('component-svg', frontDocument))
			: '';
		const backText = backDocument
			? decodeText(serializeProjectMember('component-svg', backDocument))
			: '';
		return {
			frontText,
			backText,
			front: frontText ? loadSvgTemplate(frontText) : null,
			back: backText ? loadSvgTemplate(backText) : null
		};
	}

	setToLoadSvgsContext(loadSvgTemplates);
	setDeckSideIndexContext(deckSideIndex);
	const documents = $derived(await project.session.require(data.componentNeeds));

	$effect(() => {
		if (currentProject && currentCard) {
			deckSideIndex.sideIndex = 0;
		}
	});
</script>

{#if documents}
	{@render children()}
{/if}
