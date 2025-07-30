<script lang="ts">
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { useDebounce } from 'runed';
	import Papa from 'papaparse';
	import { onMount, tick } from 'svelte';
	import jspreadsheet, { type Column } from 'jspreadsheet-ce';
	import { ScrollState } from 'runed';
	import { Button } from '$lib/components/ui/button';
	import ImageGrid from './image-grid.svelte';
	import { page } from '$app/state';
	import { toBlob } from 'html-to-image';
	import { getFileSystemContext } from '../../../../context';
	import {
		loadSvgTemplate,
		parseSvg,
		generateSvg,
		initialSetupForSvgItem,
		updateSvg,
		createHighlightRect,
		appendHighlightToSvg
	} from './svg-helpers';
	import { defaultContextMenuItems, type SheetContextMenuItem } from './default-contextmenu';
	import Toolbar from './toolbar.svelte';
	import { type CellValue } from 'jspreadsheet-ce';

	const { svgTemplate }: { svgTemplate: SVGSVGElement } = $props();

	let el = $state<HTMLElement>(null);
	const scroll = new ScrollState({
		element: () => el
	});

	const currentProject = $derived(page.params.gameName);
	const currentCard = $derived(page.params.deckName);
	const fullFolderPath = $derived(`/${currentProject}/system/${currentCard}/image.svg`);

	let svgs: SVGSVGElement[] = $state([]);
	const fileSystem = getFileSystemContext();

	const svgData = $derived(parseSvg(svgTemplate));
	const spreadsheetData = $state(svgData);

	const csvPath = $derived(`/${currentProject}/system/${currentCard}/data.csv`);
	const csvFileResult = $derived(fileSystem.download([csvPath]));
	let deletedSvgColumns: string[] = $state([]);
	let csvFile = $derived((await csvFileResult)[0].result?.data);

	function parseCsvFile(file: File): Promise<{ header: string[]; data: string[][] }> {
		return new Promise((resolve, reject) => {
			Papa.parse<string[]>(file, {
				complete: (result) => {
					if (result.errors.length) {
						return reject(result.errors);
					}
					const rows = result.data.filter((r) => r.length > 0);
					const header = rows.shift()!;
					resolve({ header, data: rows });
				},
				error: (err) => reject(err),
				skipEmptyLines: true
			});
		});
	}

	const saveDebounced = useDebounce(saveCsv, 1000);

	async function saveCsv(): Promise<void> {
		const rows = spreadsheet[0]?.getData() ?? [];
		if (!rows.length) return;
		const header = spreadsheet[0].getHeaders(true) as string[];
        await saveDataToCsv([header, ...rows]);
	}

	async function saveDataToCsv(csvData: CellValue[][]) {
		const csvText = Papa.unparse(csvData);
		const csvFile = new File([csvText], 'data.csv', {
			type: 'text/csv',
			lastModified: Date.now()
		});
		const res = await fileSystem.upload(csvFile, `/${currentProject}/system/${currentCard}`, true);

		if (res) throw new Error(`Upload failed for data.csv: ${res.message}`);
	}

	if (csvFile) {
		const csvData = await parseCsvFile(csvFile);
		const newCols: Column[] = [];
		for (const header of csvData.header) {
			const existingCol = spreadsheetData.cols.find((c) => c.title === header);
			if (existingCol) {
				newCols.push(existingCol);
			} else {
				newCols.push({ title: header, type: 'text' });
			}
		}
		spreadsheetData.cols = newCols;
		spreadsheetData.data = csvData.data;
		for (const col of svgData.cols) {
			if (!newCols.some((c) => c.title === col.title)) {
				deletedSvgColumns.push(col.title);
			}
		}
	} else {
		const header = spreadsheetData.cols.map((c) => c.title as string);
		const csvData = [header].concat(spreadsheetData.data);
        await saveDataToCsv(csvData);
	}

	let spreadsheet: jspreadsheet.WorksheetInstance[] = [];
	let selectionRects: SVGRectElement[] = [];
	let spreadsheetEl: HTMLDivElement;

	onMount(async () => {
		await generateSvgsAndRenderText(
			spreadsheetData.data,
			spreadsheetData.cols.map((c) => c.title)
		);
		initSpreadsheet(spreadsheetData.data, spreadsheetData.cols);
	});

	async function generateSvgsAndRenderText(rows: string[][], headers: string[], minRow = 0) {
		const newSvgs: SVGSVGElement[] = [];

		for (let i = 0; i < rows.length; i++) {
			const svg = generateSvg(svgTemplate);
			if (svg) {
				svgs.push(svg);
				newSvgs.push(svg);
				await tick();
				const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
				headers.forEach((col, idx) => {
					const el = svg.getElementById(col) as SVGGraphicsElement | null;
					const data = rows[i][idx] || '';
					initialSetupForSvgItem(svg, col, data, currentProject, fileSystem);
				});
			}
		}

		// Remove the newly added svgs from the end and insert them at the correct position
		if (newSvgs.length > 0) {
			svgs.splice(svgs.length - newSvgs.length, newSvgs.length);
			svgs.splice(minRow, 0, ...newSvgs);
		}
	}

	function clearSelectionRects() {
		for (const rect of selectionRects) rect.remove();
		selectionRects = [];
	}

	function highlight(el: Element, svg: SVGSVGElement, pad = 4) {
		const scale = svg.viewBox.baseVal.width / svg.getBoundingClientRect().width;
		const rect = createHighlightRect(el, svg, scale, pad * scale);
		if (rect) {
			selectionRects.push(rect);
			appendHighlightToSvg(rect, svg);
		}
	}

	function getSvgElementFromTable(
		colIndex: number,
		rowIndex: number,
		headers: string[]
	): Element | null {
		return svgs[rowIndex].getElementById(headers[colIndex]);
	}

	let contextItems: SheetContextMenuItem[] = $state([]);

	function initSpreadsheet(data: string[][], columns: Column[] = []) {
		if (!spreadsheetEl) return;

		spreadsheet = jspreadsheet(spreadsheetEl, {
			worksheets: [
				{
					data,
					columns,
					allowInsertColumn: true,
					allowManualInsertColumn: false,
					allowDeleteColumn: true
				}
			],
			contextMenu(instance, colIndex, rowIndex, event, items, role, x, y) {
				contextItems = defaultContextMenuItems(instance, x, y, role);
				instance.element.dispatchEvent(
					new CustomEvent('contextmenu', {
						detail: {
							colIndex,
							rowIndex,
							event,
							items,
							role,
							x,
							y
						}
					})
				);

				return false;
			},
			onselection(
				instance,
				borderLeftIndex,
				borderTopIndex,
				borderRightIndex,
				borderBottomIndex,
				origin
			) {
				const width = 480;
				let scrollTo = 0;
				if (borderTopIndex == 1) {
					scrollTo = width / 2;
				} else if (borderTopIndex > 1) {
					scrollTo = width * (borderTopIndex - 1) + width / 2;
				}
				scroll.scrollTo(scrollTo, 0);
				clearSelectionRects();
				const headers = spreadsheet[0].getHeaders(true) as string[];
				for (let x = borderLeftIndex; x <= borderRightIndex; x++) {
					for (let y = borderTopIndex; y <= borderBottomIndex; y++) {
						const target = getSvgElementFromTable(x, y, headers);
						if (!target) {
							return;
						}
						highlight(target, svgs[y]);
					}
				}
			},
			onbeforedeletecolumn(instance, removedColumns) {
				for (const colI of removedColumns) {
					const col = spreadsheet[0].getHeaders(true)[colI];
					if (col) {
						const svgCol = svgData.cols.findIndex((c) => c.title === col);
						if (svgCol !== -1) {
							deletedSvgColumns.push(svgData.cols[svgCol].title);
							for (const svg of svgs) {
								updateSvg(svg, col, svgData.data[0][svgCol], fileSystem, currentProject);
							}
						}
					}
				}
			},
			oninsertrow(instance, rows) {
				const headers = spreadsheet[0].getHeaders(true) as string[];
				const rowsData = rows.map((row) => row.data.map((x) => x.toString()));
				const minRow = Math.min(...rows.map((row) => row.row || 0));

				generateSvgsAndRenderText(rowsData, headers, minRow);
			},
			onafterchanges(worksheet: object, records: Array) {
				console.log('onafterchanges', worksheet, records);
				saveDebounced();
			},
			ondeleterow(instance, removedRows) {
				let removedCounter = 0;
				for (const row of removedRows.sort()) {
					svgs[row - removedCounter].remove();
					removedCounter += 1;
				}
			},
			oneditionstart(worksheet, cell, x, y) {
				cell.oninput = (e) => {
					const headers = spreadsheet[0].getHeaders(true) as string[];
					if (e.target != null) {
						updateSvg(svgs[y], headers[x], e.target.value, fileSystem, currentProject);
					}
				};
			},
			onchange(instance, cell, colIndex, rowIndex, newValue, oldValue) {
				const headers = spreadsheet[0].getHeaders(true) as string[];
				cell.oninput = null;
				updateSvg(
					svgs[rowIndex],
					headers[colIndex],
					newValue.toString(),
					fileSystem,
					currentProject
				);
			},
			onsort(instance, colIndex, order, newOrderValues) {
				//TODO
			},

			onblur(worksheet) {
				clearSelectionRects();
			}
		});
	}

	function attachSVG(svg: SVGSVGElement | null): Attachment {
		return (element) => {
			if (svg instanceof Node) {
				// svg.removeAttribute('width');
				// svg.removeAttribute('height');
				element.appendChild(svg);
				svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
				Object.assign(svg.style, {
					display: 'block',
					width: 'auto',
					height: 'auto',
					maxWidth: '100%'
				});
			}
			return () => {
				element.removeChild(svg);
			};
		};
	}

	async function exportSvgs() {
		const pngs = await Promise.all(
			svgs.map((svg) =>
				toBlob(svg, {
					cacheBust: true,
					pixelRatio: 5
				})
			)
		);

		const uploads = pngs.map((png, i) => {
			const fileName = `gen_${i + 1}.png`;
			const file = new File([png], fileName, {
				type: 'image/png',
				lastModified: Date.now()
			});
			return fileSystem!.upload(file, `system`, true).then((res) => {
				if (res) throw new Error(`Upload failed for ${fileName}: ${res.message}`);
			});
		});

		await Promise.all(uploads);
		gridImages = pngs.map((png) => URL.createObjectURL(png));
		w = svgs[0].getBoundingClientRect().width;
		h = svgs[0].getBoundingClientRect().height;
	}

	async function onTakeScreenshot(file: File) {
		await fileSystem!.upload(file, `${currentProject}/system/${currentCard}`, true).then((res) => {
			if (res) throw new Error(`Upload failed for sheet.png: ${res.message}`);
		});
		gridImages = [];
	}

	let sheetEl: HTMLDivElement;
	let gridImages: string[] = $state([]);

	let w = $state(0);
	let h = $state(0);

	function highlightColumn(col: string) {
		const colI = svgData.cols.findIndex((c) => c.title === col);
		if (colI === -1) {
			throw new Error(`Column ${col} not found in svgData.cols`);
		}
		for (const svg of svgs) {
			highlight(svg.getElementById(col)!, svg);
		}
	}

	function addColumn(col: string) {
		clearSelectionRects();
		const colI = svgData.cols.findIndex((c) => c.title === col);
		if (colI === -1) {
			throw new Error(`Column ${col} not found in svgData.cols`);
		}
		deletedSvgColumns = deletedSvgColumns.filter((c) => c !== col);
		const data = Array(svgs.length).fill((svgData.data[0][colI] as CellValue) || '');
		const result = spreadsheet[0].insertColumn(
			1,
			spreadsheet[0].getHeaders(true).length, // how many columns
			false, // insert *after* column 1
			[
				{
					title: col,
					type: 'text',
					width: 120
				}
			]
		);
		spreadsheet[0].setColumnData(
			spreadsheet[0].getHeaders(true).length - 1,
			Array(svgs.length).fill((svgData.data[0][colI] as CellValue) || '')
		);

		for (const svg of svgs) {
			initialSetupForSvgItem(svg, col, data[0], currentProject, fileSystem);
		}
	}
</script>

<Button onclick={() => exportSvgs()}>Export</Button>
<div
	bind:this={el}
	class="flex w-screen flex-nowrap gap-2 overflow-auto scroll-smooth rounded-md border whitespace-nowrap"
>
	{#each svgs as svg, i (svg)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- ignore for now, should this then just be a button? -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			onclick={(e) => {
				const headers = spreadsheet[0].getHeaders(true) as string[];
				let node: EventTarget | null = e.target;
				let id: string | null = null;
				while (node && node !== e.currentTarget) {
					if (node instanceof Element && node.id) {
						if (headers.some((c) => c === node.id)) {
							id = node.id;
							break;
						}
					}
					node = (node as Element).parentElement;
				}
				let index = -1;
				if (id) {
					index = headers.findIndex((c) => c === id);
				}
				if (index !== -1) {
					spreadsheet[0].updateSelectionFromCoords(index, i, index, i);
					const cell = spreadsheet[0].getCellFromCoords(index, i);
					spreadsheet[0].openEditor(cell, false, e);
				} else {
					spreadsheet[0].updateSelectionFromCoords(null, i, null, i);
				}
			}}
			class="h-full flex-shrink-0"
			{@attach attachSVG(svg)}
		></div>
	{/each}
</div>
<div class="px-2 py-2">
	<Toolbar
		{deletedSvgColumns}
		onAddColumn={addColumn}
		onHover={highlightColumn}
		onExitHover={(x) => clearSelectionRects()}
	></Toolbar>
</div>
<ContextMenu.Root>
	<ContextMenu.Trigger>
		<div id="spreadsheet" bind:this={spreadsheetEl}></div>
	</ContextMenu.Trigger>
	<ContextMenu.Content>
		{#each contextItems as item (item)}
			{#if item.type === 'line'}
				<ContextMenu.Separator />
			{:else}
				<ContextMenu.Item onclick={item.onclick}>
					{#if item.icon}
						<item.icon class="mr-2 h-4 w-4" />
					{/if}
					{item.title}
					{#if item.shortcut}
						<ContextMenu.Shortcut>
							{item.shortcut}
						</ContextMenu.Shortcut>
					{/if}
				</ContextMenu.Item>
			{/if}
		{/each}
	</ContextMenu.Content>
</ContextMenu.Root>
{#if gridImages != null}
	<div class="">
		<div bind:this={sheetEl} class="pointer-events-none absolute top-0 left-0">
			<ImageGrid images={gridImages} {w} {h} {onTakeScreenshot} />
		</div>
	</div>
{/if}
