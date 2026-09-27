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

	let { children } = $props();

	const currentProject = $derived(requireParam('gameName'));
	const currentCard = $derived(requireParam('deckName'));
	const project = getActiveProjectContext();
	const deckSideIndex = createDeckSideIndexState();

	async function loadSvgTemplates(): Promise<LoadedSvgTemplates> {
		const frontMember = project.session.member(
			'component-svg',
			`components/${currentCard}/front.svg`
		);
		const backMember = project.session.member(
			'component-svg',
			`components/${currentCard}/back.svg`
		);
		const frontDocument = frontMember?.handle.doc();
		const backDocument = backMember?.handle.doc();
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

	$effect(() => {
		if (currentProject && currentCard) {
			deckSideIndex.sideIndex = 0;
		}
	});
</script>

{@render children()}
