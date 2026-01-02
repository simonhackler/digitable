<!-- <script lang="ts"> -->
<!-- 	import { cn } from '$lib/utils/utils'; -->
<!-- 	import { toPng } from 'html-to-image'; -->
<!-- 	import { tick } from 'svelte'; -->
<!---->
<!-- 	let { -->
<!-- 		images, -->
<!-- 		w, -->
<!-- 		h, -->
<!-- 		onTakeScreenshot -->
<!-- 	}: { images: string[]; w: number; h: number; onTakeScreenshot: (file: File) => void } = $props(); -->
<!-- 	let sheetEl: HTMLDivElement; // TODO What is the correct init for this? -->
<!---->
<!-- 	const SHEET = 4096; -->
<!-- 	const dims = $derived(getGridDims(images.length, w, h)); -->
<!-- 	const colClass = $derived('grid-cols-' + dims.cols); -->
<!---->
<!-- 	let cellH = 0; -->
<!---->
<!-- 	function getGridDims(cards: number, w: number, h: number) { -->
<!-- 		let cols = Math.max(1, Math.floor(SHEET / w)); -->
<!-- 		while (Math.ceil(cards / cols) * h > SHEET) cols--; -->
<!-- 		return { cols, rows: Math.ceil(cards / cols) }; -->
<!-- 	} -->
<!---->
<!-- 	async function takeImage() { -->
<!-- 		const height = cellH * dims.rows; -->
<!-- 		const dataUrl = await toPng(sheetEl, { -->
<!-- 			width: 4096, -->
<!-- 			height, -->
<!-- 			pixelRatio: 2, -->
<!-- 			skipFonts: true -->
<!-- 		}); -->
<!-- 		const blob = await (await fetch(dataUrl)).blob(); -->
<!---->
<!-- 		const file = new File([blob], 'sheet.png', { -->
<!-- 			type: 'image/png', -->
<!-- 			lastModified: Date.now() -->
<!-- 		}); -->
<!---->
<!-- 		onTakeScreenshot(file); -->
<!-- 	} -->
<!---->
<!-- 	async function measure() { -->
<!-- 		await tick(); -->
<!-- 		const imgElements = Array.from(sheetEl.querySelectorAll('img')); -->
<!-- 		await Promise.all(imgElements.map((img) => img.decode())); -->
<!-- 		const cell = sheetEl?.querySelector('img'); -->
<!-- 		if (cell) { -->
<!-- 			const { height } = cell.getBoundingClientRect(); -->
<!-- 			cellH = height; -->
<!-- 		} -->
<!-- 	} -->
<!---->
<!--     async function measureAndTake() { -->
<!--         console.log('measuring and taking image'); -->
<!--         await measure(); -->
<!--         takeImage(); -->
<!--     } -->
<!---->
<!---->
<!-- 	$effect(() => { -->
<!-- 		if (images.length > 0) { -->
<!--             measureAndTake(); -->
<!-- 		} -->
<!-- 	}); -->
<!-- </script> -->
<!---->
<!-- {#if images} -->
<!-- 	<div class={cn('sheet grid', colClass)} bind:this={sheetEl}> -->
<!-- 		{#each images as image (image)} -->
<!-- 			<img -->
<!-- 				src={image} -->
<!-- 				alt="" -->
<!-- 				class="object-contain" -->
<!-- 				style={` -->
<!-- grid-template-columns: repeat(, minmax(0, 1fr));`} -->
<!-- 			/> -->
<!-- 		{/each} -->
<!-- 	</div> -->
<!-- {/if} -->
<!---->
<!-- <style> -->
<!-- 	.sheet { -->
<!-- 		width: 4096px; -->
<!-- 	} -->
<!-- </style> -->
