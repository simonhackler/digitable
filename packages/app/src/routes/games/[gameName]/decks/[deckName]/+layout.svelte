<script lang="ts">
	import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';
	import { requireParam } from '$lib/utils/assert';
	import { getFileSystemContext } from '../../../context';
	import { loadSvgTemplate } from '../../svg-helpers';
	import { setToLoadSvgsContext, type LoadedSvgTemplates } from './svg-context.svelte';

	let { children } = $props();

	const currentProject = $derived(requireParam('gameName'));
	const currentCard = $derived(requireParam('deckName'));
	const fullFolderPath = $derived(joinFsPath(currentProject, 'system', currentCard));

	const fileSystem = getFileSystemContext();

	async function loadSvgTemplates(
		fileSystem: FsDir,
		fullFolderPath: string
	): Promise<LoadedSvgTemplates> {
		const [front, back] = await Promise.all([
			fileSystem.read(joinFsPath(fullFolderPath, 'front.svg')),
			fileSystem.read(joinFsPath(fullFolderPath, 'back.svg'))
		]);
		const svgFileFront = front.error ? null : await front.data.text();
		const svgFileBack = back.error ? null : await back.data.text();
		return {
			front: svgFileFront ? loadSvgTemplate(svgFileFront) : null,
			back: svgFileBack ? loadSvgTemplate(svgFileBack) : null
		};
	}

	setToLoadSvgsContext(() => loadSvgTemplates(fileSystem, fullFolderPath));
</script>

{@render children()}
