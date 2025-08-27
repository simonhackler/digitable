<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import type jspreadsheet from 'jspreadsheet-ce';
	import GenerateImagesModal from './generate-images-modal.svelte';
	import ImageSelectionModal from './image-selection-modal.svelte';
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
		svgTemplate,
		imagePaths
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
		imagePaths: Map<string, string>;
	} = $props();

	const gameName = $derived(page.params.gameName);
	const cardName = $derived(page.params.deckName);
	const filesystem = getFileSystemContext();

	async function handleGenerateImages(images: ImageGenResponse) {
		console.log('Generated images:', images);
		const timestamp = Date.now();
		for (const image of images.results) {
			const response = await fetch(image.imageUrl);
			const blob = await response.blob();
			const filename = `${image.rowId}_${timestamp}_${image.columnName}.png`;
			const file = new File([blob], filename, { type: blob.type });
			await filesystem.upload(file, `${gameName}/files/generated`);

			const headers = spreadsheet.getHeaders(true) as string[];
			const columnIndex = headers.findIndex((header) => header === image.columnName);
			if (columnIndex !== -1) {
				// Find row index by matching rowId in first column
				const data = spreadsheet.getConfig()?.data;
				let rowIndex = -1;
				if (data) {
					for (let i = 0; i < data.length; i++) {
						const rowData = spreadsheet.getRowData(i) as string[];
						if (rowData[0] === image.rowId) {
							rowIndex = i;
							break;
						}
					}
				}
				if (rowIndex !== -1) {
					const currentValue = spreadsheet.getValueFromCoords(columnIndex, rowIndex);
					if (!currentValue || currentValue.toString().trim() === '') {
						spreadsheet.setValueFromCoords(columnIndex, rowIndex, `generated/${filename}`);
					}
				}
			}
		}
	}

	function handleImageSelection(selection: {
		cardIndex: number;
		columnName: string;
		imageUrl: string;
	}) {
		console.log('Image selection changed:', selection);
		// The spreadsheet update is handled directly in the modal component
		// This callback can be used for additional logic if needed
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
	<ImageSelectionModal
		{selection}
		{spreadsheet}
		{svgTemplate}
		{imagePaths}
		onSelectionChange={handleImageSelection}
	/>
</div>
