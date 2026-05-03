<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		type ExplorerNode,
		Folder,
		isFolder
	} from '$lib/components/file-browser/browser-utils/types.svelte';
	import type { FsDir } from '$lib/components/file-browser/adapters/adapter';

	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import BreadcrumbRecursive from '$lib/components/file-browser/browser-ui/breadcrumb-recursive.svelte';
	import DataTable from './data-table.svelte';
	import { List, Grid2x2 } from '@lucide/svelte/icons';
	import FileBrowserActions from './file-browser-actions.svelte';
	import { cn } from '$lib/utils/utils';
	import FileUpload from './file-upload.svelte';
	import MoveCopyDialog from './move-copy-dialog.svelte';
	import { Input } from '$lib/components/ui/input';
	import { ExplorerNodeFunctions } from '$lib/components/file-browser/browser-utils/explorer-node-functions';

	let {
		currentFolder = $bindable(),
		homeFolderPath = '/',
		fsDir,
		class: className,
		showActions = true
	}: {
		currentFolder: Folder;
		fsDir: FsDir;
		class?: string;
		homeFolderPath?: string;
		showActions?: boolean;
	} = $props();

	const explorerFunctions = $derived(new ExplorerNodeFunctions(fsDir, homeFolderPath));

	let display: 'grid' | 'list' = $state('grid');
	let createFolderInput: HTMLInputElement | null = $state(null);

	function setCurrentFolder(folder: Folder) {
		currentFolder = folder;
	}

	function clickedNode(item: ExplorerNode) {
		if (isFolder(item)) {
			setCurrentFolder(item);
		}
	}

	async function onUpload(file: File, overwrite?: boolean) {
		return await explorerFunctions.onUpload(file, currentFolder, overwrite);
	}

	const regex = /^(?!\s)(?!.*\s$)[A-Za-z0-9 ]+$/;
	let showCreateInput = $state(false);

	function createFolder() {
		const newFolderName = createFolderInput!.value;
		if (newFolderName === '') {
			return;
		}
		const valid = regex.test(newFolderName);
		if (!valid) {
			return;
		}
		currentFolder.children = [
			...currentFolder.children,
			new Folder(newFolderName, currentFolder, [])
		];
		showCreateInput = false;
	}

	async function deleteNode(node: ExplorerNode): Promise<void> {
		await explorerFunctions.deleteNodes([node]);
	}

	async function downloadNode(node: ExplorerNode): Promise<void> {
		await explorerFunctions.downloadNodes([node]);
	}

	const fileActions = $derived({
		deleteNodes: explorerFunctions.deleteNodes.bind(explorerFunctions),
		downloadNodes: async (nodes: ExplorerNode[]): Promise<Error | null> => {
			try {
				await explorerFunctions.downloadNodes(nodes);
				return null;
			} catch (error) {
				return error instanceof Error ? error : new Error(String(error));
			}
		},
		moveNodes: setActionMove,
		copyNodes: setActionCopy
	});

	let currentAction: 'copy' | 'move' = $state('copy');
	let openMoveCopy = $state(false);
	let selectedNodes = $state<ExplorerNode[]>([]);

	function setActionCopy(nodes: ExplorerNode[]) {
		currentAction = 'copy';
		openMoveCopyDialog(nodes);
	}

	function setActionMove(nodes: ExplorerNode[]) {
		currentAction = 'move';
		openMoveCopyDialog(nodes);
	}

	function openMoveCopyDialog(nodes: ExplorerNode[]) {
		selectedNodes = nodes;
		openMoveCopy = true;
	}

	async function handleCurrentAction(nodes: ExplorerNode[], currentFolder: Folder) {
		let error = null;
		if (currentAction === 'copy') {
			error = await explorerFunctions.copyNodes(nodes, currentFolder);
		} else if (currentAction === 'move') {
			error = await explorerFunctions.moveNodes(nodes, currentFolder);
		}
		if (error) {
			console.error(error);
		} else {
			openMoveCopy = false;
		}
	}
</script>

<div class={cn('flex flex-col', className)}>
	<div
		class="border-border bg-background mx-4 mb-4 flex flex-0 items-center justify-between rounded border p-4"
	>
		<Breadcrumb.Root>
			<Breadcrumb.List>
				<BreadcrumbRecursive
					folder={currentFolder}
					isLast={true}
					onBreadCrumbClick={(folder) => setCurrentFolder(folder)}
				/>
			</Breadcrumb.List>
		</Breadcrumb.Root>
		<div class="flex gap-2">
			<FileUpload
				uploadToAdapter={onUpload}
				filesInFolder={currentFolder.children.map((f) => f.name)}
			/>
			<Popover.Root bind:open={showCreateInput}>
				<Popover.Trigger>
					<Button variant="outline"><Plus />Folder</Button>
				</Popover.Trigger>
				<Popover.Content>
					<div class="flex flex-col gap-2">
						<Input placeholder="Folder name" bind:ref={createFolderInput}></Input>
						<Button onclick={() => createFolder()}>Create</Button>
					</div>
				</Popover.Content>
			</Popover.Root>
			<Button variant="outline" onclick={() => (display = display === 'grid' ? 'list' : 'grid')}>
				{#if display === 'list'}
					<Grid2x2 />
				{:else}
					<List />
				{/if}
			</Button>
		</div>
	</div>

	<DataTable
		data={currentFolder.children}
		onNodeClicked={clickedNode}
		{display}
		class="mx-4 min-h-0 flex-1"
		{showActions}
		{fileActions}
	>
		{#snippet actionList(node: ExplorerNode)}
			<FileBrowserActions
				{node}
				onDelete={deleteNode}
				onMove={(node) => setActionMove([node])}
				onCopy={(node) => setActionCopy([node])}
				onDownload={downloadNode}
			/>
		{/snippet}
	</DataTable>
</div>

<MoveCopyDialog
	bind:open={openMoveCopy}
	{handleCurrentAction}
	{currentAction}
	nodes={selectedNodes}
/>
