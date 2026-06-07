<script lang="ts">
	import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';
	import { COMPONENTS_DIR } from '$lib/workspace/project-layout';
	import { requireParam } from '$lib/utils/assert';
	import { getFileSystemContext } from '../../../context';
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
	const fullFolderPath = $derived(joinFsPath(currentProject, COMPONENTS_DIR, currentCard));

	const fileSystem = getFileSystemContext();
	const deckSideIndex = createDeckSideIndexState();

	async function loadSvgTemplates(
		fileSystem: FsDir,
		fullFolderPath: string
	): Promise<LoadedSvgTemplates> {
		const deckDir = await fileSystem.openDir(fullFolderPath);
		if (deckDir.error) {
			console.error(deckDir.error);
			return { frontText: '', backText: '', front: null, back: null };
		}

		const [front, back] = await Promise.all([
			deckDir.data.readText('front.svg'),
			deckDir.data.readText('back.svg')
		]);
		const svgFileFront = front.error ? null : front.data;
		const svgFileBack = back.error ? null : back.data;
		return {
			frontText: svgFileFront ?? '',
			backText: svgFileBack ?? '',
			front: svgFileFront ? loadSvgTemplate(svgFileFront) : null,
			back: svgFileBack ? loadSvgTemplate(svgFileBack) : null
		};
	}

	setToLoadSvgsContext(() => loadSvgTemplates(fileSystem, fullFolderPath));
	setDeckSideIndexContext(deckSideIndex);

	$effect(() => {
		if (currentProject && currentCard) {
			deckSideIndex.sideIndex = 0;
		}
	});
</script>

{@render children()}
