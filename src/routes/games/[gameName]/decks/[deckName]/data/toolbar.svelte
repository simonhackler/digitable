<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import type jspreadsheet from 'jspreadsheet-ce';
	import GenerateImagesModal from './generate-images-modal.svelte';
	import type { ImageGenResponse } from './image-generator.js';
	import { getFileSystemContext } from '../../../../context';
	import { page } from '$app/state';

	let {
		deletedSvgColumns,
		onAddColumn,
		onHover,
		onExitHover,
		flip,
		selection = null,
		spreadsheet,
		svgTemplate
	}: {
		deletedSvgColumns: string[];
		onAddColumn: (col: string) => void;
		onHover: (col: string) => void;
		onExitHover: (col: string) => void;
		flip: () => void;
		selection?: {
			borderLeftIndex: number;
			borderTopIndex: number;
			borderRightIndex: number;
			borderBottomIndex: number;
		} | null;
		spreadsheet: jspreadsheet.WorksheetInstance;
		svgTemplate: SVGSVGElement;
	} = $props();

	const gameName = $derived(page.params.gameName);
	const cardName = $derived(page.params.deckName);
	const filesystem = getFileSystemContext();

	async function handleGenerateImages(images: ImageGenResponse) {
		console.log('Generated images:', images);
		for (const image of images.results) {
			const response = await fetch(image.imageUrl);
			const blob = await response.blob();
			const filename = `${image.columnName}_${image.rowId}.png`;
			const file = new File([blob], filename, { type: blob.type });
			await filesystem.upload(file, `${gameName}/files/generated`);

			const headers = spreadsheet.getHeaders(true) as string[];
			const columnIndex = headers.findIndex((header) => header === image.columnName);
			if (columnIndex !== -1) {
                // TODO: get rowIndex from image.rowId
				const currentValue = spreadsheet.getValueFromCoords(columnIndex, image.rowIndex);
				if (!currentValue || currentValue.toString().trim() === '') {
					spreadsheet.setValueFromCoords(columnIndex, image.rowIndex, `generated/${filename}`);
				}
			}
		}
	}
</script>

<div class="flex w-full items-center gap-2">
	<Popover.Root>
		<Popover.Trigger><Button variant="outline">Add Svg data</Button></Popover.Trigger>
		<Popover.Content class="w-64">
			{#if deletedSvgColumns.length === 0}
				<div class="text-muted-foreground p-2 text-center">No deleted SVG columns</div>
			{:else}
				<div class="text-muted-foreground p-2 text-center">
					Add the following columns to the spreadsheet
				</div>
				{#each deletedSvgColumns as column (column)}
					<div class="flex gap-2">
						<Button
							variant="default"
							class="w-full"
							onclick={() => onAddColumn(column)}
							onmouseover={() => onHover(column)}
							onmouseleave={() => onExitHover(column)}
						>
							Add <b>{column}</b> to spreadsheet
						</Button>
					</div>
				{/each}
			{/if}
		</Popover.Content>
	</Popover.Root>
	<Button variant="outline" onclick={() => flip()}>Flip cards</Button>
	<GenerateImagesModal
		{selection}
		{spreadsheet}
		{svgTemplate}
		onGenerateImages={handleGenerateImages}
	/>
</div>
