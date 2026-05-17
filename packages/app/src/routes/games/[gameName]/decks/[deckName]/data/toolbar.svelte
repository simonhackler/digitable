<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import type jspreadsheet from 'jspreadsheet-ce';
	import GenerateImagesModal from './generate-images-modal.svelte';
	import ImageSelectionModal from './image-selection-modal.svelte';
	import type { ImageGenResponse } from './image-generator.js';
	import { getFileSystemContext } from '../../../../context';
	import { joinFsPath } from '$lib/components/file-browser/adapters/adapter';
	import { requireParam } from '$lib/utils/assert';
	import { FlipHorizontal2, LayoutTemplate } from '@lucide/svelte';

	let {
		deletedSvgColumns,
		onAddColumn,
		onHover,
		onExitHover,
		flip,
		selection = null,
		showFront,
		editorPath,
		spreadsheet,
		svgTemplate,
		imagePaths
	}: {
		deletedSvgColumns: string[];
		onAddColumn: (col: string) => void;
		onHover: (col: string) => void;
		onExitHover: (col: string) => void;
		flip: () => void;
		selection: {
			borderLeftIndex: number;
			borderTopIndex: number;
			borderRightIndex: number;
			borderBottomIndex: number;
		} | null;
		showFront: boolean;
		editorPath: string;
		spreadsheet: jspreadsheet.WorksheetInstance;
		svgTemplate: SVGSVGElement;
		imagePaths: Map<string, string>;
	} = $props();

	const gameName = $derived(requireParam('gameName'));
	const filesystem = getFileSystemContext();

	async function handleGenerateImages(images: ImageGenResponse) {
		const timestamp = Date.now();
		const generatedDir = await filesystem.ensureDir(joinFsPath(gameName, 'files', 'generated'));
		if (generatedDir.error) {
			throw new Error(`Failed to open generated images folder: ${generatedDir.error.message}`);
		}

		for (const image of images.results) {
			const response = await fetch(image.imageUrl);
			if (!response.ok) {
				throw new Error(`Failed to download generated image: ${response.status}`);
			}
			const blob = await response.blob();
			const filename = `${image.rowId}_${timestamp}_${image.columnName}.png`;
			const file = new File([blob], filename, { type: blob.type });
			const written = await generatedDir.data.write(file.name, file);
			if (written.error) {
				throw new Error(`Failed to save generated image ${filename}: ${written.error.message}`);
			}

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
</script>

<div
	class="flex w-full flex-wrap items-center gap-2"
	role="toolbar"
	aria-label="Spreadsheet editor toolbar"
>
	<ButtonGroup.Root class="bg-background/70 rounded-xl border p-1 shadow-sm">
		<Button size="sm" variant="ghost" href={editorPath} title="Open Layout editor">
			<LayoutTemplate class="size-4" />
			Layout
		</Button>
		<Button
			size="sm"
			variant="ghost"
			class="w-20 justify-start"
			onclick={() => flip()}
			title="Flip card previews"
		>
			<FlipHorizontal2 class="size-4" />
			{showFront ? 'Back' : 'Front'}
		</Button>
	</ButtonGroup.Root>
	<ButtonGroup.Root class="bg-background/70 rounded-xl border p-1 shadow-sm">
		<Popover.Root>
			<Popover.Trigger>
				{#snippet child({ props })}
					<Button size="sm" variant="ghost" {...props}>Add SVG data</Button>
				{/snippet}
			</Popover.Trigger>
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
		<GenerateImagesModal
			{selection}
			{spreadsheet}
			{svgTemplate}
			onGenerateImages={handleGenerateImages}
		/>
		<ImageSelectionModal {selection} {spreadsheet} {imagePaths} />
	</ButtonGroup.Root>
</div>
