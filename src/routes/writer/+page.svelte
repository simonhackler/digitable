<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { toPng } from 'html-to-image';
	import { onMount, tick } from 'svelte';
	import jspreadsheet, { type Column } from 'jspreadsheet-ce';
	import { ScrollState } from 'runed';
	import type { Adapter } from '$lib/components/file-browser/adapters/adapter';
	import PickFolder from './pick-folder.svelte';
	import { ExplorerNodeFunctions } from '$lib/components/file-browser/browser-utils/explorer-node-functions';
	import { svgToPng } from './svg.helper';
	import { Button } from '$lib/components/ui/button';
	import ImageGrid from './image-grid.svelte';

	let el = $state<HTMLElement>();
	const scroll = new ScrollState({
		element: () => el
	});

	let fileSystem: Adapter | null = $state(null);
	let columns: Column[] = $state([]);
	let data: string[][] = $state([[]]);
	let svgs: SVGSVGElement[] = $state([]);
	let svgTemplate: SVGSVGElement;
	let selectionRects: SVGRectElement[] = [];
	let spreadsheet: jspreadsheet.WorksheetInstance[];

	async function parse() {
		const svgText = await fetch('image.svg').then((i) => i.text());
		const parser = new DOMParser();
		const doc = parser.parseFromString(svgText, 'image/svg+xml');
		svgTemplate = doc.documentElement as SVGSVGElement;
		const texts = Array.from(doc.querySelectorAll('text'));
		const images = Array.from(doc.querySelectorAll('image'));
		const textColumns = texts.map((t) => {
			return {
				title: t.id,
				type: 'text' as Column['type']
			};
		});
		const imageColumns = images.map((im) => {
			return { title: im.id, type: 'text' as Column['type'] };
		});
		columns = textColumns.concat(imageColumns);
		data = [texts.map((t) => t.textContent || '')];
		await generateSvgAndRenderText(data[0]);

		initSpreadsheet();
	}

	async function generateSvgAndRenderText(row: string[], pos = 0) {
		const svg = generateSvg(row);
		if (svg) {
			svgs.splice(pos, 0, svg);
			await tick();
			columns.forEach((col, idx) => {
				appendForeignObjectByIdForText(svg, col.title, data[0][idx] || '');
			});
			await tick();
			//const img = await svgToPng(svg);
		}
	}

	function clearSelectionRects() {
		for (const rect of selectionRects) rect.remove();
		selectionRects = [];
	}

	function highlight(el: SVGGraphicsElement, svg: SVGSVGElement, pad = 4) {
		const rootToScreen = svg.getScreenCTM();
		const elemToScreen = el.getScreenCTM();
		if (!rootToScreen || !elemToScreen) return;

		const screenToRoot = rootToScreen.inverse();

		// element's bbox in its own coord-sys
		const bb = el.getBBox();
		const p1 = svg.createSVGPoint();
		const p2 = svg.createSVGPoint();
		p1.x = bb.x - pad; // top-left (with padding)
		p1.y = bb.y - pad;
		p2.x = bb.x + bb.width + pad; // bottom-right
		p2.y = bb.y + bb.height + pad;

		// -> screen space -> root space
		const r1 = p1.matrixTransform(elemToScreen).matrixTransform(screenToRoot);
		const r2 = p2.matrixTransform(elemToScreen).matrixTransform(screenToRoot);

		const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		rect.setAttribute('x', String(r1.x));
		rect.setAttribute('y', String(r1.y));
		rect.setAttribute('width', String(r2.x - r1.x));
		rect.setAttribute('height', String(r2.y - r1.y));
		rect.setAttribute('rx', '4');
		rect.setAttribute('ry', '4');
		rect.style.fill = 'none';
		rect.style.stroke = 'dodgerblue';
		rect.style.strokeWidth = '4';

		let layer = svg.querySelector<SVGGElement>('g.cell-highlight-layer');
		if (!layer) {
			layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
			layer.classList.add('cell-highlight-layer');
			layer.style.pointerEvents = 'none';
			svg.append(layer); // on top
		}
		selectionRects.push(rect);
		layer.append(rect);
	}

	async function updateSvg(svg: SVGSVGElement, textId: string, newText: string) {
		const el = svg.getElementById(textId) as SVGGraphicsElement | null;
		if (!el) {
			throw new Error(`element with id ${textId} not found`);
		}
		if (el.tagName == 'foreignObject') {
			const div = el.querySelector('div');
			if (!div) {
				throw new Error('div not found');
			}
			div.textContent = newText;
		} else if (el.tagName == 'image') {
			const fileResults = await fileSystem!.download([newText]);
			const { result, error } = fileResults[0];
			if (error) {
				console.error(error);
			} else {
				const blob = result.data;
				const url = URL.createObjectURL(blob);
				el.setAttribute('href', url);
				el.setAttribute('xlink:href', url);
			}
		}
	}

	function appendForeignObjectByIdForText(svg: SVGSVGElement, elementId: string, html: string) {
		const el = svg.getElementById(elementId) as SVGGraphicsElement | null;
		if (!el || el.tagName !== 'text') return null;

		const { x, y, width, height } = el.getBBox();
		const fo = document.createElementNS(svg.namespaceURI, 'foreignObject');
		fo.setAttribute('x', x);
		fo.setAttribute('y', y);
		fo.setAttribute('width', width);
		fo.setAttribute('height', height);
		fo.id = elementId;
		el.parentNode!.appendChild(fo);
		el.parentNode!.removeChild(el);

		const div = document.createElement('div');
		div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
		div.style.width = '100%';
		div.style.height = '100%';
		div.style.overflow = 'hidden';
		div.style.whiteSpace = 'pre-wrap';
		div.textContent = html; // or innerHTML = html
		fo.appendChild(div);

		return fo;
	}

	function generateSvg(row: string[]): SVGSVGElement | null {
		if (!svgTemplate) {
			return null;
		}
		const svg = svgTemplate.cloneNode(true) as SVGSVGElement;
		return svg;
	}

	function getSvgElementFromTable(colIndex: number, rowIndex: number) {
		return svgs[rowIndex].getElementById(columns[colIndex].title);
	}

	function initSpreadsheet() {
		spreadsheet = jspreadsheet(document.getElementById('spreadsheet') as HTMLDivElement, {
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
				for (let x = borderLeftIndex; x <= borderRightIndex; x++) {
					for (let y = borderTopIndex; y <= borderBottomIndex; y++) {
						const target = getSvgElementFromTable(x, y);
						highlight(target, svgs[y]);
					}
				}
			},
			oninsertrow(instance, rows) {
				for (const row of rows) {
					//WARN this will probably not work for multiple inserts with data! Splicing into the svg array is bad
					generateSvgAndRenderText(row.data.map((x) => x.toString(), row.row));
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
					if (e.target != null) {
						updateSvg(svgs[y], columns[x].title, e.target.value);
					}
				};
			},
			onchange(instance, cell, colIndex, rowIndex, newValue, oldValue) {
				cell.oninput = null;
				updateSvg(svgs[rowIndex], columns[colIndex].title, newValue.toString());
				//svgs[rowIndex].getElementById(columns[colIndex].title).textContent = newValue.toString();
			},
			onsort(instance, colIndex, order, newOrderValues) {
				//TODO
			},

			onblur(worksheet) {
				clearSelectionRects();
			}
		});
	}

	$effect(() => {
		if (fileSystem) {
			parse();
			logFiles();
		}
	});

	async function logFiles() {
		const root = await fileSystem!.getRootFolder();
		if (root.result) {
			const files = ExplorerNodeFunctions.getAllFiles(root.result, '/');
			console.log(files);
		}
	}

	function attachSVG(svg: SVGSVGElement | null): Attachment {
		return (element) => {
			if (svg instanceof Node) {
				element.appendChild(svg);
				const { x, y, width, height } = svg.getBBox();
				svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
				Object.assign(svg.style, {
					display: 'block',
					width: '100%',
					height: '100%'
				});
			}
			return () => {
				element.removeChild(svg);
			};
		};
	}

	let hoverItemIndex: number | null = $state(null);
	async function exportSvgs() {
		const pngs = await Promise.all(svgs.map((svg) => svgToPng(svg)));

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
		images = pngs.map((png) => URL.createObjectURL(png));
		w = svgs[0].getBoundingClientRect().width;
		h = svgs[0].getBoundingClientRect().height;
		await tick();
		const imgElements = Array.from(sheetEl.querySelectorAll('img'));
		await Promise.all(imgElements.map((img) => img.decode()));

		const dataUrl = await toPng(sheetEl, {
			width: 4096,
			height: 676,
			pixelRatio: 2,
			skipFonts: true
		});
		const blob = await (await fetch(dataUrl)).blob();
		const file = new File([blob], 'sheet.png', {
			type: 'image/png',
			lastModified: Date.now()
		});
		//images = [];

		await fileSystem!.upload(file, `system`, true).then((res) => {
			if (res) throw new Error(`Upload failed for sheet.png: ${res.message}`);
		});
	}

	let sheetEl: HTMLDivElement;
	let images: string[] = $state([]);

	let w = $state(0);
	let h = $state(0);
</script>

{#if fileSystem}
	<Button onclick={() => exportSvgs()}>Export</Button>
	{#if data && data.length}
		<div
			bind:this={el}
			class="flex w-screen flex-nowrap overflow-auto scroll-smooth rounded-md border whitespace-nowrap"
		>
			{#each svgs as svg, i (svg)}
				{#if hoverItemIndex === i}{/if}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- ignore for now, should this then just be a button? -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					onclick={(e) => {
						let node: EventTarget | null = e.target;
						let id: string | null = null;
						while (node && node !== e.currentTarget) {
							if (node instanceof Element && node.id) {
								if (columns.some((c) => c.title === node.id)) {
									id = node.id;
									break;
								}
							}
							node = (node as Element).parentElement;
						}
						let index = -1;
						if (id) {
							index = columns.findIndex((c) => c.title === id);
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
	{/if}
	<div id="spreadsheet"></div>
{:else}
	<PickFolder
		onSetOpfsAdapter={(adapter) => {
			fileSystem = adapter;
		}}
	/>
{/if}
{#if images}
	<div class="">
		<div
			bind:this={sheetEl}
			class="pointer-events-none absolute top-0 left-0"
		>
			<ImageGrid {images} {w} {h} />
		</div>
	</div>
{/if}
