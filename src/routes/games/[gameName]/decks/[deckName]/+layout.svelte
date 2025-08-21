<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Adapter } from '$lib/components/file-browser/adapters/adapter';
	import { getFileSystemContext } from '../../../context';
	import { loadSvgTemplate } from '../../svg-helpers';
	import { LoadSvgs, setLoadSvgsContext, setSvgContext, Svgs } from './svg-context.svelte';

	let { children } = $props();

	const currentProject = $derived(page.params.gameName);
	const currentCard = $derived(page.params.deckName);
	const fullFolderPath = $derived(`/${currentProject}/system/${currentCard}`);

	const fileSystem = getFileSystemContext();

    async function loadSvgTemplates(fileSystem: Adapter, fullFolderPath: string) {
	    const [front, back] = await fileSystem.download([`${fullFolderPath}/front.svg`, `${fullFolderPath}/back.svg`]);
        const svgFileFront = await front.result?.data.text();
        const svgFileBack = await back.result?.data.text();
        return {front: svgFileFront ? loadSvgTemplate(svgFileFront) : null, back: svgFileBack ? loadSvgTemplate(svgFileBack) : null};
    }

    const svgsProm = $derived(loadSvgTemplates(fileSystem, fullFolderPath));
    const loadSvgs = (new LoadSvgs(svgsProm));
    setLoadSvgsContext(() => loadSvgs);

    $effect(async () => {
        loadSvgs.loadTemplates = svgsProm;
        await loadSvgs.loadTemplates;
        console.log('currentProject', currentProject, 'currentCard', currentCard, 'fullFolderPath', fullFolderPath);
    });

    // TODO all this might be related to a bug in svelte
    // await loadSvgs.loadTemplates;


</script>

{@render children()}
