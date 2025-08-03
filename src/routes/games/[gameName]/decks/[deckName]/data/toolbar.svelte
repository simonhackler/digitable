<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover/index.js';

	let {
		deletedSvgColumns,
		onAddColumn,
		onHover,
		onExitHover,
        flip
	}: {
		deletedSvgColumns: string[];
		onAddColumn: (col: string) => void;
		onHover: (col: string) => void;
		onExitHover: (col: string) => void;
        flip: () => void;
	} = $props();
</script>

<div class="flex w-full items-center gap-2">
	<Popover.Root>
		<Popover.Trigger><Button variant="outline">Add Svg data</Button></Popover.Trigger>
		<Popover.Content class="w-64">
			{#if deletedSvgColumns.length === 0}
				<div class="text-muted-foreground p-2 text-center">No deleted SVG columns</div>
			{:else}
				<div class="text-muted-foreground p-2 text-center">
					Add the following columns to the spreadsheet
				</div>
				{#each deletedSvgColumns as column (column)}
					<div class="flex gap-2">
						<Button
							variant="default"
							class="w-full"
							onclick={() => onAddColumn(column)}
							onmouseover={() => onHover(column)}
							onmouseleave={() => onExitHover(column)}
						>
							>Add <b>{column}</b> to spreadsheet</Button
						>
					</div>
				{/each}
			{/if}
		</Popover.Content>
	</Popover.Root>
    <Button variant="outline" onclick={() => flip()}>
        Flip cards
    </Button>
</div>
