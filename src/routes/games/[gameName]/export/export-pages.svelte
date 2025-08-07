<script lang="ts">
	import { page } from "$app/state";
	import { onMount } from "svelte";

	export interface Sheet {
		name: string;
		svgs: SVGSVGElement[];
	}

	let {
		sheets,
		gameName
	}: {
		sheets: Sheet[];
		gameName: string;
	} = $props();

	let svgs: SVGSVGElement[] = $state(sheets[0].svgs);
	let sheetEl: HTMLDivElement;

	$effect(() => {
		svgs.forEach((svg) => {
			//svg.removeAttribute('width');
			//svg.removeAttribute('height');
		});
	});

	function attachSVGs(): Attachment {
		return (element) => {
			svgs.forEach((svg) => element.appendChild(svg));
			return () => svgs.forEach((svg) => element.removeChild(svg));
		};
	}

	const width = $derived(svgs[0].width.baseVal.valueAsString);
	const height = $derived(svgs[0].height.baseVal.valueAsString);
	// calculate the amount of svgs that can fit on a single page. Get page width and height from browser
    let pageSize = $state({ w: window.innerWidth, h: window.innerHeight });

	/* ———————————————————————————————————————————
	   2.  Helper that refreshes the numbers
	———————————————————————————————————————————*/
	function updateSize() {
		pageSize = { w: window.innerWidth, h: window.innerHeight };
	}

	/* ———————————————————————————————————————————
	   3.  Register listeners once, tear them down
	———————————————————————————————————————————*/
	onMount(() => {
		// normal resizes while on-screen
		window.addEventListener('resize', updateSize);

		// print-preview ↔︎ screen toggles (Chrome/Edge/Firefox)
		const mql = window.matchMedia('print');
		mql.addEventListener('change', updateSize);

		// back-stop for Safari & old engines
		window.addEventListener('beforeprint', updateSize);
		window.addEventListener('afterprint',  updateSize);

		// first call
		updateSize();

		return () => {
			window.removeEventListener('resize', updateSize);
			mql.removeEventListener('change', updateSize);
			window.removeEventListener('beforeprint', updateSize);
			window.removeEventListener('afterprint',  updateSize);
		};
	});

	/* ———————————————————————————————————————————
	   4.  Derived runes for convenience
	———————————————————————————————————————————*/
	const pageWidth  = $derived(pageSize.w);
	const pageHeight = $derived(pageSize.h);


</script>

<div class="dims">Heloo:  {pageWidth} × {pageHeight} {document.documentElement.clientWidth}</div>
<!-- ---------- markup ---------- -->
<div
	id="con"
	style:grid-template-columns={`repeat(auto-fill, ${width})`}
	style:--svg-w={width}
	style:--svg-h={height}
	bind:this={sheetEl}
	{@attach attachSVGs()}
></div>
<div id="print-grid" style:--col={width} style:--row={height} aria-hidden="true"></div>

<!-- ---------- print-aware layout ---------- -->
<style>
	@page {
		marks: crop;
	}

	#sheet {
		margin-inline: auto;
		width: 100%;
		height: 100%;

		display: grid;

		/* never stretch the items */
		grid-auto-rows: max-content;
		grid-auto-columns: max-content;
		grid-auto-flow: row dense;

		position: relative;
	}
            #con {
                display: flex;
                flex-wrap: wrap;
            }
            #con > * {
                flex: 0 0 auto;
            }

	:global {
		#sheet svg {
			display: block;
		}
		@media print {
			/* Start by hiding everything… */
            .dims {
                visibility: visible;
            }
            #con {
                /* position: absolute; */
                top: 0;
                left: 0;
                width: 100%;
                display: flex;
                flex-wrap: wrap;
            }
            #con > * {
                flex: 0 0 auto;
            }
			body * {
				visibility: hidden;
			}
            #con * {
                visibility: visible;
                z-index: 1000;
            }
			#sheet * {
				visibility: visible;
                z-index: 1000; /* ensure the sheet is on top */
			}
			#sheet {
				visibility: visible;
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(max-content, 1fr));
				position: relative;
				top: 0;
				left: 0;
                width: max-content;
                height: max-content;
                margin: auto;
                justify-content: center;
                align-content: center;
			}


			#print-grid {

                visibility: visible; /* show the grid */
				display: block;
				position: fixed; /* anchors to the page box, not the long element */
				top: 0;
				left: 0;
				width: 100vw; /* Chrome & Edge map 100vw × 100vh to page size */
				height: 100vh;
				z-index: -1000, yet… */
				pointer-events: none; /* …never blocks clicks in print preview  */

				/* ---- customise here ---- */
				--g-col: #000; /* line colour  */
				--g-thick: 1px; /* line weight */

				/* you can inject these numbers from JS exactly like you did before: */
				--col: 63mm; /* SVG width  */
				--row: 89mm; /* SVG height */

				background-image:
					repeating-linear-gradient(
						to right,
						var(--g-col) 0 var(--g-thick),
						transparent var(--g-thick) calc(var(--col))
					),
					repeating-linear-gradient(
						to bottom,
						var(--g-col) 0 var(--g-thick),
						transparent var(--g-thick) calc(var(--row))
					);

				outline: var(--g-thick) solid var(--g-col); /* outer frame */
				box-sizing: border-box;

				/* make sure colours actually print */
				-webkit-print-color-adjust: exact; /* Chrome / Edge */
				print-color-adjust: exact; /* Firefox */
			}
		}
	}
</style>
