<script lang="ts">
	import { page } from '$app/state';
	import { ExplorerNodeFunctions } from '$lib/components/file-browser/browser-utils/explorer-node-functions';
	import { isFolder } from '$lib/components/file-browser/browser-utils/types.svelte';
	import { getFileSystemContext } from '../../../../context';
	import { parseCsvFile } from './csv-helper';
	import { generateSvg, loadSvgTemplate, parseSvg } from './svg-helpers';
	import TtsExport from './tts-export.svelte';

	interface Project {
		name: string;
		svgsFront: SVGSVGElement[];
		svgsBack: SVGSVGElement[];
	}

	const currentProject = $derived(page.params.gameName);
	const fileSystem = getFileSystemContext();
	const root = await fileSystem.getRootFolder();
	const projects: Project[] = [];

	async function loadImagePaths(
		svgData: ColumnWithData[],
		spreadsheetData: { cols: Column[]; data: string[][] },
		deletedSvgColumns: string[],
		fileSystem: Adapter
	) {
		const imagesInSpreadsheet = svgData.filter(
			(c) => !deletedSvgColumns.includes(c.title as string) && c.type === 'image'
		);
		const imageColumnIndices = imagesInSpreadsheet
			.map((imgCol) => spreadsheetData.cols.findIndex((col) => col.title === imgCol.title))
			.filter((idx) => idx !== -1);
		const imageStrings = Array.from(
			new Set(
				spreadsheetData.data.flatMap(
					(row) =>
						imageColumnIndices
							.map((i) => row[i]) // grab the value at each target index
							.filter(Boolean) // drop undefined / empty cells
				)
			)
		);
		// The download and files api is really bad
		const files = await fileSystem.download(
			imageStrings.map((img) => `/${currentProject}/files/${img}`)
		);
		// create a map of image paths to their URLs
		const imagePaths = new Map<string, string>();
		imageStrings.forEach((img, i) => {
			const file = files[i];
			if (file.result) {
				imagePaths.set(img, URL.createObjectURL(file.result.data));
			} else {
				console.warn(`File ${img} is not a Blob, skipping.`);
			}
		});
		return imagePaths;
	}

	function loadSpreadsheetData(
		svgData: ColumnWithData[],
		csvData: { header: string[]; data: string[][] } | null
	) {
		const svgCols: Column[] = svgData.map((c) => {
			return { title: c.title, type: 'text' };
		});
		svgCols.unshift({ title: 'Copies', type: 'text' }); // Add ID column at the start
		if (csvData) {
			const newCols: Column[] = [];
			for (const header of csvData.header) {
				const existingCol = svgCols.find((c) => c.title === header);
				if (existingCol) {
					newCols.push(existingCol);
				} else {
					newCols.push({ title: header, type: 'text' });
				}
			}
			return {
				cols: newCols,
				data: csvData.data
			};
		} else {
			return {
				cols: svgCols,
				data: svgData.map((row) => row.data) // Maybe I don't want this, could also be empty
			};
		}
	}

	async function getFoldersToExport() {
		const res = root.result;
		console.log(res);
		if (res) {
			for (const child of res.children) {
				console.log(child.name);
			}
			const project = res.children.find((f) => f.name === currentProject);
			const systemFolder = project?.children.find((f) => f.name === 'system');
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
							const backPrefix = `back_`;
							const svgTemplateBack = loadSvgTemplate(svgFileBack);
							const svgDataFront = parseSvg(svgTemplateFront);
							const svgDataBack = parseSvg(svgTemplateBack, backPrefix);
							const svgData = svgDataFront.concat(svgDataBack);
							const csvData = await parseCsvFile(dataRes.result?.data as File);
							const spreadsheetData = loadSpreadsheetData(svgData, csvData);
							let deletedSvgColumns = svgData
								.filter((col) => !spreadsheetData.cols.some((c) => c.title === col.title))
								.map((c) => c.title as string);
							const imagePaths = await loadImagePaths(
								svgData,
								spreadsheetData,
								deletedSvgColumns,
								fileSystem
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
    console.log('Projects loaded:', projects);
	const sheets = projects.flatMap((p) => [
		{ name: p.name, svgs: p.svgsFront},
		{ name: `${p.name}_back`, svgs: p.svgsBack }
	]);
	console.log('Projects to export:', sheets);
</script>

<TtsExport
    {sheets}
	currentGame={currentProject}
/>
