<script lang="ts">
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { useDebounce } from 'runed';
	import Papa from 'papaparse';
	import jspreadsheet, { type JspreadsheetInstanceElement } from 'jspreadsheet-ce';
	import type { Attachment } from 'svelte/attachments';
	import { ScrollState } from 'runed';
	import { getFileSystemContext } from '../../../../context';
	import {
		generateSvg,
		initialSetupForSvgItem,
		updateSvg,
		createHighlightRect,
		appendHighlightToSvg
	} from '../../../svg-helpers';
	import { defaultContextMenuItems, type SheetContextMenuItem } from './default-contextmenu';
	import Toolbar from './toolbar.svelte';
	import { type CellValue } from 'jspreadsheet-ce';
	import { loadSvgsAndData } from '../../../data-loader';
	import type { SvgCard } from '../../../types';
	import { assert, requireParam } from '$lib/utils/assert';

	const {
		svgTemplateFront,
		svgTemplateBack
	}: { svgTemplateFront: SVGSVGElement; svgTemplateBack: SVGSVGElement } = $props();

	let scrollEl = $state<HTMLElement | null>(null);
	// $inspect(scrollEl);
	// TODO scroll state error. Ignore for now
	// When I comment out the next 3 line the inspect triggers correctly, when I leave them it does not. I just keep it for now
	// Seems to work now=
	const scroll = new ScrollState({
		element: () => scrollEl
	});

	const projectName = $derived(requireParam('gameName'));
	const cardName = $derived(requireParam('deckName'));
	const fileSystem = getFileSystemContext();

	const { svgData, spreadsheetData, imagePaths } = $derived(
		await loadSvgsAndData(projectName, cardName, fileSystem, svgTemplateFront, svgTemplateBack)
	);

	// TODO: I want this to be derived but there is something i don't understand about derived, reactivity and the object references
	let cards: SvgCard[] = $derived(
		spreadsheetData.data.map((row) => ({
			front: generateSvg(
				svgTemplateFront,
				spreadsheetData.cols.map((c) => c.title as string),
				row,
				imagePaths
			),
			back: generateSvg(
				svgTemplateBack,
				spreadsheetData.cols.map((c) => c.title as string).map((c) => c),
				row,
				imagePaths
			)
		}))
	);

	// Ideally this would be set directly from a reactive value from the spreadsheet
	let deletedSvgColumns = $derived(
		Array.from(svgData.values())
			.filter((col) => !spreadsheetData.cols.some((c) => c.title === col.title))
			.map((c) => c.title as string)
	);

	let showFront = $state(true);
	const svgsToShow = $derived(showFront ? cards.map((c) => c.front) : cards.map((c) => c.back));

	const saveDebounced = useDebounce(saveCsv, 1000);

	let spreadsheet: jspreadsheet.WorksheetInstance[] = $state([]);
	let selectionRects: SVGRectElement[] = [];

	function flip() {
		showFront = !showFront;
	}

	async function saveCsv(): Promise<void> {
		const rows = spreadsheet[0]?.getData() ?? [];
		if (!rows.length) return;
		const header = spreadsheet[0].getHeaders(true) as string[];

		const csvText = Papa.unparse([header, ...rows]);
		const csvFile = new File([csvText], 'data.csv', {
			type: 'text/csv',
			lastModified: Date.now()
		});
		const res = await fileSystem.upload(csvFile, `/${projectName}/system/${cardName}`, true);
		if (res) throw new Error(`Upload failed for data.csv: ${res.message}`);
	}

	function clearSelectionRects() {
		for (const rect of selectionRects) rect.remove();
		selectionRects = [];
	}

	function highlight(el: Element, svg: SVGSVGElement, pad = 4) {
		const scale = svg.viewBox.baseVal.width / svg.getBoundingClientRect().width;
		assert(el instanceof SVGGraphicsElement, 'svg must be an SVGSVGElement');
		const rect = createHighlightRect(el, svg, scale, pad * scale);
		if (rect) {
			selectionRects.push(rect);
			appendHighlightToSvg(rect, svg);
		}
	}

	let contextItems: SheetContextMenuItem[] = $state([]);

	function mountSpreadsheet(el: HTMLDivElement) {
		// Read reactive dependencies so attachment re-runs when data loads
		const { data, cols } = spreadsheetData;

		if (!data.length && !cols.length) {
			// Data not loaded yet, wait for it
			return;
		}

		const instance = jspreadsheet(el, {
			worksheets: [
				{
					data,
					columns: cols,
					allowInsertColumn: true,
					allowManualInsertColumn: false,
					allowDeleteColumn: true
				}
			],
			// @ts-expect-error Returning false is correct, typing is wrong here. Returning undefined causes contextmenu to not show up
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
				_instance,
				borderLeftIndex,
				borderTopIndex,
				borderRightIndex,
				borderBottomIndex,
				_origin
			) {
				// This could be nicer
				const width = svgsToShow[0]?.getBoundingClientRect().width || 480;
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
						const target = svgsToShow[y].getElementById(headers[x]);
						if (target) {
							highlight(target, svgsToShow[y]);
						}
					}
				}
				selection = {
					borderLeftIndex,
					borderTopIndex,
					borderRightIndex,
					borderBottomIndex
				};
			},
			onbeforedeletecolumn(_instance, removedColumns) {
				for (const colI of removedColumns) {
					const col = spreadsheet[0].getHeaders(true)[colI];
					if (col) {
						const svgCol = svgData.get(col);
						if (svgCol) {
							deletedSvgColumns.push(svgCol.title);
							for (const card of cards) {
								updateSvg(card.front, col, svgCol.data[0], imagePaths);
								updateSvg(card.back, col, svgCol.data[0], imagePaths);
							}
						}
					}
				}
				return true;
			},
			oninsertrow(_instance, rows) {
				const headers = spreadsheet[0].getHeaders(true) as string[];
				const rowsData = rows.map((row) => row.data.map((x) => x.toString()));
				const minRow = Math.min(...rows.map((row) => row.row || 0));

				const newCards: SvgCard[] = rowsData.map((row) => ({
					front: generateSvg(svgTemplateFront, headers, row, imagePaths),
					back: generateSvg(svgTemplateBack, headers, row, imagePaths)
				}));
				cards = [...cards.slice(0, minRow), ...newCards, ...cards.slice(minRow, cards.length)];
			},
			onafterchanges(_worksheet, _records) {
				saveDebounced();
			},
			ondeleterow(_instance, removedRows) {
				const filteredOutCards = removedRows.map((row) => cards[row]);
				cards = cards.filter((card) => !filteredOutCards.includes(card));
			},
			oneditionstart(_worksheet, cell, x, y) {
				cell.oninput = (e) => {
					if (e.target != null) {
						assert(
							e.target instanceof HTMLInputElement,
							'Expected event target to be an HTMLInputElement'
						);
						addImageAndUpdateSvg(x, y, e.target.value.toString());
					}
				};
			},
			onchange(_instance, cell, colIndex, rowIndex, newValue, _oldValue) {
				cell.oninput = null;
				if (typeof colIndex == 'string') {
					colIndex = parseFloat(colIndex);
				}
				if (typeof rowIndex == 'string') {
					rowIndex = parseFloat(rowIndex);
				}
				addImageAndUpdateSvg(colIndex, rowIndex, newValue.toString());
			},
			onsort(_instance, _colIndex, _order, _newOrderValues) {
				//TODO
			},

			onblur(_worksheet) {
				clearSelectionRects();
			}
		});

		// Store the spreadsheet instance globally for other functions to access
		spreadsheet = instance;

		return () => {
			if (instance) {
				jspreadsheet.destroy(el as JspreadsheetInstanceElement);
			}
		};
	}

	async function addImageAndUpdateSvg(x: number, y: number, value: string) {
		const headers = spreadsheet[0].getHeaders(true) as string[];
		if (!imagePaths.has(value)) {
			const [file] = await fileSystem.download([`/${projectName}/files/${value}`]);
			imagePaths.set(value, file.result ? URL.createObjectURL(file.result.data) : '');
		}
		updateSvg(cards[y].front, headers[x], value, imagePaths);
		updateSvg(cards[y].back, headers[x], value, imagePaths);
		cards = [...cards]; //TODO FORCE update for imageSelectionModal, very hacky.
	}

	function attachSVG(svg: SVGSVGElement): Attachment {
		return (element) => {
			element.appendChild(svg);
			svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
			Object.assign(svg.style, {
				display: 'block',
				width: 'auto',
				height: 'auto',
				maxWidth: '100%'
			});
			return () => {
				element.removeChild(svg);
			};
		};
	}

	function highlightColumn(col: string) {
		const column = svgData.get(col);
		if (!column) {
			throw new Error(`Column ${col} not found in svgData.cols`);
		}
		for (const svg of svgsToShow) {
			highlight(svg.getElementById(col)!, svg);
		}
	}

	function addColumn(col: string) {
		clearSelectionRects();
		const column = svgData.get(col);
		if (!column) {
			throw new Error(`Column ${col} not found in svgData.cols`);
		}
		deletedSvgColumns = deletedSvgColumns.filter((c) => c !== col);
		const data = Array(cards.length).fill((column.data[0] as CellValue) || '');
		const result = spreadsheet[0].insertColumn(
			1,
			spreadsheet[0].getHeaders(true).length, // how many columns
			false, // insert *after* column 1
			[
				{
					title: col,
					//type: 'text',
					// TODO choose correct type, text or ImageEditor
					//type: ImageEditor,
					width: 120
				}
			]
		);
		assert(result !== false, 'Failed to insert column into spreadsheet');
		spreadsheet[0].setColumnData(
			spreadsheet[0].getHeaders(true).length - 1,
			Array(cards.length).fill((column.data[0] as CellValue) || '')
		);

		for (const card of cards) {
			initialSetupForSvgItem(card.front, col, data[0], imagePaths);
			initialSetupForSvgItem(card.back, col, data[0], imagePaths);
		}
	}

	let selection: {
		borderLeftIndex: number;
		borderTopIndex: number;
		borderRightIndex: number;
		borderBottomIndex: number;
	} | null = $state(null);
</script>

<div
	bind:this={scrollEl}
	class="flex w-screen flex-nowrap gap-2 overflow-auto scroll-smooth rounded-md border whitespace-nowrap"
>
	{#each svgsToShow as svg, i (svg.id)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- ignore for now, should this then just be a button? -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			onclick={(e) => {
				const headers = spreadsheet[0].getHeaders(true) as string[];
				let node: EventTarget | null = e.target;
				let id: string | null = null;
				while (node && node !== e.currentTarget) {
					if (node instanceof Element) {
						const res = node.id;
						if (headers.some((c) => c === res)) {
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
			class="h-full shrink-0 rounded-lg border-8 border-zinc-950"
			{@attach attachSVG(svg)}
		></div>
	{/each}
</div>
<div class="px-2 py-2">
	<Toolbar
		{deletedSvgColumns}
		onAddColumn={addColumn}
		onHover={highlightColumn}
		onExitHover={(_x) => clearSelectionRects()}
		{flip}
		{selection}
		spreadsheet={spreadsheet[0]}
		svgTemplate={showFront ? svgTemplateFront : svgTemplateBack}
		{imagePaths}
		{cards}
		{showFront}
	></Toolbar>
</div>
<ContextMenu.Root>
	<ContextMenu.Trigger>
		<div id="spreadsheet" {@attach mountSpreadsheet}></div>
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
