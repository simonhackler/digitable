<script lang="ts">
	import { OPFSAdapter } from '$lib/components/file-browser/adapters/opfs/opdfs-adapter';
	import {
		loadFolderHandle,
		loadStoragePreference,
		saveFolderHandle,
		saveOpfsPreference
	} from '$lib/components/file-browser/adapters/opfs/storage-preference';
	import { onMount } from 'svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button';

	let { onSetOpfsAdapter }: { onSetOpfsAdapter: (opfsAdapter: OPFSAdapter) => void } = $props();

	let opfsAdapter: OPFSAdapter | null = $state(null);
	let dirPicker: boolean | null = $state(null);

	function applyAdapter(adapter: OPFSAdapter) {
		opfsAdapter = adapter;
		onSetOpfsAdapter(adapter);
	}

	async function pickFolder() {
		const folderHandle = await window.showDirectoryPicker({ mode: 'readwrite' as const });
		await saveFolderHandle(folderHandle);
		applyAdapter(new OPFSAdapter(folderHandle));
	}

	async function useOpfs() {
		await saveOpfsPreference();
		applyAdapter(await OPFSAdapter.create());
	}

	onMount(async () => {
		dirPicker = 'showDirectoryPicker' in window;
		if (!dirPicker) {
			applyAdapter(await OPFSAdapter.create());
			return;
		}

		const storagePreference = await loadStoragePreference();
		if (storagePreference === 'opfs') {
			applyAdapter(await OPFSAdapter.create());
			return;
		}

		const dirHandle = await loadFolderHandle();
		if (dirHandle) {
			if (await verifyPermission(dirHandle)) {
				applyAdapter(new OPFSAdapter(dirHandle));
			}
		}
	});

	async function verifyPermission(handle: FileSystemDirectoryHandle) {
		const opts = { mode: 'readwrite' as const };
		if ((await handle.queryPermission(opts)) === 'granted') {
			return true;
		}
		return false;
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
			<AlertDialog.Action onclick={() => useOpfs()}>Use Browser storage</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>

	{#if dirPicker === true && !opfsAdapter}
		<div class="flex w-full flex-col items-center justify-center gap-4">
			<p>Get started by picking a folder to store your projects</p>
			<div class="flex flex-row gap-2">
				<AlertDialog.Trigger><Button variant="outline">Use Browser</Button></AlertDialog.Trigger>
				<Button onclick={() => pickFolder()}>Pick folder</Button>
			</div>
		</div>
	{:else if dirPicker === false && !opfsAdapter}
		<div class="flex flex-col items-center gap-2">
			<p>Your browser does not support picking a local folder</p>
			<p>Use Chrome if you want to use a local folder</p>
			<AlertDialog.Trigger><Button variant="outline">Use Browser</Button></AlertDialog.Trigger>
		</div>
	{/if}
</AlertDialog.Root>
