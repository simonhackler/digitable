<script lang="ts">
	import { onMount } from 'svelte';
	import PrintConfigurationBar from './print-configuration-bar.svelte';
	import type { Attachment } from 'svelte/attachments';
	import type { Project } from './types';
	import { Button } from '$lib/components/ui/button';
	import ClubIcon from '@lucide/svelte/icons/club';
	import HeartIcon from '@lucide/svelte/icons/heart';
	import SpadeIcon from '@lucide/svelte/icons/spade';
	import DiamondIcon from '@lucide/svelte/icons/diamond';

	export type PaperSize = 'A3' | 'A4' | 'A5' | 'US Letter' | 'US Legal';
	export type Orientation = 'Portrait' | 'Landscape';

	interface PageInfo {
		svgs: SVGSVGElement[];
		width: string;
		height: string;
		fitCalculation: {
			horizontal: number;
			vertical: number;
			total: number;
		};
	}

	let {
		projects
	}: {
		projects: Project[];
	} = $props();

	let paperSize: PaperSize = $state('A4');
	let orientation: Orientation = $state('Portrait');
	let fronts = $state(true);
	let backs = $state(false);
	let margin = $state(10);
	let cropMarks = $state(false);

	const paperSizes = {
		A3: { width: 297, height: 420 },
		A4: { width: 210, height: 297 },
		A5: { width: 148, height: 210 },
		'US Letter': { width: 216, height: 279 },
		'US Legal': { width: 216, height: 356 }
	};

	const pageDimensions = $derived(() => {
		const size = paperSizes[paperSize];
		return orientation === 'Portrait'
			? { width: `${size.width}mm`, height: `${size.height}mm` }
			: { width: `${size.height}mm`, height: `${size.width}mm` };
	});

	function calculateFitForSize(cardWidth: string, cardHeight: string) {
		const size = paperSizes[paperSize];
		const pageWidth = orientation === 'Portrait' ? size.width : size.height;
		const pageHeight = orientation === 'Portrait' ? size.height : size.width;

		// Account for margin on both sides (left/right for width, top/bottom for height)
		const availableWidth = pageWidth - margin * 2;
		const availableHeight = pageHeight - margin * 2;

		// Convert SVG dimensions from string to number (assuming they're in mm)
		const svgWidth = parseFloat(cardWidth.replace('mm', ''));
		const svgHeight = parseFloat(cardHeight.replace('mm', ''));

		const horizontalFit = Math.floor(availableWidth / svgWidth);
		const verticalFit = Math.floor(availableHeight / svgHeight);

		return {
			horizontal: horizontalFit,
			vertical: verticalFit,
			total: horizontalFit * verticalFit
		};
	}

	const pages = $derived((): PageInfo[] => {
		const allPages: PageInfo[] = [];

		projects.forEach((project) => {
			// Get card dimensions from this project
			const cardWidth = project.svgsFront[0]?.width.baseVal.valueAsString || '63mm';
			const cardHeight = project.svgsFront[0]?.height.baseVal.valueAsString || '89mm';
			const fitCalculation = calculateFitForSize(cardWidth, cardHeight);
			const svgsPerPage = fitCalculation.total;

			if (fronts && backs) {
				// Alternate between front and back pages for this project
				const frontSvgs = project.svgsFront;
				const backSvgs = project.svgsBack;

				const frontPageCount = Math.ceil(frontSvgs.length / svgsPerPage);
				const backPageCount = Math.ceil(backSvgs.length / svgsPerPage);
				const totalPages = frontPageCount + backPageCount;

				const projectPages = Array.from({ length: totalPages }, (_, pageIndex) => {
					const isFrontPage = pageIndex % 2 === 0;
					const pageTypeIndex = Math.floor(pageIndex / 2);

					if (isFrontPage) {
						const startIndex = pageTypeIndex * svgsPerPage;
						const endIndex = Math.min(startIndex + svgsPerPage, frontSvgs.length);
						return {
							svgs: frontSvgs.slice(startIndex, endIndex),
							width: cardWidth,
							height: cardHeight,
							fitCalculation
						};
					} else {
						const startIndex = pageTypeIndex * svgsPerPage;
						const endIndex = Math.min(startIndex + svgsPerPage, backSvgs.length);
						return {
							svgs: backSvgs.slice(startIndex, endIndex),
							width: cardWidth,
							height: cardHeight,
							fitCalculation
						};
					}
				});

				allPages.push(...projectPages);
			} else if (fronts) {
				// Only front SVGs from this project
				const frontSvgs = project.svgsFront;
				const pageCount = Math.ceil(frontSvgs.length / svgsPerPage);

				const projectPages = Array.from({ length: pageCount }, (_, pageIndex) => {
					const startIndex = pageIndex * svgsPerPage;
					const endIndex = Math.min(startIndex + svgsPerPage, frontSvgs.length);
					return {
						svgs: frontSvgs.slice(startIndex, endIndex),
						width: cardWidth,
						height: cardHeight,
						fitCalculation
					};
				});

				allPages.push(...projectPages);
			} else if (backs) {
				// Only back SVGs from this project
				const backSvgs = project.svgsBack;
				const pageCount = Math.ceil(backSvgs.length / svgsPerPage);

				const projectPages = Array.from({ length: pageCount }, (_, pageIndex) => {
					const startIndex = pageIndex * svgsPerPage;
					const endIndex = Math.min(startIndex + svgsPerPage, backSvgs.length);
					return {
						svgs: backSvgs.slice(startIndex, endIndex),
						width: cardWidth,
						height: cardHeight,
						fitCalculation
					};
				});

				allPages.push(...projectPages);
			}
		});

		return allPages;
	});
	let pageStyleEl: HTMLStyleElement;

	$effect(() => {
		updatePageRule(paperSize, orientation, margin);
	});

	function updatePageRule(paperSize: PaperSize, orientation: Orientation, _margin: number) {
		if (!pageStyleEl) return;
		pageStyleEl.textContent = `
			@page {
				size: ${paperSize} ${orientation.toLowerCase()};
                margin: ${0}mm;
			}
		`;
	}

	function attachSVGs(pageSvgs: SVGSVGElement[]): Attachment {
		return (element) => {
			pageSvgs.forEach((svg) => element.appendChild(svg));
			return () => pageSvgs.forEach((svg) => element.removeChild(svg));
		};
	}

	onMount(() => {
		pageStyleEl = document.createElement('style');
		pageStyleEl.media = 'print';
		document.head.appendChild(pageStyleEl);
		updatePageRule(paperSize, orientation, margin);
		return () => pageStyleEl.remove();
	});
</script>

<div class="mx-4 flex flex-col gap-4">
	<PrintConfigurationBar
		bind:paperSize
		bind:orientation
		bind:fronts
		bind:backs
		bind:margin
		bind:cropMarks
	/>
	{#if !fronts && !backs}
		<!-- Empty state when neither front nor back are selected -->
		<div class="flex flex-col items-center justify-center px-4 py-16 text-center">
			<div class="mb-6 flex items-center gap-2">
				<ClubIcon class="h-8 w-8 fill-gray-800 text-gray-800" />
				<HeartIcon class="h-8 w-8 fill-red-500 text-red-500" />
				<SpadeIcon class="h-8 w-8 fill-gray-800 text-gray-800" />
				<DiamondIcon class="h-8 w-8 fill-red-500 text-red-500" />
			</div>

			<h3 class="mb-3 text-2xl font-semibold">Select cards to print</h3>
			<p class="text-muted-foreground mb-8 max-w-md text-lg">
				Choose which sides of your cards you'd like to include in the print layout.
			</p>

			<div class="flex gap-3">
				<Button variant={fronts ? 'default' : 'outline'} onclick={() => (fronts = !fronts)}>
					Print Front Sides
				</Button>
				<Button variant={backs ? 'default' : 'outline'} onclick={() => (backs = !backs)}>
					Print Back Sides
				</Button>
			</div>
		</div>
	{:else}
		<!-- Existing sheets rendering -->
		<div class="sheets">
			{#each pages() as page, pageIndex (pageIndex)}
				<div
					class="sheet border border-gray-300"
					class:crop-marks={cropMarks}
					id="con-{pageIndex}"
					style:width={pageDimensions().width}
					style:height={pageDimensions().height}
					style:grid-template-columns={`repeat(${page.fitCalculation.horizontal}, ${page.width})`}
					style:--svg-w={page.width}
					style:--svg-h={page.height}
					style:padding={`${margin}mm`}
					style:--margin={`${margin}mm`}
					{@attach attachSVGs(page.svgs)}
				></div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.sheet {
		visibility: visible;
		display: grid;
		grid-auto-rows: max-content;
		grid-auto-flow: row;
		position: relative;
		top: 0;
		left: 0;
		margin: auto;
		justify-content: start;
		align-content: start;
		box-sizing: border-box;
	}

	.crop-marks::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 10;
		background-image:
			/* Vertical crop marks */
			repeating-linear-gradient(
				to right,
				transparent 0,
				transparent calc(var(--svg-w) - 0.5mm),
				black calc(var(--svg-w) - 0.5mm),
				black calc(var(--svg-w) - 0mm),
				transparent calc(var(--svg-w) - 0mm),
				transparent calc(var(--svg-w) + 0mm),
				black calc(var(--svg-w) + 0mm),
				black calc(var(--svg-w) + 0.5mm),
				transparent calc(var(--svg-w) + 0.5mm),
				transparent var(--svg-w)
			),
			/* Horizontal crop marks */
			repeating-linear-gradient(
					to bottom,
					transparent 0,
					transparent calc(var(--svg-h) - 0.5mm),
					black calc(var(--svg-h) - 0.5mm),
					black calc(var(--svg-h) - 0mm),
					transparent calc(var(--svg-h) - 0mm),
					transparent calc(var(--svg-h) + 0mm),
					black calc(var(--svg-h) + 0mm),
					black calc(var(--svg-h) + 0.5mm),
					transparent calc(var(--svg-h) + 0.5mm),
					transparent var(--svg-h)
				);
		background-size:
			var(--svg-w) 0.5mm,
			0.5mm var(--svg-h);
		background-position: var(--margin, 10mm) var(--margin, 10mm);
	}

	:global {
		#sheet svg {
			display: block;
		}
		@media print {
			/* Start by hiding everything… */
			html,
			body {
				margin: 0;
				padding: 0;
			}
			* {
				print-color-adjust: exact; /* modern */
				-webkit-print-color-adjust: exact; /* legacy WebKit/Blink */
			}
			body * {
				visibility: hidden;
			}
			.sheets {
				top: 0;
				left: 0;
				position: absolute;
			}
			.sheet * {
				visibility: visible;
			}
			.sheet {
				visibility: visible;
				position: relative;
				margin: 0 !important; /* override any padding */
				width: 100vw !important; /* Chrome & Edge map 100vw × 100vh to page size */
				height: 100vh !important; /* Firefox maps 100vw × 100vh to page size */
			}
			.crop-marks::before {
				visibility: visible;
			}
		}
	}
</style>
