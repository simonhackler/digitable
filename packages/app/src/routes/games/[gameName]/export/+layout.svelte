<script lang="ts">
	import { page } from '$app/state';
	import { getFileSystemContext } from '../../context';
	import { loadSvgsAndData } from '../data-loader';
	import { generateSvg, loadSvgTemplate } from '../svg-helpers';
	import type { Project } from './types';
	import { ProjectData, setProjectDataContext } from './export-context.svelte';
	import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';
	import { requireParam } from '$lib/utils/assert';

	const projectName = $derived(requireParam('gameName'));
	const fileSystem = getFileSystemContext();
	const useDataUrls = $derived(page.route.id !== '/games/[gameName]/export/paper');

	const { children } = $props();

	async function getFoldersToExport(fileSystem: FsDir, projectName: string, useDataUrls: boolean) {
		const projectData = new ProjectData();
		const systemDir = await fileSystem.openDir(joinFsPath(projectName, 'system'));
		if (systemDir.error) {
			throw new Error(systemDir.error.message);
		}

		const systemEntries = await systemDir.data.list();
		if (systemEntries.error) throw new Error(systemEntries.error.message);

		for (const entry of systemEntries.data) {
			if (entry.kind !== 'directory') continue;

			const deckDir = await systemDir.data.openDir(entry.name);
			if (deckDir.error) continue;

			const deckEntries = await deckDir.data.list();
			if (deckEntries.error) continue;

			const deckFileNames = new Set(deckEntries.data.map((file) => file.name));
			if (
				!deckFileNames.has('front.svg') ||
				!deckFileNames.has('back.svg') ||
				!deckFileNames.has('data.csv')
			) {
				continue;
			}

			const [frontFile, backFile] = await Promise.all([
				deckDir.data.readText('front.svg'),
				deckDir.data.readText('back.svg')
			]);

			if (frontFile.error || backFile.error) continue;

			const svgTemplateFront = loadSvgTemplate(frontFile.data);
			const svgTemplateBack = loadSvgTemplate(backFile.data);

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
