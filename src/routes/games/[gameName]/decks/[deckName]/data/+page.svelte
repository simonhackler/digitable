<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Papa from 'papaparse';
	import { getFileSystemContext } from '../../../../context';
	import { getLoadSvgsContext } from '../svg-context.svelte';
	import SvgDataEditor from './svg-data-editor.svelte';

	const currentProject = $derived(page.params.gameName);
	const currentCard = $derived(page.params.deckName);

	const loadSvgsContext = getLoadSvgsContext();
    const fileSystem = getFileSystemContext();
	const csvPath = $derived(`/${currentProject}/system/${currentCard}/data.csv`);
	let { front: templateFront, back: templateBack } = $derived(await loadSvgsContext.loadTemplates);

	//const csvFileResult = $derived((await fileSystem.download([csvPath]))[0]);

	function parseCsvFile(file: File): Promise<{ header: string[]; data: string[][] }> {
		return new Promise((resolve, reject) => {
			Papa.parse<string[]>(file, {
				complete: (result) => {
					if (result.errors.length) {
						return reject(result.errors);
					}
					const rows = result.data.filter((r) => r.length > 0);
					const header = rows.shift()!;
                    console.log('CSV header:', header);
					resolve({ header, data: rows });
				},
				error: (err) => reject(err),
				skipEmptyLines: true
			});
		});
	}

    $effect(() => {
        if (!templateFront || !templateBack) {
            goto(`/games/${currentProject}/decks/${currentCard}/layout`);
        }
    })

</script>

{#if templateFront && templateBack }
    <SvgDataEditor svgTemplateFront={templateFront} svgTemplateBack={templateBack} ></SvgDataEditor>
{/if}
