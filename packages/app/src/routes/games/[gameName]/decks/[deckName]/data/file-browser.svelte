<script lang="ts">
	import AdapterFileBrowser from '$lib/components/file-browser/browser-ui/adapter-file-browser.svelte';
	import { OPFSAdapter } from '$lib/components/file-browser/adapters/opfs/opdfs-adapter';
	import { onMount } from 'svelte';
	import { get, set } from 'idb-keyval';
	import { assert } from '$lib/utils/assert';

	const homePath = '';

	let opfsAdapter: OPFSAdapter;

	async function pickFolder() {
		const folderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
		await saveFolder(folderHandle);
		opfsAdapter = new OPFSAdapter(folderHandle);
	}

	let dirPicker = false;

	onMount(async () => {
		dirPicker = 'showDirectoryPicker' in window;
		if (!dirPicker) {
			opfsAdapter = await OPFSAdapter.create();
		} else {
			const dirHandle = await initDirectory();
			if (dirHandle) {
				opfsAdapter = new OPFSAdapter(dirHandle);
			}
		}
	});

	async function verifyPermission(handle: FileSystemDirectoryHandle, readWrite = false) {
		const opts = readWrite ? { mode: 'readwrite' as const } : {};
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

	async function initDirectory() {
		let dirHandle = await loadFolder();
		assert(dirHandle != null, 'No saved directory handle found.');
		const ok = await verifyPermission(dirHandle, true);
		if (!ok) {
			throw new Error('Access to the directory was denied.');
		}
		return dirHandle;
	}
</script>

{#if dirPicker && !opfsAdapter}
	<button onclick={(e) => pickFolder()}>Pick folder</button>
{/if}

{#if opfsAdapter}
	<AdapterFileBrowser adapter={opfsAdapter} pathPrefix={homePath + '/'} />
{/if}
