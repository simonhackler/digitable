<script lang="ts">
	import AdapterFileBrowser from '$lib/components/file-browser/browser-ui/adapter-file-browser.svelte';
	import { OPFSAdapter } from '$lib/components/file-browser/adapters/opfs/opdfs-adapter';
	import {
		loadFolderHandle,
		loadStoragePreference,
		saveFolderHandle
	} from '$lib/components/file-browser/adapters/opfs/storage-preference';
	import { onMount } from 'svelte';

	const homePath = '';

	let opfsAdapter: OPFSAdapter | null = $state(null);

	async function pickFolder() {
		const folderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
		await saveFolderHandle(folderHandle);
		opfsAdapter = new OPFSAdapter(folderHandle);
	}

	let dirPicker = $state(false);

	onMount(async () => {
		dirPicker = 'showDirectoryPicker' in window;
		const storagePreference = await loadStoragePreference();
		if (!dirPicker || storagePreference === 'opfs') {
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

	async function loadFolder() {
		return loadFolderHandle();
	}

	async function initDirectory() {
		const dirHandle = await loadFolder();
		if (!dirHandle) {
			return null;
		}
		const ok = await verifyPermission(dirHandle, true);
		if (!ok) {
			return null;
		}
		return dirHandle;
	}
</script>

{#if dirPicker && !opfsAdapter}
	<button onclick={() => pickFolder()}>Pick folder</button>
{/if}

{#if opfsAdapter}
	<AdapterFileBrowser adapter={opfsAdapter} pathPrefix={homePath + '/'} />
{/if}
