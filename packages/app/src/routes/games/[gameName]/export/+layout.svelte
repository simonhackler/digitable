<script lang="ts">
	import { ExplorerNodeFunctions } from '$lib/components/file-browser/browser-utils/explorer-node-functions';
	import { page } from '$app/state';
	import { isFolder } from '$lib/components/file-browser/browser-utils/types.svelte';
	import { getFileSystemContext } from '../../context';
	import { loadSvgsAndData } from '../data-loader';
	import { generateSvg, loadSvgTemplate } from '../svg-helpers';
	import type { Project } from './types';
	import { ProjectData, setProjectDataContext } from './export-context.svelte';
	import type { Adapter } from '$lib/components/file-browser/adapters/adapter';
	import { assert, requireParam } from '$lib/utils/assert';

	const projectName = $derived(requireParam('gameName'));
	const fileSystem = getFileSystemContext();
	const useDataUrls = $derived(page.route.id !== '/games/[gameName]/export/paper');

	const { children } = $props();

	async function getFoldersToExport(
		fileSystem: Adapter,
		projectName: string,
		useDataUrls: boolean
	) {
		const projectData = new ProjectData();
		const root = await fileSystem.getRootFolder();
		if (!root.result) {
			throw new Error('No root folder found');
		}
		const res = root.result;
		if (res) {
			for (const child of res.children) {
				console.log(child.name);
			}
			const project = res.children.find((f) => f.name === projectName);
			assert(project, `Project folder "${projectName}" not found`);
			assert(isFolder(project), `"${projectName}" is not a folder`);
			const systemFolder = project.children.find((f) => f.name === 'system');
			assert(systemFolder, `"system" folder not found in project "${projectName}"`);
			assert(isFolder(systemFolder), `"system" folder not found in project "${projectName}"`);
			if (systemFolder?.children) {
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

								const { spreadsheetData, imagePaths } = await loadSvgsAndData(
									projectName,
									child.name,
									fileSystem,
									svgTemplateFront,
									svgTemplateBack,
									useDataUrls
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
								const proj: Project = {
									svgsFront,
									svgsBack,
									name: child.name
								};
								projectData.projects.push(proj);
							}
						}
					}
				}
			}
		}
		return projectData;
	}

	const getFoldersProm = $derived(getFoldersToExport(fileSystem, projectName, useDataUrls));
	setProjectDataContext(() => getFoldersProm);
</script>

{@render children()}
