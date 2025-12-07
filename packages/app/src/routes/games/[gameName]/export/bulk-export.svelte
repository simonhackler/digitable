<script lang="ts">
	import { ExplorerNodeFunctions } from '$lib/components/file-browser/browser-utils/explorer-node-functions';
	import { isFolder } from '$lib/components/file-browser/browser-utils/types.svelte';
	import { getFileSystemContext } from '../../context';
	import { loadSvgsAndData } from '../data-loader';
	import { generateSvg, loadSvgTemplate } from '../svg-helpers';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { Tween } from 'svelte/motion';
	import ExportPages from './export-pages.svelte';
	import type { Project } from './types';
	import { assert, requireParam } from '$lib/utils/assert';

	const projectName = $derived(requireParam('gameName'));
	const fileSystem = getFileSystemContext();
	const root = await fileSystem.getRootFolder();
	const projects: Project[] = [];

	async function getFoldersToExport() {
		const res = root.result;
		console.log(res);
		if (res) {
			for (const child of res.children) {
				console.log(child.name);
			}
			const project = res.children.find((f) => f.name === projectName);
            assert(project, `Project folder "${projectName}" not found`);
            assert(isFolder(project), `"${projectName}" is not a folder`);

			const systemFolder = project?.children.find((f) => f.name === 'system');
            assert(systemFolder, `"system" folder not found in project "${projectName}"`);
            assert(isFolder(systemFolder), `"system" folder not found in project "${projectName}"`);
			for (const child of systemFolder.children) {
				// Check every child folder for front.svg back.svg and data.csv
				if (isFolder(child)) {
					const front = child.children.find((c) => c.name === 'front.svg');
					const back = child.children.find((c) => c.name === 'back.svg');
					const data = child.children.find((c) => c.name === 'data.csv');
					if (front && back && data) {
						const frontPath = ExplorerNodeFunctions.getPath(front).slice(1).join('/');
						const backPath = ExplorerNodeFunctions.getPath(back).slice(1).join('/');
						const dataPath = ExplorerNodeFunctions.getPath(data).slice(1).join('/');
						const [frontRes, backRes, dataRes] = await fileSystem.download([
							frontPath,
							backPath,
							dataPath
						]);
						const svgFileFront = await frontRes.result?.data.text();
						const svgFileBack = await backRes.result?.data.text();
						if (svgFileFront && svgFileBack && dataRes.result?.data) {
							const svgTemplateFront = loadSvgTemplate(svgFileFront);
							const svgTemplateBack = loadSvgTemplate(svgFileBack);

							const { _svgData, spreadsheetData, imagePaths } = await loadSvgsAndData(
								projectName,
								child.name,
								fileSystem,
								svgTemplateFront,
								svgTemplateBack
							);

							let svgsFront = spreadsheetData.data.flatMap((row) => {
								const copiesIndex = spreadsheetData.cols.findIndex((c) => c.title === 'Copies');
								const copies = row[copiesIndex] ? parseInt(row[copiesIndex]) : 1;

								return Array.from({ length: copies }, () =>
									generateSvg(
										svgTemplateFront,
										spreadsheetData.cols.map((c) => c.title as string),
										row,
										imagePaths
									)
								);
							});
							let svgsBack = spreadsheetData.data.flatMap((row) => {
								const copiesIndex = spreadsheetData.cols.findIndex((c) => c.title === 'Copies');
								const copies = row[copiesIndex] ? parseInt(row[copiesIndex]) : 1;
								return Array.from({ length: copies }, () =>
									generateSvg(
										svgTemplateBack,
										spreadsheetData.cols.map((c) => c.title as string),
										row,
										imagePaths
									)
								);
							});
							const proj = {
								svgsFront,
								svgsBack,
								name: child.name
							};
							projects.push(proj);
						}
					}
				}
			}
		}
	}

	await getFoldersToExport();

	const sheets = projects.flatMap((p) => [
		{ name: p.name, svgs: p.svgsFront },
		{ name: `${p.name}_back`, svgs: p.svgsBack }
	]);

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
		const customDeck: Record<string, unknown> = {};

		let deckIndex = 1;
		const path = `${projectName}/tts-export`;
		for (const p of projects) {
			const faceUrl = `file:///home/simon/data/projects/boardgame/projects/${path}/${p.name}_sheet.png`;
			const backUrl = `file:///home/simon/data/projects/boardgame/projects/${path}/${p.name}_back_sheet.png`;

			const cardCount = p.svgsFront.length; // already includes “Copies”
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

			for (let i = 0; i < cardCount; i++) {
				deckIDs.push(deckIndex * 100 + i); // 101, 102, …
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
	}

	async function onExported(sheet: Sheet) {
		exportIndex += 1;
		if (exportIndex == sheets.length) {
			onFinish(true);
		}
	}
</script>

<div class="m-4 flex flex-col items-center justify-center">
	<Progress value={tweenedValue.current} max={sheets.length + 1} class="w-[60%]" />
	<p class="text-lg">{message}</p>
</div>

<ExportPages {projects} gameName={projectName} />

<!-- <div class="hide"> -->
<!-- <div > -->
<!-- 	<div> -->
<!-- 		<TtsExport {sheets} gameName={projectName} {onExported} /> -->
<!-- 	</div> -->
<!-- </div> -->
<!---->
<style>
	.hide {
		position: absolute;
		left: -9999px;
		top: auto;
	}
</style>
