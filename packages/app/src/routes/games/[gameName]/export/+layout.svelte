<script lang="ts">
	import { page } from '$app/state';
	import { getActiveProjectContext } from '../../context';
	import { loadSvgsAndDataForSidesFromSnapshot } from '../data-loader';
	import { generateSvg, loadSvgTemplate } from '../svg-helpers';
	import type { Project } from './types';
	import { ProjectData, setProjectDataContext } from './export-context.svelte';
	import { requireParam } from '$lib/utils/assert';
	import { decodeText, serializeProjectMember } from '$lib/collaboration';

	const projectName = $derived(requireParam('gameName'));
	const project = getActiveProjectContext();
	const useDataUrls = $derived(page.route.id !== '/games/[gameName]/export/paper');

	const { children } = $props();

	async function getFoldersToExport(projectName: string, useDataUrls: boolean) {
		const projectData = new ProjectData();
		const captured = await project.session.snapshot();
		if (captured.error) throw new Error(captured.error.message);
		const snapshot = captured.data;
		for (const front of snapshot
			.members('component-svg')
			.filter((member) => member.path.endsWith('/front.svg'))) {
			const name = front.path.split('/')[1];
			if (!name) continue;
			const back = snapshot.member('component-svg', `components/${name}/back.svg`);
			const data = snapshot.member('component-data', `components/${name}/data.csv`);
			if (!back || !data) continue;
			const svgTemplateFront = loadSvgTemplate(
				decodeText(serializeProjectMember('component-svg', front.document))
			);
			const svgTemplateBack = loadSvgTemplate(
				decodeText(serializeProjectMember('component-svg', back.document))
			);
			const loadedSvgsAndData = await loadSvgsAndDataForSidesFromSnapshot(
				projectName,
				name,
				snapshot,
				[
					{ template: svgTemplateFront },
					{ template: svgTemplateBack, columnPrefix: 'back_' }
				],
				data.document,
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
				name
			};
			projectData.projects.push(proj);
		}

		return projectData;
	}

	const getFoldersProm = $derived(getFoldersToExport(projectName, useDataUrls));
	setProjectDataContext(() => getFoldersProm);
</script>

{@render children()}
