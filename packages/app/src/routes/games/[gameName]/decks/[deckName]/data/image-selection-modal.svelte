<script lang="ts">
	import type jspreadsheet from 'jspreadsheet-ce';
	import { ImageEditor } from './custom-image';
	import ImageSelector from '../../../image-selector.svelte';

	type Selection = {
		borderLeftIndex: number;
		borderTopIndex: number;
		borderRightIndex: number;
		borderBottomIndex: number;
	};

	let {
		selection = null,
		spreadsheet,
		imagePaths: _imagePaths
	}: {
		selection?: Selection | null;
		spreadsheet: jspreadsheet.WorksheetInstance;
		imagePaths: Map<string, string>;
	} = $props();

	const selectionData = $derived.by(() => {
		if (!selection || !spreadsheet) {
			return { hasImageColumns: false, imageColumns: [], rowCount: 0, cellCount: 0 };
		}

		const headers = spreadsheet.getHeaders(true) as string[];
		const columns = spreadsheet.getConfig()?.columns;
		if (!columns) return { hasImageColumns: false, imageColumns: [], rowCount: 0, cellCount: 0 };

		const imageColumns: Array<{ index: number; name: string }> = [];
		for (let x = selection.borderLeftIndex; x <= selection.borderRightIndex; x++) {
			const column = columns[x];
			if (column && column.type === ImageEditor) {
				imageColumns.push({ index: x, name: headers[x] });
			}
		}

		const rowCount = selection.borderBottomIndex - selection.borderTopIndex + 1;
		return {
			hasImageColumns: imageColumns.length > 0,
			imageColumns,
			rowCount,
			cellCount: imageColumns.length * rowCount
		};
	});

	function applyImageToSelection(imagePath: string) {
		if (!selection || !imagePath) return;
		for (const column of selectionData.imageColumns) {
			for (let row = selection.borderTopIndex; row <= selection.borderBottomIndex; row++) {
				spreadsheet.setValueFromCoords(column.index, row, imagePath);
			}
		}
	}
</script>

<ImageSelector
	disabled={!selectionData.hasImageColumns}
	title="Select Image"
	description={`${selectionData.cellCount} selected image ${
		selectionData.cellCount === 1 ? 'cell' : 'cells'
	}`}
	detail={selectionData.imageColumns.map((column) => column.name).join(', ')}
	triggerLabel="Select Image"
	triggerVariant="ghost"
	triggerSize="sm"
	triggerClass="w-32 justify-start"
	onSelect={applyImageToSelection}
/>
