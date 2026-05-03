<script lang="ts">
	import { onMount } from 'svelte';
	import { FileLeaf, Folder } from '$lib/components/file-browser/browser-utils/types.svelte';
	import FileBrowser from '$lib/components/file-browser/browser-ui/file-browser.svelte';
	import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';

	let {
		adapter,
		pathPrefix = '',
		class: className = ''
	}: {
		adapter: FsDir;
		pathPrefix?: string;
		class?: string;
	} = $props();

	let tree = $state<Folder>(new Folder('home', null, []));
	let currentFolder = $derived(tree);

	async function loadFolderTree(
		fsDir: FsDir,
		name: string,
		parent: Folder | null
	): Promise<Folder | null> {
		const folder = new Folder(name, parent, []);
		const entries = await fsDir.list();
		if (entries.error) {
			console.error(entries.error);
			return null;
		}

		for (const entry of entries.data) {
			if (entry.kind === 'directory') {
				const dir = await fsDir.openDir(entry.name);
				if (dir.error) {
					console.error(dir.error);
					continue;
				}
				const child = await loadFolderTree(dir.data, entry.name, folder);
				if (child) folder.children.push(child);
				continue;
			}

			const file = await fsDir.read(entry.name);
			if (file.error) {
				console.error(file.error);
				continue;
			}

			folder.children.push(
				new FileLeaf(entry.name, folder, {
					size: file.data.size,
					mimetype: file.data.type || 'application/octet-stream',
					updatedAt: new Date(file.data.lastModified),
					blob: file.data
				})
			);
		}

		return folder;
	}

	onMount(async () => {
		const rootDir = pathPrefix ? await adapter.openDir(joinFsPath(pathPrefix)) : null;
		if (rootDir?.error) {
			console.error(rootDir.error);
			return;
		}
		tree = (await loadFolderTree(rootDir?.data ?? adapter, 'home', null)) ?? tree;
	});
</script>

<FileBrowser bind:currentFolder homeFolderPath={pathPrefix} fsDir={adapter} class={className} />
