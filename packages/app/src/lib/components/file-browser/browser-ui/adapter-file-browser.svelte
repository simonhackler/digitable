<script lang="ts">
	import { onMount } from 'svelte';
	import type { ExplorerNode } from '$lib/components/file-browser/browser-utils/types.svelte';
	import { Folder, isFolder } from '$lib/components/file-browser/browser-utils/types.svelte';
	import FileBrowser from '$lib/components/file-browser/browser-ui/file-browser.svelte';
	import type { Adapter } from '$lib/components/file-browser/adapters/adapter';

	let {
		adapter,
		pathPrefix = '',
		class: className = ''
	}: {
		adapter: Adapter;
		pathPrefix?: string;
		class?: string;
	} = $props();

	let tree = $state<Folder>(new Folder('home', null, []));
	let currentFolder = $derived(tree);

	function getPathArray(node: ExplorerNode): string[] {
		const parts = [node.name];
		let parent = node.parent;
		while (parent) {
			parts.push(parent.name);
			parent = parent.parent;
		}
		return parts.reverse();
	}

	onMount(async () => {
		const { result, error } = await adapter.getRootFolder();
		if (error) {
			console.error(error);
		} else if (result) {
			tree = result;
		}
	});

	async function downloadFile(path: string) {
		const res = await adapter.download([path]);
		const { result, error } = res[0];
		if (error) {
			console.error(error);
			return '';
		}
		if (result) {
			return URL.createObjectURL(result.data);
		}
		return '';
	}

	$effect(() => {
		for (const child of currentFolder.children) {
			if (
				!isFolder(child) &&
				child?.fileData &&
				child.fileData.mimetype.startsWith('image/') &&
				!child.fileData.url
			) {
				const fullPath = pathPrefix + getPathArray(child).slice(1).join('/');
				child.fileData.url = downloadFile(fullPath);
			}
		}
	});
</script>

<FileBrowser
	bind:currentFolder
	homeFolderPath={pathPrefix}
	fileFunctions={adapter}
	class={className}
/>
