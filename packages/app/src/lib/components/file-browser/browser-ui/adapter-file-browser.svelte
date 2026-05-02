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
		path: string,
		name: string,
		parent: Folder | null
	): Promise<Folder | null> {
		const folder = new Folder(name, parent, []);
		const entries = await adapter.list(path || undefined);
		if (entries.error) {
			console.error(entries.error);
			return null;
		}

		for (const entry of entries.data) {
			const childPath = joinFsPath(path, entry.name);
			if (entry.kind === 'directory') {
				const child = await loadFolderTree(childPath, entry.name, folder);
				if (child) folder.children.push(child);
				continue;
			}

			const file = await adapter.read(childPath);
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
		tree = (await loadFolderTree(joinFsPath(pathPrefix), 'home', null)) ?? tree;
	});
</script>

<FileBrowser bind:currentFolder homeFolderPath={pathPrefix} fsDir={adapter} class={className} />
