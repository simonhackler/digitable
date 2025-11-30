<!--
	Installed from github/simonhackler/svelte-file-explorer
-->

<script lang="ts" generics="TValue">
	import { renderComponent, renderSnippet } from '$lib/components/ui/data-table';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';

	import DataTableNameButton from './data-table-name-button.svelte';
	import FileBrowserItemIcon from './file-browser-item-icon.svelte';
	import { displaySize } from '$lib/components/ui/file-drop-zone';
	import {
		type ColumnDef,
		type ColumnFiltersState,
		getCoreRowModel,
		getSortedRowModel,
		getFilteredRowModel,
		type SortingState,
		type VisibilityState,
		type RowSelectionState
	} from '@tanstack/table-core';
	import { createSvelteTable, FlexRender } from '$lib/components/ui/data-table/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { cn } from '$lib/utils/utils';
	import {
		isFolder,
		type ExplorerNode
	} from '$lib/components/file-browser/browser-utils/types.svelte';
	import FileBrowserGridItem from './file-browser-grid-item.svelte';
	import type { Snippet } from 'svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Folders, Download, FolderOutput, Trash2 } from '@lucide/svelte';

	interface FileFunctions {
		deleteNodes: (nodes: ExplorerNode[]) => Promise<Error | null>;
		copyNodes: (nodes: ExplorerNode[]) => void;
		moveNodes: (nodes: ExplorerNode[]) => void;
		downloadNodes: (nodes: ExplorerNode[]) => Promise<Error | null>;
	}

	type DataTableProps<ExplorerNode, TValue> = {
		data: ExplorerNode[];
		display: 'list' | 'grid';
		actionList: Snippet<[ExplorerNode]>;
		onNodeClicked: (node: ExplorerNode) => void;
		class?: string;
		showActions?: boolean;
		fileFunctions?: FileFunctions;
	};

	let {
		data,
		class: className,
		onNodeClicked,
		display,
		actionList,
		showActions = true,
		fileFunctions
	}: DataTableProps<ExplorerNode, TValue> = $props();

	let sorting = $state<SortingState>([]);
	let columnFilters = $state<ColumnFiltersState>([]);
	let columnVisibility = $state<VisibilityState>({});
	let rowSelection = $state<RowSelectionState>({});

	export const columns: ColumnDef<ExplorerNode>[] = [
		{
			id: 'select',
			header: ({ table }) =>
				renderComponent(Checkbox, {
					checked: table.getIsAllPageRowsSelected(),
					indeterminate: table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
					onCheckedChange: (value) => table.toggleAllPageRowsSelected(!!value),
					'aria-label': 'Select all'
				}),
			cell: ({ row }) =>
				renderComponent(Checkbox, {
					checked: row.getIsSelected(),
					onCheckedChange: (value) => row.toggleSelected(!!value),
					onclick: blockClick,
					'aria-label': 'Select row'
				}),
			enableSorting: false
		},
		{
			id: 'icon',
			cell: ({ row }) => {
				return renderComponent(FileBrowserItemIcon, { node: row.original });
			}
		},
		{
			accessorKey: 'name',
			header: ({ column }) =>
				renderComponent(DataTableNameButton, {
					onclick: column.getToggleSortingHandler()
				})
		},
		{
			id: 'actions',
			cell: ({ row }) => {
				return renderSnippet(actionList, row.original);
			}
		},
		{
			accessorFn: (row) => {
				return displaySize(row?.fileData?.size || 0);
			},
			header: 'Size'
		}
	];

	const table = createSvelteTable({
		get data() {
			return data;
		},
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onSortingChange: (updater) => {
			if (typeof updater === 'function') {
				sorting = updater(sorting);
			} else {
				sorting = updater;
			}
		},
		onColumnFiltersChange: (updater) => {
			if (typeof updater === 'function') {
				columnFilters = updater(columnFilters);
			} else {
				columnFilters = updater;
			}
		},
		onColumnVisibilityChange: (updater) => {
			if (typeof updater === 'function') {
				columnVisibility = updater(columnVisibility);
			} else {
				columnVisibility = updater;
			}
		},
		onRowSelectionChange: (updater) => {
			if (typeof updater === 'function') {
				rowSelection = updater(rowSelection);
			} else {
				rowSelection = updater;
			}
		},
		state: {
			get sorting() {
				return sorting;
			},
			get columnFilters() {
				return columnFilters;
			},
			get columnVisibility() {
				return columnVisibility;
			},
			get rowSelection() {
				return rowSelection;
			}
		}
	});

	table.getColumn('actions')?.toggleVisibility(showActions);
	table.getColumn('select')?.toggleVisibility(showActions);

	function blockClick(e: MouseEvent) {
		e.stopPropagation();
	}
	function changeFolder(node: ExplorerNode) {
		onNodeClicked(node);
		if (!isFolder(node)) {
			return;
		}
		table.resetRowSelection();
	}

	async function executeFileFunction(
		nodes: ExplorerNode[],
		fileFunction: (nodes: ExplorerNode[]) => any
	) {
		fileFunction(nodes);
		table.resetRowSelection();
	}
</script>

<div class={cn('flex h-full flex-col', className)}>
	<div class="flex flex-0 items-center justify-between">
		<div class="flex items-center py-4">
			<Input
				placeholder="Filter files..."
				value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
				onchange={(e) => {
					table.getColumn('name')?.setFilterValue(e.currentTarget.value);
				}}
				oninput={(e) => {
					table.getColumn('name')?.setFilterValue(e.currentTarget.value);
				}}
				class="max-w-sm"
			/>
		</div>
		{#if table.getFilteredSelectedRowModel().rows.length > 0 && fileFunctions}
			<div class="flex items-center gap-2">
				{#snippet functionButton(fileFunction, text, Icon)}
					<Button
						onclick={() =>
							executeFileFunction(
								table.getFilteredSelectedRowModel().rows.map((r) => r.original),
								fileFunction
							)}><Icon />{text}</Button
					>
				{/snippet}
				{@render functionButton(fileFunctions.deleteNodes, 'Delete', Trash2)}
				{@render functionButton(fileFunctions.moveNodes, 'Move', FolderOutput)}
				{@render functionButton(fileFunctions.copyNodes, 'Copy', Folders)}
				{@render functionButton(fileFunctions.downloadNodes, 'Download', Download)}
			</div>
		{/if}
	</div>

	<ScrollArea class="min-h-0 flex-1 overflow-y-auto">
		<div class="w-full rounded-md border">
			<Table.Root>
				<Table.Header>
					{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
						<Table.Row>
							{#each headerGroup.headers as header (header.id)}
								<Table.Head>
									{#if !header.isPlaceholder}
										<FlexRender
											content={header.column.columnDef.header}
											context={header.getContext()}
										/>
									{/if}
								</Table.Head>
							{/each}
						</Table.Row>
					{/each}
				</Table.Header>
				{#if display === 'list'}
					<Table.Body>
						{#each table.getRowModel().rows as row (row.id)}
							<Table.Row
								data-state={row.getIsSelected() && 'selected'}
								onclick={() => changeFolder(row.original)}
							>
								{#each row.getVisibleCells() as cell (cell.id)}
									<Table.Cell>
										<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
									</Table.Cell>
								{/each}
							</Table.Row>
						{:else}
							<Table.Row>
								<Table.Cell colspan={columns.length} class="h-24 text-center"
									>No results.</Table.Cell
								>
							</Table.Row>
						{/each}
					</Table.Body>
				{/if}
			</Table.Root>
			{#if display === 'grid'}
				<div
					class="col-span-full grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8"
				>
					{#each table.getRowModel().rows as row (row.id)}
						<FileBrowserGridItem
							child={row.original}
							{showActions}
							onclick={() => changeFolder(row.original)}
							{actionList}
						>
							{#snippet checkbox()}
								<Checkbox
									class="absolute top-2 right-2"
									checked={row.getIsSelected()}
									onCheckedChange={(value) => row.toggleSelected(!!value)}
									onclick={blockClick}
								/>
							{/snippet}
						</FileBrowserGridItem>
					{/each}
				</div>
			{/if}
		</div>
	</ScrollArea>
</div>
