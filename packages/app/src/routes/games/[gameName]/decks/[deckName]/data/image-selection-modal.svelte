<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type jspreadsheet from 'jspreadsheet-ce';
	import { ImageEditor } from './custom-image';
	import { getFileSystemContext } from '../../../../context';
	import { page } from '$app/state';
	import type { SvgCard } from '../../../types';
	import {
		type Folder,
		type ExplorerNode,
		isFolder
	} from '$lib/components/file-browser/browser-utils/types.svelte';

	let {
		selection = null,
		spreadsheet,
		imagePaths: _imagePaths,
		cards,
		showFront
	}: {
		selection?: {
			borderLeftIndex: number;
			borderTopIndex: number;
			borderRightIndex: number;
			borderBottomIndex: number;
		} | null;
		spreadsheet: jspreadsheet.WorksheetInstance;
		imagePaths: Map<string, string>;
		cards: SvgCard[];
		showFront: boolean;
	} = $props();

	let open = $state(false);
	let currentCardIndex = $state(0);

	const gameName = $derived(page.params.gameName);
	const filesystem = getFileSystemContext();

	let selectedImages = $state<Record<string, string>>({});
	let availableImages = $state<Record<string, string[]>>({});
	let imageIndices = $state<Record<string, number>>({});

	const selectionData = $derived.by(() => {
		if (!selection)
			return { hasImageColumns: false, imageColumns: [], totalRows: 0, availableColumns: [] };

		const headers = spreadsheet.getHeaders(true) as string[];
		const columns = spreadsheet.getConfig()?.columns;

		if (!columns)
			return { hasImageColumns: false, imageColumns: [], totalRows: 0, availableColumns: [] };

		const imageColumns = [];
		// Check if any selected columns are image type
		for (let x = selection.borderLeftIndex; x <= selection.borderRightIndex; x++) {
			const column = columns[x];
			if (column && column.type === ImageEditor) {
				imageColumns.push({ index: x, name: headers[x] });
			}
		}

		const totalRows = selection.borderBottomIndex - selection.borderTopIndex + 1;

		// Get all available columns for context
		const availableColumns = headers.map((header, index) => ({ name: header, index }));

		return {
			hasImageColumns: imageColumns.length > 0,
			imageColumns,
			totalRows,
			availableColumns
		};
	});

	const currentCardData = $derived.by(() => {
		if (!selection || !selectionData.hasImageColumns) return null;

		const rowIndex = selection.borderTopIndex + currentCardIndex;
		const rowData = spreadsheet.getRowData(rowIndex) as string[];
		const rowId = rowData[0]; // ID is always in the first column

		return {
			rowIndex,
			rowId,
			rowData
		};
	});

	const currentSvg = $derived.by(() => {
		if (!currentCardData || !cards.length) return null;

		const cardIndex = currentCardData.rowIndex;
		if (cardIndex >= cards.length) return null;

		// Get the appropriate SVG based on showFront
		const card = cards[cardIndex];
		return showFront ? (card.front.cloneNode(true) as SVGSVGElement) : card.back;
	});

	// Get available images for a specific rowId and column
	async function getAvailableImagesForColumn(rowId: string, columnName: string): Promise<string[]> {
		try {
			const rootFolder = await filesystem.getRootFolder();
			if (!rootFolder.result) return [];

			// Navigate to the generated folder
			const generatedFolder = findFolderInTree(
				rootFolder.result,
				gameName || '',
				'files',
				'generated'
			);
			if (!generatedFolder) return [];

			// Filter files that match the pattern: rowId_*_columnName.*
			const matchingFiles = generatedFolder.children
				.filter((child: ExplorerNode) => !isFolder(child)) // Only files, not folders
				.map((file) => file.name)
				.filter((filename: string) => {
					// Match pattern: rowId_timestamp_columnName.extension
					const regex = new RegExp(`^${rowId}_\\d+_${columnName}\\.[^.]+$`);
					return regex.test(filename);
				});

			// Convert to full paths for the imagePaths lookup
			return matchingFiles.map((filename: string) => `generated/${filename}`);
		} catch (error) {
			console.error('Error getting available images:', error);
			return [];
		}
	}

	function findFolderInTree(folder: Folder, ...pathSegments: string[]): Folder | null {
		let current: ExplorerNode | undefined = folder;
		for (const segment of pathSegments) {
			if (!current || !('children' in current)) return null;
			current = current.children.find((child) => child.name === segment);
		}
		return current && 'children' in current ? current : null;
	}

	// Initialize available images and indices when card changes
	$effect(() => {
		if (open && currentCardData) {
			(async () => {
				for (const column of selectionData.imageColumns) {
					const availableImagesForColumn = await getAvailableImagesForColumn(
						currentCardData.rowId,
						column.name
					);
					console.log('Available images for column', column.name, ':', availableImagesForColumn);
					availableImages[column.name] = availableImagesForColumn;

					// Initialize index to 0 or find current image index
					const currentValue = spreadsheet.getValueFromCoords(
						column.index,
						currentCardData.rowIndex
					);
					if (currentValue && currentValue.toString().trim()) {
						const currentImagePath = currentValue.toString();
						const currentIndex = availableImagesForColumn.indexOf(currentImagePath);
						imageIndices[column.name] = Math.max(0, currentIndex);
						selectedImages[column.name] = currentImagePath;
					} else {
						imageIndices[column.name] = 0;
						selectedImages[column.name] = availableImagesForColumn[0] || '';
					}
				}
			})();
		}
	});

	// Initialize selected images when card changes
	$effect(() => {
		if (currentCardData) {
			for (const column of selectionData.imageColumns) {
				const currentValue = spreadsheet.getValueFromCoords(column.index, currentCardData.rowIndex);
				if (currentValue && currentValue.toString().trim()) {
					selectedImages[column.name] = currentValue.toString();
				} else {
					selectedImages[column.name] = '';
				}
			}
		}
	});

	function switchCard(direction: -1 | 1) {
		if (!selection) return;
		const maxIndex = selection.borderBottomIndex - selection.borderTopIndex;
		currentCardIndex = Math.max(0, Math.min(maxIndex, currentCardIndex + direction));
	}

	function switchImage(columnName: string, step: -1 | 1) {
		const availableImagesForColumn = availableImages[columnName] || [];
		const len = availableImagesForColumn.length;

		if (len <= 1) return;

		const cur = imageIndices[columnName] || 0;
		const next = (cur + step + len) % len;

		imageIndices[columnName] = next;
		const newImageUrl = availableImagesForColumn[next];
		selectedImages[columnName] = newImageUrl;

		handleImageSelection(columnName, newImageUrl);
	}

	function handleImageSelection(columnName: string, imageUrl: string) {
		selectedImages[columnName] = imageUrl;
		if (currentCardData) {
			const column = selectionData.imageColumns.find((col) => col.name === columnName);
			if (column) {
				spreadsheet.setValueFromCoords(column.index, currentCardData.rowIndex, imageUrl);
			}
		}
	}

	function attachSVG(svg: SVGSVGElement) {
		return (element: HTMLElement) => {
			element.appendChild(svg);
			return () => {
				element.removeChild(svg);
			};
		};
	}
</script>

{#snippet columnBadge(name: string, type: string = 'primary')}
	<span
		class="bg-primary text-primary-foreground rounded px-2 py-1 text-xs {type === 'column'
			? 'font-medium'
			: ''}"
	>
		{name}
	</span>
{/snippet}

{#snippet columnHeader(columnName: string)}
	<div class="mb-2 flex items-center gap-2">
		{@render columnBadge(columnName, 'column')}
	</div>
{/snippet}

<Dialog.Root bind:open>
	<Dialog.Trigger
		class={buttonVariants({ variant: 'outline' })}
		disabled={!selectionData.hasImageColumns}
	>
		Select Images
	</Dialog.Trigger>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-[900px]">
		<Dialog.Header>
			<Dialog.Title>Select Images</Dialog.Title>
			<Dialog.Description>
				Select images for selected image columns in your cards.
			</Dialog.Description>
		</Dialog.Header>

		{#if selectionData.hasImageColumns}
			<div class="grid gap-4 py-4">
				<!-- Selection Summary -->
				<div class="bg-muted rounded-lg p-3">
					<h4 class="mb-2 text-sm font-medium">Selection Summary</h4>
					<p class="text-muted-foreground text-sm">
						Selecting images for {selectionData.totalRows} cards across {selectionData.imageColumns
							.length} image columns
					</p>
					<div class="mt-2">
						<span class="text-xs font-medium">Image columns:</span>
						{#each selectionData.imageColumns as column (column.index)}
							{@render columnBadge(column.name)}
						{/each}
					</div>
				</div>

				<!-- Card Navigation -->
				<div class="flex items-center justify-between">
					<Button
						variant="outline"
						size="sm"
						onclick={() => switchCard(-1)}
						disabled={currentCardIndex === 0}
					>
						Previous Card
					</Button>
					<div class="text-sm font-medium">
						Card {currentCardIndex + 1} of {selectionData.totalRows}
						{#if currentCardData}
							(ID: {currentCardData.rowId})
						{/if}
					</div>
					<Button
						variant="outline"
						size="sm"
						onclick={() => switchCard(1)}
						disabled={currentCardIndex >= selectionData.totalRows - 1}
					>
						Next Card
					</Button>
				</div>

				<!-- SVG Preview -->
				<div class="rounded-lg border p-4">
					<Label class="mb-2 block text-sm font-medium">Card Preview</Label>
					<div class="flex justify-center">
						{#if currentSvg}
							<div class="max-w-md" {@attach attachSVG(currentSvg)}></div>
						{:else}
							<div class="text-muted-foreground">No card data available</div>
						{/if}
					</div>
				</div>

				<!-- Image Selection Controls -->
				<div class="space-y-4">
					{#each selectionData.imageColumns as column (column.index)}
						<div class="space-y-2">
							{@render columnHeader(column.name)}
							<div class="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onclick={() => switchImage(column.name, -1)}
									disabled={!availableImages[column.name] ||
										availableImages[column.name].length <= 1}
								>
									←
								</Button>
								<div
									class="bg-muted flex min-h-[2rem] flex-1 items-center justify-center rounded px-2 py-1 text-center text-sm"
								>
									{#if availableImages[column.name] && availableImages[column.name].length > 0}
										<span class="text-xs">
											{imageIndices[column.name] + 1} / {availableImages[column.name].length}:
											{selectedImages[column.name] || 'No image selected'}
										</span>
									{:else}
										<span class="text-muted-foreground text-xs">No images available</span>
									{/if}
								</div>
								<Button
									variant="outline"
									size="sm"
									onclick={() => switchImage(column.name, +1)}
									disabled={!availableImages[column.name] ||
										availableImages[column.name].length <= 1}
								>
									→
								</Button>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<Dialog.Footer class="flex justify-between">
				<Button variant="outline" onclick={() => (open = false)}>Close</Button>
			</Dialog.Footer>
		{:else}
			<div class="grid gap-4 py-4">
				<div class="text-muted-foreground text-center">
					No image columns selected. Please select cells containing image columns to select images.
				</div>
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (open = false)}>Close</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
