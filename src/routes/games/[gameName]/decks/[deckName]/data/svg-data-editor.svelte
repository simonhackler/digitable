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
		parseSvg,
		generateSvg,
		initialSetupForSvgItem,
		updateSvg,
		createHighlightRect,
		appendHighlightToSvg,
		type SvgParseResult,
		type ColumnWithData
	} from './svg-helpers';
	import { defaultContextMenuItems, type SheetContextMenuItem } from './default-contextmenu';
	import Toolbar from './toolbar.svelte';
	import { type CellValue } from 'jspreadsheet-ce';
	import type { Adapter } from '$lib/components/file-browser/adapters/adapter';
	import AlertDialogDescription from '$lib/components/ui/alert-dialog/alert-dialog-description.svelte';

	const {
		svgTemplateFront,
		svgTemplateBack
	}: { svgTemplateFront: SVGSVGElement; svgTemplateBack: SVGSVGElement } = $props();

	let el = $state<HTMLElement>(null);
	const scroll = new ScrollState({
		element: () => el
	});

	const currentProject = $derived(page.params.gameName);
	const currentCard = $derived(page.params.deckName);
	const fileSystem = getFileSystemContext();

	const backPrefix = 'back_';
	const svgDataFront = $derived(parseSvg(svgTemplateFront));
	const svgDataBack = $derived(parseSvg(svgTemplateBack, backPrefix));
	const svgData = $derived(svgDataFront.concat(svgDataBack));
	$inspect(svgData, 'svgData');

	const csvPath = $derived(`/${currentProject}/system/${currentCard}/data.csv`);
	const csvFileResult = $derived(fileSystem.download([csvPath]));
	let csvFile = $derived((await csvFileResult)[0].result?.data);
	let csvData = $derived(csvFile ? parseCsvFile(csvFile) : null);
	const spreadsheetData = $derived(loadSpreadsheetData(svgData, await csvData));
	let deletedSvgColumns = $derived(
		svgData
			.filter((col) => !spreadsheetData.cols.some((c) => c.title === col.title))
			.map((c) => c.title as string)
	);

	const imagePaths = $derived(
		await loadImagePaths(svgData, spreadsheetData, deletedSvgColumns, fileSystem)
	);
	// TODO: I want these to be derived but there is something i don't understand about derived, reactivity and the object references
	let svgsFront: SVGSVGElement[] = $state(
		spreadsheetData.data.map((row) =>
			generateSvg(
				svgTemplateFront,
				spreadsheetData.cols.map((c) => c.title as string),
				row,
				imagePaths
			)
		)
	);
	let svgsBack: SVGSVGElement[] = $state(
		spreadsheetData.data.map((row) =>
			generateSvg(
				svgTemplateBack,
				spreadsheetData.cols.map((c) => c.title as string).map((c) => c),
				row,
				imagePaths
			)
		)
	);
	let svgs = $state(svgsFront);

	function flip() {
		svgs = svgs === svgsFront ? svgsBack : svgsFront;
	}

	function parseCsvFile(file: File): Promise<{ header: string[]; data: string[][] }> {
		return new Promise((resolve, reject) => {
			Papa.parse<string[]>(file, {
				complete: (result) => {
					if (result.errors.length) {
						return reject(result.errors);
					}
					const rows = result.data.filter((r) => r.length > 0);
					const header = rows.shift()!;
					console.log('CSV header:', header);
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

		const csvText = Papa.unparse([header, ...rows]);
		const csvFile = new File([csvText], 'data.csv', {
			type: 'text/csv',
			lastModified: Date.now()
		});
		const res = await fileSystem.upload(csvFile, `/${currentProject}/system/${currentCard}`, true);
		if (res) throw new Error(`Upload failed for data.csv: ${res.message}`);
	}

	async function loadImagePaths(
		svgData: ColumnWithData[],
		spreadsheetData: { cols: Column[]; data: string[][] },
		deletedSvgColumns: string[],
		fileSystem: Adapter
	) {
		const imagesInSpreadsheet = svgData.filter(
			(c) => !deletedSvgColumns.includes(c.title as string) && c.type === 'image'
		);
		const imageColumnIndices = imagesInSpreadsheet
			.map((imgCol) => spreadsheetData.cols.findIndex((col) => col.title === imgCol.title))
			.filter((idx) => idx !== -1);
		const imageStrings = Array.from(
			new Set(
				spreadsheetData.data.flatMap(
					(row) =>
						imageColumnIndices
							.map((i) => row[i]) // grab the value at each target index
							.filter(Boolean) // drop undefined / empty cells
				)
			)
		);
		// The download and files api is really bad
		const files = await fileSystem.download(
			imageStrings.map((img) => `/${currentProject}/files/${img}`)
		);
		// create a map of image paths to their URLs
		const imagePaths = new Map<string, string>();
		imageStrings.forEach((img, i) => {
			const file = files[i];
			if (file.result) {
				imagePaths.set(img, URL.createObjectURL(file.result.data));
			} else {
				console.warn(`File ${img} is not a Blob, skipping.`);
			}
		});
		return imagePaths;
	}

	function loadSpreadsheetData(
		svgData: ColumnWithData[],
		csvData: { header: string[]; data: string[][] } | null
	) {
		const svgCols: Column[] = svgData.map((c) => {
			return { title: c.title, type: 'text' };
		});
        svgCols.unshift({ title: 'Copies', type: 'text' }); // Add ID column at the start
		if (csvData) {
			const newCols: Column[] = [];
			for (const header of csvData.header) {
				const existingCol = svgCols.find((c) => c.title === header);
				if (existingCol) {
					newCols.push(existingCol);
				} else {
					newCols.push({ title: header, type: 'text' });
				}
			}
			return {
				cols: newCols,
				data: csvData.data
			};
		} else {
			return {
				cols: svgCols,
				data: svgData.map((row) => row.data) // Maybe I don't want this, could also be empty
			};
		}
	}

	let spreadsheet: jspreadsheet.WorksheetInstance[] = [];
	let selectionRects: SVGRectElement[] = [];
	let spreadsheetEl: HTMLDivElement;

	onMount(async () => {
		await tick(); // Don't understand why this is needed, the div should be initialized already
		initSpreadsheet(spreadsheetData.data, spreadsheetData.cols);
	});

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
				const width = svgs[0]?.getBoundingClientRect().width || 480;
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
						const target = svgs[y].getElementById(headers[x]);
						if (target) {
							highlight(target, svgs[y]);
						}
					}
				}
			},
			onbeforedeletecolumn(instance, removedColumns) {
				for (const colI of removedColumns) {
					const col = spreadsheet[0].getHeaders(true)[colI];
					if (col) {
						const svgCol = svgData.findIndex((c) => c.title === col);
						if (svgCol !== -1) {
							deletedSvgColumns.push(svgData[svgCol].title);
							for (const svg of svgsFront) {
								updateSvg(svg, col, svgData[svgCol].data[0], imagePaths);
							}
							for (const svg of svgsBack) {
								updateSvg(svg, col, svgData[svgCol].data[0], imagePaths);
							}
						}
					}
				}
			},
			oninsertrow(instance, rows) {
				const headers = spreadsheet[0].getHeaders(true) as string[];
				const rowsData = rows.map((row) => row.data.map((x) => x.toString()));
				const minRow = Math.min(...rows.map((row) => row.row || 0));

				const newSvgsFront = rowsData.map((row) =>
					generateSvg(svgTemplateFront, headers, row, imagePaths)
				);
				const newSvgsBack = rowsData.map((row) =>
					generateSvg(svgTemplateBack, headers, row, imagePaths)
				);
				svgsFront.splice(minRow, 0, ...newSvgsFront);
				svgsBack.splice(minRow, 0, ...newSvgsBack);
			},
			onafterchanges(worksheet: object, records: Array) {
				saveDebounced();
			},
			ondeleterow(instance, removedRows) {
				let removedCounter = 0;
				const filterOutFront = [];
				const filterOutBack = [];
				for (const row of removedRows.sort()) {
					svgsFront[row - removedCounter].remove();
					filterOutFront.push(svgsFront[row - removedCounter]);
					svgsBack[row - removedCounter].remove();
					filterOutBack.push(svgsBack[row - removedCounter]);
					removedCounter += 1;
				}
				svgsFront = svgsFront.filter((svg) => !filterOutFront.includes(svg));
				svgsBack = svgsBack.filter((svg) => !filterOutBack.includes(svg));
				svgs = svgs.filter((svg) => !filterOutFront.includes(svg) && !filterOutBack.includes(svg));
			},
			oneditionstart(worksheet, cell, x, y) {
				cell.oninput = (e) => {
					if (e.target != null) {
                        addImageAndUpdateSvg(x, y, e.target.value.toString());
					}
				};
			},
			onchange(instance, cell, colIndex, rowIndex, newValue, oldValue) {
				cell.oninput = null;
                addImageAndUpdateSvg(colIndex, rowIndex, newValue.toString());
			},
			onsort(instance, colIndex, order, newOrderValues) {
				//TODO
			},

			onblur(worksheet) {
				clearSelectionRects();
			}
		});
	}

	async function addImageAndUpdateSvg(x: number, y: number, value: string) {
		const headers = spreadsheet[0].getHeaders(true) as string[];
        if (!imagePaths.has(value)) {
            const file = await fileSystem.download([`/${currentProject}/files/${value}`]);
            if (file[0].result) {
                imagePaths.set(value, URL.createObjectURL(file[0].result.data));
            } else {
                imagePaths.set(value, '');
            }
        }
		updateSvg(svgsFront[y], headers[x], value, imagePaths);
		updateSvg(svgsBack[y], headers[x], value, imagePaths);
	}

	function attachSVG(svg: SVGSVGElement | null): Attachment {
		return (element) => {
			if (svg instanceof Node) {
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
			svgsFront.map((svg) =>
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
		w = svgsFront[0].getBoundingClientRect().width;
		h = svgsFront[0].getBoundingClientRect().height;
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
		const colI = svgData.findIndex((c) => c.title === col);
		if (colI === -1) {
			throw new Error(`Column ${col} not found in svgData.cols`);
		}
		for (const svg of svgs) {
			highlight(svg.getElementById(col)!, svg);
		}
	}

	function addColumn(col: string) {
		clearSelectionRects();
		const colI = svgData.findIndex((c) => c.title === col);
		if (colI === -1) {
			throw new Error(`Column ${col} not found in svgData.cols`);
		}
		deletedSvgColumns = deletedSvgColumns.filter((c) => c !== col);
		const data = Array(svgsFront.length).fill((svgData[colI].data[0] as CellValue) || '');
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
			Array(svgsFront.length).fill((svgData[colI].data[0] as CellValue) || '')
		);

		for (const svg of svgsFront) {
			initialSetupForSvgItem(svg, col, data[0], currentProject, fileSystem);
		}
		for (const svg of svgsBack) {
			initialSetupForSvgItem(svg, col, data[0], currentProject, fileSystem);
		}
	}
</script>

<Button onclick={() => exportSvgs()}>Export</Button>
<div
	bind:this={el}
	class="flex w-screen flex-nowrap gap-2 overflow-auto scroll-smooth rounded-md border whitespace-nowrap"
>
	{#each svgs as svg, i (svg.id)}
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
			class="h-full flex-shrink-0 rounded-lg border-8 border-zinc-950"
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
		{flip}
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
