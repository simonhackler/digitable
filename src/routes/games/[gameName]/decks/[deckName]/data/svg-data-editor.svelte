<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
    import Papa from 'papaparse';
	import { onMount, tick } from 'svelte';
	import jspreadsheet, { type Column } from 'jspreadsheet-ce';
	import { ScrollState } from 'runed';
	import { ExplorerNodeFunctions } from '$lib/components/file-browser/browser-utils/explorer-node-functions';
	import { Button } from '$lib/components/ui/button';
	import ImageGrid from './image-grid.svelte';
	import { page } from '$app/state';
	import { toBlob } from 'html-to-image';
	import { getFileSystemContext } from '../../../../context';
	import {
		loadSvgTemplate,
		parseSvg,
		generateSvg,
		appendForeignObjectByIdForText,
		updateSvg,
		createHighlightRect,
		appendHighlightToSvg
	} from './svg-helpers';

	const { svgFileText }: { svgFileText: string } = $props();

	let el = $state<HTMLElement>(null);
	const scroll = new ScrollState({
		element: () => el
	});

	const currentProject = $derived(page.params.gameName);
	const currentCard = $derived(page.params.deckName);
    const fullFolderPath = $derived(`/${currentProject}/system/${currentCard}/image.svg`);


    // TODO load csv file

	let svgs: SVGSVGElement[] = $state([]);
	const fileSystem = getFileSystemContext();

	const svgTemplate = $derived(loadSvgTemplate(svgFileText));
	const spreadsheetData = $derived(parseSvg(svgTemplate));

    const csvPath = `/${currentProject}/system/${currentCard}/data.csv`;
    const csvFileResult = (fileSystem.download([csvPath]));
    let csvFile = ((await csvFileResult)[0].result?.data);

    if (csvFile) {
        // Parse CSV file
        const csvData = csvFile.split('\n').map((row) => row.split(','));
        spreadsheetData.data = csvData.slice(1); // Skip header row
        spreadsheetData.cols = csvData[0].map((title) => ({ title }));
    } else {
        const header = spreadsheetData.cols.map((c) => c.title as string);
        const csvData = [header].concat(spreadsheetData.data);
        const csv = Papa.unparse(csvData)
        const csvFile = new File([csv], 'data.csv', {
            type: 'text/csv',
            lastModified: Date.now()
        });
        const res = await fileSystem.upload(csvFile, `/${currentProject}/system/${currentCard}`, true).then((res) => {
            if (res) throw new Error(`Upload failed for data.csv: ${res.message}`);
        });
    }

	let spreadsheet: jspreadsheet.WorksheetInstance[] = [];
	let selectionRects: SVGRectElement[] = [];

	onMount(async () => {
		await generateSvgAndRenderText(
			spreadsheetData.data[0],
			spreadsheetData.cols.map((c) => c.title)
		);
	});

	async function generateSvgAndRenderText(row: string[], headers: string[], pos = 0) {
		const svg = generateSvg(svgTemplate);
		if (svg) {
			svgs.splice(pos, 0, svg);
			await tick();
			headers.forEach((col, idx) => {
				appendForeignObjectByIdForText(svg, col, row[idx] || '');
			});
			await tick();
		}
	}

	function clearSelectionRects() {
		for (const rect of selectionRects) rect.remove();
		selectionRects = [];
	}

	function highlight(el: SVGGraphicsElement, svg: SVGSVGElement, pad = 4) {
		const rect = createHighlightRect(el, svg, pad);
		if (rect) {
			selectionRects.push(rect);
			appendHighlightToSvg(rect, svg);
		}
	}

	function getSvgElementFromTable(colIndex: number, rowIndex: number, headers: string[]) {
		return svgs[rowIndex].getElementById(headers[colIndex]);
	}

	function initSpreadsheet(data: string[][], columns: Column[] = []): Attachment {
		return (el) => {
			spreadsheet = jspreadsheet(el, {
				worksheets: [
					{
						data,
						columns,
						allowInsertColumn: false,
						allowManualInsertColumn: false,
						allowDeleteColumn: false
					}
				],
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
							highlight(target, svgs[y]);
						}
					}
				},
				oninsertrow(instance, rows) {
					const headers = spreadsheet[0].getHeaders(true) as string[];
					for (const row of rows) {
						//WARN this will probably not work for multiple inserts with data! Splicing into the svg array is bad
						generateSvgAndRenderText(
							row.data.map((x) => x.toString(), row.row),
							headers
						);
					}
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
			return () => {
				jspreadsheet.destroyAll();
			};
		};
	}

	function attachSVG(svg: SVGSVGElement | null): Attachment {
		return (element) => {
			if (svg instanceof Node) {
				svg.removeAttribute('width');
				svg.removeAttribute('height');
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
			class="h-full w-[480px] flex-shrink-0"
			{@attach attachSVG(svg)}
		></div>
	{/each}
</div>
<div id="spreadsheet" {@attach initSpreadsheet(spreadsheetData.data, spreadsheetData.cols)}></div>
{#if gridImages != null}
	<div class="">
		<div bind:this={sheetEl} class="pointer-events-none absolute top-0 left-0">
			<ImageGrid images={gridImages} {w} {h} {onTakeScreenshot} />
		</div>
	</div>
{/if}
