<script lang="ts">
	import { page } from '$app/state';
	import { getFileSystemContext } from '../../context';
	import { loadSvgsAndData } from '../data-loader';
	import { generateSvg, loadSvgTemplate } from '../svg-helpers';
	import type { Project } from './types';
	import { ProjectData, setProjectDataContext } from './export-context.svelte';
	import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';
	import { requireParam } from '$lib/utils/assert';
	import { COMPONENTS_DIR } from '$lib/workspace/project-layout';

	const projectName = $derived(requireParam('gameName'));
	const fileSystem = getFileSystemContext();
	const useDataUrls = $derived(page.route.id !== '/games/[gameName]/export/paper');

	const { children } = $props();

	async function getFoldersToExport(fileSystem: FsDir, projectName: string, useDataUrls: boolean) {
		const projectData = new ProjectData();
		const componentsDir = await fileSystem.openDir(joinFsPath(projectName, COMPONENTS_DIR));
		if (componentsDir.error) {
			throw new Error(componentsDir.error.message);
		}

		const componentEntries = await componentsDir.data.list();
		if (componentEntries.error) throw new Error(componentEntries.error.message);

		for (const entry of componentEntries.data) {
			if (entry.kind !== 'directory') continue;

			const deckDir = await componentsDir.data.openDir(entry.name);
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

			const loadedSvgsAndData = await loadSvgsAndData(
				projectName,
				entry.name,
				fileSystem,
				svgTemplateFront,
				svgTemplateBack,
				useDataUrls
			);
			if (loadedSvgsAndData.error) throw new Error(loadedSvgsAndData.error.message);
			const { spreadsheetData, imagePaths } = loadedSvgsAndData.data;
			const idIndex = spreadsheetData.cols.findIndex((column) => column.title === 'id');
			const copiesIndex = spreadsheetData.cols.findIndex((column) => column.title === 'Copies');
			const headers = spreadsheetData.cols.map((column) => column.title as string);
			const rows = spreadsheetData.data.filter(
				(row) => String(row[idIndex] ?? '').trim() !== 'template'
			);
			if (rows.length === 0) continue;

			const svgsFront = rows.flatMap((row) => {
				const copies = row[copiesIndex] ? parseInt(row[copiesIndex]) : 1;

				return Array.from({ length: copies }, () =>
					generateSvg(svgTemplateFront, headers, row, imagePaths)
				);
			});
			const svgsBack = rows.flatMap((row) => {
				const copies = row[copiesIndex] ? parseInt(row[copiesIndex]) : 1;
				return Array.from({ length: copies }, () =>
					generateSvg(svgTemplateBack, headers, row, imagePaths, { columnPrefix: 'back_' })
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
