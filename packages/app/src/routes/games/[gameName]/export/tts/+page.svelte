<script lang="ts">
	import { page } from '$app/state';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import TtsExport, { type Sheet } from '../tts-export.svelte';
	import TtsPreview from '../tts-preview.svelte';
	import { Tween } from 'svelte/motion';
	import { getExportContext } from '../export-context.svelte';
	import { getFileSystemContext } from '../../../context';

	const projectName = $derived(page.params.gameName);
	const projectData = getExportContext();
	const fileSystem = getFileSystemContext();

	const projectSheets = $derived(
		projectData.projects.map((p) => {
            const res: Sheet[] = []
            for (let i = 0; i <= p.svgsFront.length; i += 70) {
                const name = `${p.name}_${i}_${i+70}`
                res.push(
				    { name, svgs: p.svgsFront.slice(i, i + 70) },
				    { name: `${name}_back`, svgs: p.svgsBack.slice(i, i + 70) }
                )
            }
            return {name: p.name, sheets: res}
		})
	);
    const sheets = $derived(projectSheets.flatMap(p => p.sheets));

	let exportIndex = $state(0);
	let finished = $state(false);
	let progressValue = $derived.by(() => exportIndex + (finished ? 1 : 0));
	let tweenedValue = $derived.by(() => {
		const tween = new Tween(progressValue, { duration: 5000 });
		tween.target = progressValue + 1;
		return tween;
	});

	const exportingSheet = $derived(sheets[exportIndex]);
	const message = $derived.by(() => {
		if (finished) {
			return 'TTS export finished successfully!';
		}
		if (exportIndex >= sheets.length) {
			return 'generating TTS export…';
		}
		return `Exporting sheet ${exportIndex + 1} of ${sheets.length}: ${exportingSheet.name}`;
	});

	async function onFinish(success: boolean) {
		if (!success) {
			return;
		}
		console.log('Starting TTS export for', projectName);
		const CARDS_PER_ROW = 10; // <-- match whatever TtsExport used
		const makeGUID = () => Math.random().toString(36).slice(2, 6);

		// 1.  Assemble DeckIDs[] and CustomDeck{}
		const deckIDs: number[] = [];
		const customDeck: Record<string, any> = {};

		let deckIndex = 1;
		const path = `${projectName}/tts-export`;

        for (const project of projectSheets) {
		    for (let i = 0; i < project.sheets.length; i += 2) {
            }
        }

		for (let i = 0; i < sheets.length; i += 2) {
			const frontSheet = sheets[i];
			const backSheet = sheets[i + 1];

			// Skip if this is a back sheet (we process them in pairs)
			if (frontSheet.name.includes('_back_sheet')) {
				continue;
			}

			const faceUrl = `file:///home/simon/data/projects/boardgame/projects/${path}/${frontSheet.name}_sheet.png`;
			const backUrl = `file:///home/simon/data/projects/boardgame/projects/${path}/${backSheet.name}_sheet.png`;

			const cardCount = frontSheet.svgs.length;
			const numWidth = Math.min(cardCount, CARDS_PER_ROW);
			const numHeight = Math.ceil(cardCount / CARDS_PER_ROW);

			customDeck[deckIndex.toString()] = {
				FaceURL: faceUrl,
				BackURL: backUrl,
				NumWidth: numWidth,
				NumHeight: numHeight,
				BackIsHidden: false,
				UniqueBack: true,
				Type: 0 // rounded-rect
			};

			for (let j = 0; j < cardCount; j++) {
				deckIDs.push(deckIndex * 100 + j); // 101, 102, …
			}
			deckIndex++;
		}

		// 2.  Wrap everything in the minimal save/object structure
		const ttsObject = {
			Name: 'Deck',
			Transform: {
				posX: 0,
				posY: 3,
				posZ: 0,
				rotX: 0,
				rotY: 180,
				rotZ: 0,
				scaleX: 1,
				scaleY: 1,
				scaleZ: 1
			},
			DeckIDs: deckIDs,
			CustomDeck: customDeck,
			ContainedObjects: [],
			LuaScript: '',
			LuaScriptState: '',
			GUID: makeGUID()
		};

		const ttsSave = { ObjectStates: [ttsObject] };

		// 3.  Store it next to the images so TTS can see relative file:// paths.
		//     Adapt to your file-system wrapper if method names differ.
		const jsonBlob = new Blob([JSON.stringify(ttsSave, null, 2)], { type: 'application/json' });
		// convert to file
		const jsonFile = new File([jsonBlob], `${projectName}.json`);
		await fileSystem.upload(jsonFile, path, true);
		finished = true;
        console.log("exported");
	}

	async function onExported(sheet: Sheet) {
		exportIndex += 1;
		if (exportIndex == sheets.length) {
			onFinish(true);
		}
	}

	$inspect(exportIndex, 'exportIndex');
</script>

<div class="m-4 flex flex-col items-center justify-center">
	<Progress value={tweenedValue.current} max={sheets.length + 1} class="w-[60%]" />
	<p class="text-lg">{message}</p>
</div>

<div class="m-4 flex justify-center">
	<TtsPreview sheet={exportingSheet} isVisible={exportIndex < sheets.length && !finished} />
</div>

<div class="hide">
	<div>
		<TtsExport sheets={sheets} gameName={projectName} {onExported} />
	</div>
</div>

<style>
	.hide {
		position: absolute;
		left: -9999px;
		top: auto;
	}
</style>
