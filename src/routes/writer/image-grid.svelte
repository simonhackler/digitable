<script lang="ts">
	import { cn } from '$lib/utils/utils';
	import { toPng } from 'html-to-image';

	let { images, w, h }: { images: string[]; w: number; h: number } = $props();
	let sheetEl: HTMLDivElement;

	const SHEET = 4096;

	const dims = $derived(getGridDims(images.length, w, h));
	const colClass = $derived('grid-cols-' + dims.cols);

	function getGridDims(cards: number, w: number, h: number) {
		let cols = Math.max(1, Math.floor(SHEET / w));
		while (Math.ceil(cards / cols) * h > SHEET) cols--;
		return { cols, rows: Math.ceil(cards / cols) };
	}

	async function takeImage() {
		const dataUrl = await toPng(sheetEl, {
			width: 4096,
			height: 676,
			pixelRatio: 2,
			skipFonts: true
		});
		const blob = await (await fetch(dataUrl)).blob();
	}
</script>

<div class={cn('sheet grid ', colClass)} bind:this={sheetEl}>
	{#each images as image (image)}
		<img src={image} alt="" class="object-contain" />
	{/each}
</div>

<style>
	.sheet {
		width: 4096px;
	}
</style>
