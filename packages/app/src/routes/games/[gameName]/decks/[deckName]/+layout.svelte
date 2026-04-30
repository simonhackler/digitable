<script lang="ts">
	import { page } from '$app/state';
	import type { Adapter } from '$lib/components/file-browser/adapters/adapter';
	import { getFileSystemContext } from '../../../context';
	import { loadSvgTemplate } from '../../svg-helpers';
	import { setToLoadSvgsContext, type LoadedSvgTemplates } from './svg-context.svelte';

	let { children } = $props();

	const currentProject = $derived(page.params.gameName);
	const currentCard = $derived(page.params.deckName);
	const fullFolderPath = $derived(`/${currentProject}/system/${currentCard}`);

	const fileSystem = getFileSystemContext();

	async function loadSvgTemplates(
		fileSystem: Adapter,
		fullFolderPath: string
	): Promise<LoadedSvgTemplates> {
		const [front, back] = await fileSystem.download([
			`${fullFolderPath}/front.svg`,
			`${fullFolderPath}/back.svg`
		]);
		const svgFileFront = await front.result?.data.text();
		const svgFileBack = await back.result?.data.text();
		return {
			front: svgFileFront ? loadSvgTemplate(svgFileFront) : null,
			back: svgFileBack ? loadSvgTemplate(svgFileBack) : null
		};
	}

	setToLoadSvgsContext(() => loadSvgTemplates(fileSystem, fullFolderPath));
</script>

{@render children()}
