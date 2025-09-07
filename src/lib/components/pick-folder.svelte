<script lang="ts">
	import { OPFSAdapter } from '$lib/components/file-browser/adapters/opfs/opdfs-adapter';
	import { onMount } from 'svelte';
	import { get, set } from 'idb-keyval';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button';

	let { onSetOpfsAdapter }: { onSetOpfsAdapter: (opfsAdapter: OPFSAdapter) => void } = $props();

	let opfsAdapter: OPFSAdapter | null = $state(null);
	$effect(() => {
		if (opfsAdapter) {
			onSetOpfsAdapter(opfsAdapter);
		}
	});
	let permissions = $state(false);
	let dirPicker = $state(false);

	async function pickFolder() {
		const folderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
		await saveFolder(folderHandle);
		opfsAdapter = new OPFSAdapter(folderHandle);
	}

	async function useOpfs() {
		opfsAdapter = await OPFSAdapter.create();
	}

	onMount(async () => {
		dirPicker = 'showDirectoryPicker' in window;
		if (dirPicker) {
			const dirHandle = await loadFolder();
			if (dirHandle) {
				permissions = await verifyPermission(dirHandle);
				if (permissions) {
					opfsAdapter = new OPFSAdapter(dirHandle);
				}
			}
		}
	});

	async function verifyPermission(handle: FileSystemDirectoryHandle) {
		const opts = { mode: 'readwrite' };
		if ((await handle.queryPermission(opts)) === 'granted') {
			return true;
		}
		return false;
	}

	async function saveFolder(handle: FileSystemDirectoryHandle) {
		await set('saved-folder', handle);
	}

	async function loadFolder() {
		const folder = await get('saved-folder');
		if (folder) {
			return folder as FileSystemDirectoryHandle;
		} else {
			return null;
		}
	}
</script>

<AlertDialog.Root>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
			<AlertDialog.Description>
				Picking a local folder means once you delete Browser data you will lose your work.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={(e) => useOpfs()}>Use Browser storage</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>

	{#if dirPicker && !opfsAdapter}
		<div class="flex flex-col items-center gap-4 justify-center w-full">
			<p>Get started by picking a folder to store your projects</p>
			<div class="flex flex-row gap-2">
				<AlertDialog.Trigger><Button variant="outline">Use Browser</Button></AlertDialog.Trigger>
				<Button onclick={(e) => pickFolder()}>Pick folder</Button>
			</div>
		</div>
	{:else if dirPicker}
		<div class="flex flex-col items-center gap-2">
			<p>Your browser does not support picking a local folder</p>
			<p>Use Chrome if you want to use a local folder</p>
			<AlertDialog.Trigger><Button variant="outline">Use Browser</Button></AlertDialog.Trigger>
		</div>
	{/if}
</AlertDialog.Root>
