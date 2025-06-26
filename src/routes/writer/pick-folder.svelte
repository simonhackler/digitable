<script lang="ts">
	import { OPFSAdapter } from '$lib/components/file-browser/adapters/opfs/opdfs-adapter';
	import { onMount } from 'svelte';
	import { get, set } from 'idb-keyval';
	import { Button } from '$lib/components/ui/button';

	let { opfsAdapter = $bindable() }: { opfsAdapter: OPFSAdapter } = $props();

	let permissions = $state(false);
	let dirPicker = $state(false);

	async function pickFolder() {
		const folderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
		await saveFolder(folderHandle);
		opfsAdapter = new OPFSAdapter(folderHandle);
	}


	onMount(async () => {
		dirPicker = 'showDirectoryPicker' in window;
		if (!dirPicker) {
			opfsAdapter = await OPFSAdapter.create();
		} else {
			const dirHandle = await loadFolder();
			if (dirHandle) {
				permissions = await verifyPermission(dirHandle);
				console.log('permissions', permissions);
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

{#if dirPicker && !opfsAdapter}
	<Button onclick={(e) => pickFolder()}>Pick folder</Button>
{/if}
