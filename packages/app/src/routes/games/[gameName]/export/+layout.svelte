<script lang="ts">
	import { page } from '$app/state';
	import { getFileSystemContext } from '../../context';
	import { loadSvgsAndData } from '../data-loader';
	import { generateSvg, loadSvgTemplate } from '../svg-helpers';
	import type { Project } from './types';
	import { ProjectData, setProjectDataContext } from './export-context.svelte';
	import type { FsDir } from '$lib/components/file-browser/adapters/adapter';
	import { requireParam } from '$lib/utils/assert';

	const projectName = $derived(requireParam('gameName'));
	const fileSystem = getFileSystemContext();
	const useDataUrls = $derived(page.route.id !== '/games/[gameName]/export/paper');

	const { children } = $props();

	async function getFoldersToExport(fileSystem: FsDir, projectName: string, useDataUrls: boolean) {
		const projectData = new ProjectData();
		const systemPath = `${projectName}/system`;
		const systemEntries = await fileSystem.list(systemPath);
		if (systemEntries.error) {
			throw new Error(systemEntries.error.message);
		}

		for (const entry of systemEntries.data) {
			if (entry.kind !== 'directory') continue;

			const deckPath = `${systemPath}/${entry.name}`;
			const deckEntries = await fileSystem.list(deckPath);
			if (deckEntries.error) continue;

			const deckFileNames = new Set(deckEntries.data.map((file) => file.name));
			if (
				!deckFileNames.has('front.svg') ||
				!deckFileNames.has('back.svg') ||
				!deckFileNames.has('data.csv')
			) {
				continue;
			}

			const [frontFile, backFile, dataFile] = await Promise.all([
				fileSystem.read(`${deckPath}/front.svg`),
				fileSystem.read(`${deckPath}/back.svg`),
				fileSystem.read(`${deckPath}/data.csv`)
			]);

			if (frontFile.error || backFile.error || dataFile.error) continue;

			const svgFileFront = await frontFile.data.text();
			const svgFileBack = await backFile.data.text();
			const svgTemplateFront = loadSvgTemplate(svgFileFront);
			const svgTemplateBack = loadSvgTemplate(svgFileBack);

			const { spreadsheetData, imagePaths } = await loadSvgsAndData(
				projectName,
				entry.name,
				fileSystem,
				svgTemplateFront,
				svgTemplateBack,
				useDataUrls
			);

			const svgsFront = spreadsheetData.data.flatMap((row) => {
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
			const svgsBack = spreadsheetData.data.flatMap((row) => {
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

			const proj: Project = {
				svgsFront,
				svgsBack,
				name: entry.name
			};
			projectData.projects.push(proj);
		}

		return projectData;
	}

	const getFoldersProm = $derived(getFoldersToExport(fileSystem, projectName, useDataUrls));
	setProjectDataContext(() => getFoldersProm);
</script>

{@render children()}
