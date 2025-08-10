<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import type { PaperSize, Orientation } from './export-pages.svelte';

	interface Props {
		paperSize: PaperSize;
		orientation: Orientation;
		fronts: boolean;
		backs: boolean;
		margin: number;
		cropMarks: boolean;
	}

	let {
		paperSize = $bindable('A4'),
		orientation = $bindable('Portrait'),
		fronts = $bindable(true),
		backs = $bindable(false),
		margin = $bindable(10),
		cropMarks = $bindable(false)
	}: Props = $props();

	const paperSizes: PaperSize[] = ['A3', 'A4', 'A5', 'US Letter', 'US Legal'];

	function toggleOrientation() {
		orientation = orientation === 'Portrait' ? 'Landscape' : 'Portrait';
	}

	function handlePrint() {
		window.print();
	}
</script>

<div class="bg-background flex items-center gap-4 rounded-lg border p-4">
	<!-- Paper size selector -->
	<div class="flex items-center gap-2">
		<label class="text-sm font-medium">Paper size:</label>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger asChild>
				<Button variant="outline" class="min-w-[120px] justify-between">
					{paperSize}
					<ChevronDownIcon class="size-4" />
				</Button>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content>
				{#each paperSizes as size (size)}
					<DropdownMenu.Item onclick={() => (paperSize = size)}>
						{size}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>

	<!-- Orientation toggle -->
	<div class="flex items-center gap-2">
		<label class="text-sm font-medium">Orientation:</label>
		<Button variant="outline" onclick={toggleOrientation}>
			{orientation}
			{orientation === 'Portrait' ? '⇄' : '⇄'}
		</Button>
	</div>

	<!-- Fronts checkbox -->
	<div class="flex items-center gap-2">
		<Checkbox bind:checked={fronts} />
		<label class="text-sm font-medium">Fronts</label>
	</div>

	<!-- Backs checkbox -->
	<div class="flex items-center gap-2">
		<Checkbox bind:checked={backs} />
		<label class="text-sm font-medium">Backs</label>
	</div>

	<!-- Crop marks checkbox -->
	<div class="flex items-center gap-2">
		<Checkbox bind:checked={cropMarks} />
		<label class="text-sm font-medium">Crop marks</label>
	</div>

	<!-- Margin input -->
	<div class="flex items-center gap-2">
		<label class="text-sm font-medium">Margin (mm):</label>
		<Input type="number" bind:value={margin} min="0" max="50" class="w-20" />
	</div>

	<!-- Print button -->
	<Button onclick={handlePrint} class="ml-auto">Print</Button>
</div>
