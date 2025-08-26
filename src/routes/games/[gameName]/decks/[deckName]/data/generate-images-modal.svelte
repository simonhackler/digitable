<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import type jspreadsheet from 'jspreadsheet-ce';
	import { ImageEditor } from './custom-image';
	import { generateImages, type ImagePrompt, type ImageGenResponse } from './image-generator.js';
	import { extractImageDimensions } from './svg-utils.js';

	let {
		selection = null,
		spreadsheet,
		svgTemplate,
		onGenerateImages = () => {}
	}: {
		selection?: {
			borderLeftIndex: number;
			borderTopIndex: number;
			borderRightIndex: number;
			borderBottomIndex: number;
		} | null;
		spreadsheet: jspreadsheet.WorksheetInstance;
		svgTemplate: SVGSVGElement;
		onGenerateImages?: (images: ImageGenResponse) => void;
	} = $props();

	let open = $state(false);

	// Individual prompts for each image column
	let columnPrompts = $state<Record<string, string>>({});

	// Get selection data for image generation
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

		// Get all available columns for prompt building
		const availableColumns = headers.map((header, index) => ({ name: header, index }));

		return {
			hasImageColumns: imageColumns.length > 0,
			imageColumns,
			totalRows,
			availableColumns
		};
	});

	// Form validation - check if any column has a prompt
	const isValidPrompt = $derived(
		Object.values(columnPrompts).some((prompt) => prompt.trim().length > 0)
	);
	const totalImages = $derived(selectionData.imageColumns.length * selectionData.totalRows);

	// Initialize column prompts when selection changes
	$effect(() => {
		if (selectionData.imageColumns.length > 0) {
			for (const column of selectionData.imageColumns) {
				if (!(column.name in columnPrompts)) {
					columnPrompts[column.name] = '';
				}
			}
		}
	});

	// Generate preview prompts with real data from all selected rows
	const previewPrompts = $derived.by(() => {
		if (!selection) return [];

		const headers = spreadsheet.getHeaders(true) as string[];
		const allPrompts = [];

		// Generate prompts for all rows in selection
		for (
			let rowIndex = selection.borderTopIndex;
			rowIndex <= selection.borderBottomIndex;
			rowIndex++
		) {
			const rowData = spreadsheet.getRowData(rowIndex) as string[];
			const rowId = rowData[0]; // ID is always in the first column

			for (const imageColumn of selectionData.imageColumns) {
				// Extract dimensions from SVG template
				const dimensions = extractImageDimensions(svgTemplate, imageColumn.name);

				// Use individual column prompt
				const promptToUse = columnPrompts[imageColumn.name] || '';
				if (!promptToUse.trim()) {
					allPrompts.push({
						columnName: imageColumn.name,
						prompt: '',
						rowIndex: rowIndex,
						rowId: rowId,
						aspectRatio: dimensions.aspectRatio
					});
					continue;
				}

				const prompt = promptToUse.replace(/{(\w+)}/g, (match: string, columnName: string) => {
					const columnIndex = headers.findIndex((header) => header === columnName);
					if (columnIndex !== -1 && rowData[columnIndex]) {
						return rowData[columnIndex];
					}
					return match; // Keep placeholder if column not found or empty
				});

				allPrompts.push({
					columnName: imageColumn.name,
					prompt,
					rowIndex: rowIndex,
					rowId: rowId,
					aspectRatio: dimensions.aspectRatio
				});
			}
		}

		return allPrompts;
	});

	function insertColumnPlaceholderToField(targetColumn: string, columnName: string) {
		columnPrompts[targetColumn] = (columnPrompts[targetColumn] || '') + `{${columnName}}`;
	}

	async function handleGenerate() {
		if (!isValidPrompt) return;

		// Convert prompts to the expected format and call generateImages
		const imagePrompts: ImagePrompt[] = previewPrompts.filter((p) => p.prompt.trim().length > 0);
		const images = await generateImages(imagePrompts);

		open = false;
		if (images) {
            console.log('Generated images:', images);
			onGenerateImages(images);
		}
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

{#snippet promptPreviewCard(preview: { columnName: string; prompt: string })}
	<div class="rounded-lg border p-3">
		{@render columnHeader(preview.columnName)}
		<div class="bg-muted rounded p-2 font-mono text-sm">
			{preview.prompt || 'No prompt specified'}
		</div>
	</div>
{/snippet}

{#snippet quickInsertButtons(targetColumnName: string)}
	<div class="flex flex-wrap gap-1">
		<span class="text-muted-foreground mr-2 text-xs">Quick insert:</span>
		{#each selectionData.availableColumns.slice(0, 8) as availableColumn (availableColumn.index)}
			<Button
				variant="outline"
				size="sm"
				onclick={() => insertColumnPlaceholderToField(targetColumnName, availableColumn.name)}
				class="h-6 px-2 text-xs"
			>
				{availableColumn.name}
			</Button>
		{/each}
	</div>
{/snippet}

<Dialog.Root bind:open>
	<Dialog.Trigger
		class={buttonVariants({ variant: 'outline' })}
		disabled={!selectionData.hasImageColumns}
	>
		Generate Images
	</Dialog.Trigger>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-[900px]">
		<Dialog.Header>
			<Dialog.Title>Generate Images</Dialog.Title>
			<Dialog.Description>
				Generate AI images for selected image columns in your cards.
			</Dialog.Description>
		</Dialog.Header>

		{#if selectionData.hasImageColumns}
			<div class="grid gap-4 py-4">
				<!-- Selection Summary -->
				<div class="bg-muted rounded-lg p-3">
					<h4 class="mb-2 text-sm font-medium">Selection Summary</h4>
					<p class="text-muted-foreground text-sm">
						Generating {totalImages} images for {selectionData.totalRows} rows across {selectionData
							.imageColumns.length} image columns
					</p>
					<div class="mt-2">
						<span class="text-xs font-medium">Image columns:</span>
						{#each selectionData.imageColumns as column, i (column.index)}
							{@render columnBadge(column.name)}
						{/each}
					</div>
				</div>

				<!-- Tabbed Interface for Multiple Columns -->
				{#if selectionData.imageColumns.length === 1}
					<!-- Single column - show both prompt and preview without tabs -->
					<div class="space-y-4">
						<div class="space-y-2">
							<Label>Prompt Template for {selectionData.imageColumns[0].name}</Label>
							<Input
								id="prompt-{selectionData.imageColumns[0].name}"
								bind:value={columnPrompts[selectionData.imageColumns[0].name]}
								placeholder="Enter prompt for {selectionData.imageColumns[0]
									.name}, e.g., 'A fantasy character holding a {'{weapon}'}'"
								class="w-full"
							/>
							{@render quickInsertButtons(selectionData.imageColumns[0].name)}
						</div>

						{#if previewPrompts.some((p) => p.prompt.trim())}
							<div class="space-y-2">
								<Label>Prompt Preview (with real data from first row)</Label>
								{@render promptPreviewCard(
									previewPrompts.find(
										(p) => p.columnName === selectionData.imageColumns[0].name
									) || {
										columnName: selectionData.imageColumns[0].name,
										prompt: 'No prompt specified'
									}
								)}
								<p class="text-muted-foreground text-xs">
									Preview shows how your template will look with actual data from row {(selection?.borderTopIndex ??
										0) + 1}
								</p>
							</div>
						{:else}
							<div class="space-y-2">
								<Label>Prompt Preview (with real data from first row)</Label>
								{@render promptPreviewCard({
									columnName: selectionData.imageColumns[0].name,
									prompt: 'No prompt specified'
								})}
								<p class="text-muted-foreground text-xs">
									Preview shows how your template will look with actual data from row {(selection?.borderTopIndex ??
										0) + 1}
								</p>
							</div>
						{/if}
					</div>
				{:else}
					<!-- Multiple columns - use tabs for each column -->
					<Tabs.Root value={selectionData.imageColumns[0].name} class="w-full">
						<Tabs.List
							class="grid w-full"
							style="grid-template-columns: repeat({selectionData.imageColumns
								.length}, minmax(0, 1fr))"
						>
							{#each selectionData.imageColumns as column (column.index)}
								<Tabs.Trigger value={column.name} class="text-xs">
									{column.name}
								</Tabs.Trigger>
							{/each}
						</Tabs.List>
						{#each selectionData.imageColumns as column (column.index)}
							<Tabs.Content value={column.name} class="mt-4 space-y-4">
								<!-- Prompt Section -->
								<div class="space-y-2">
									<div class="flex items-center gap-2">
										<Label for="prompt-{column.name}" class="text-sm font-medium">
											{column.name}
										</Label>
										{@render columnBadge('image column')}
									</div>
									<Input
										id="prompt-{column.name}"
										bind:value={columnPrompts[column.name]}
										placeholder="Enter prompt for {column.name}, e.g., 'A fantasy character holding a {'{weapon}'}'"
										class="w-full"
									/>
									{@render quickInsertButtons(column.name)}
								</div>

								<!-- Preview Section -->
								{@const previewData = previewPrompts.find(
									(p) => p.columnName === column.name && p.rowIndex === selection?.borderTopIndex
								)}
								<div class="space-y-2">
									<Label>Prompt Preview (with real data from first row)</Label>
									{@render promptPreviewCard(
										previewData || { columnName: column.name, prompt: 'No prompt specified' }
									)}
									<p class="text-muted-foreground text-xs">
										Preview shows how your template will look with actual data from row {(selection?.borderTopIndex ??
											0) + 1}
									</p>
								</div>
							</Tabs.Content>
						{/each}
					</Tabs.Root>
				{/if}
			</div>

			<Dialog.Footer class="flex justify-between">
				<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button onclick={handleGenerate} disabled={!isValidPrompt} class="bg-primary">
					Generate {totalImages} Images
				</Button>
			</Dialog.Footer>
		{:else}
			<div class="grid gap-4 py-4">
				<div class="text-muted-foreground text-center">
					No image columns selected. Please select cells containing image columns to generate
					images.
				</div>
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
