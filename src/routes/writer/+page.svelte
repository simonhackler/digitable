<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';

	import { onMount } from 'svelte';
	import jspreadsheet, { type Column } from 'jspreadsheet-ce';

	let columns: Column[] = $state([]);
	let data: string[][] = $state([[]]);
	let spreadsheet = $state(null);
	let svgTemplate: SVGSVGElement;

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
				type: 'text' as Column['type'],
				width: 100
			};
		});
		columns = textColumns;
		data = [texts.map((t) => t.textContent || '')];
		initSpreadsheet();
	}

	function generateSVG(row: string[]): SVGSVGElement | null {
		if (!svgTemplate) {
			return null;
		}
		const svg = svgTemplate.cloneNode(true) as SVGSVGElement;

		columns.forEach((col, idx) => {
			const el = svg.getElementById(col.title);
			if (el && el.tagName === 'text') {
				el.textContent = row[idx] || '';
			}
		});

		return svg;
	}

	function initSpreadsheet() {
		const spreadsheet = jspreadsheet(document.getElementById('spreadsheet') as HTMLDivElement, {
			worksheets: [
				{
					data,
					columns
				}
			]
		});
	}

	onMount(() => {
		parse();
	});

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
</script>

{#if data && data.length}
	<ScrollArea class="w-screen rounded-md border whitespace-nowrap" orientation="horizontal">
		<div class="flex w-full">
			{#each data as row (row)}
				{@const svg = generateSVG(row)}
				{#if svg}
					<div class="h-full w-90" {@attach attachSVG(svg)}></div>
				{/if}
			{/each}
		</div>
	</ScrollArea>
{/if}
<div id="spreadsheet"></div>
