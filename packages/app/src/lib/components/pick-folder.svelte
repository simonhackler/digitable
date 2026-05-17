<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { OPFSAdapter } from '$lib/components/file-browser/adapters/opfs/opdfs-adapter';
	import {
		loadFolderHandle,
		loadStoragePreference,
		saveOpfsPreference
	} from '$lib/components/file-browser/adapters/opfs/storage-preference';
	import {
		isMissingProjectsRootMarkerError,
		pickProjectsRoot,
		prepareSavedProjectsRoot,
		PROJECTS_ROOT_MARKER,
		projectsRootMarkerJson,
		type ProjectsRootError
	} from '$lib/workspace/projects-root';
	import { onMount } from 'svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button';
	import { Check, Copy } from '@lucide/svelte';

	let { onSetOpfsAdapter }: { onSetOpfsAdapter: (opfsAdapter: OPFSAdapter) => Promise<void> } =
		$props();

	let opfsAdapter: OPFSAdapter | null = $state(null);
	let dirPicker: boolean | null = $state(null);
	let projectsRootError: ProjectsRootError | null = $state(null);
	let missingMarkerJson = $state('');
	let markerJsonCopied = $state(false);
	const appVersion = env.PUBLIC_APP_VERSION || 'dev';

	async function applyAdapter(adapter: OPFSAdapter) {
		opfsAdapter = adapter;
		await onSetOpfsAdapter(adapter);
	}

	async function pickFolder() {
		clearProjectsRootError();
		const root = await pickProjectsRoot({ appVersion });
		if (root.error) {
			setProjectsRootError(root.error);
			return;
		}

		await applyAdapter(root.data);
	}

	async function useOpfs() {
		await saveOpfsPreference();
		await applyAdapter(await OPFSAdapter.create());
	}

	onMount(async () => {
		dirPicker = 'showDirectoryPicker' in window;
		if (!dirPicker) {
			await applyAdapter(await OPFSAdapter.create());
			return;
		}

		const storagePreference = await loadStoragePreference();
		if (storagePreference === 'opfs') {
			await applyAdapter(await OPFSAdapter.create());
			return;
		}

		const dirHandle = await loadFolderHandle();
		if (dirHandle) {
			if (await verifyPermission(dirHandle)) {
				const adapter = new OPFSAdapter(dirHandle);
				const root = await prepareSavedProjectsRoot(adapter, { appVersion });
				if (root.error) {
					setProjectsRootError(root.error);
					return;
				}

				await applyAdapter(adapter);
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

	function clearProjectsRootError() {
		projectsRootError = null;
		missingMarkerJson = '';
		markerJsonCopied = false;
	}

	function setProjectsRootError(error: ProjectsRootError) {
		projectsRootError = error;
		markerJsonCopied = false;
		missingMarkerJson = isMissingProjectsRootMarkerError(error)
			? projectsRootMarkerJson({ appVersion })
			: '';
	}

	async function copyMissingMarkerJson() {
		await navigator.clipboard.writeText(missingMarkerJson);
		markerJsonCopied = true;
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
			{#if projectsRootError}
				<div role="alert" class="flex max-w-md flex-col gap-3 text-center text-sm text-red-600">
					<p>{projectsRootError.message}</p>
					{#if missingMarkerJson}
						<div class="rounded-md border border-red-200 bg-red-50 p-3 text-left text-red-700">
							<p class="text-sm">
								Create <code>{PROJECTS_ROOT_MARKER}</code> in that folder with this JSON:
							</p>
							<pre
								class="mt-2 max-h-48 overflow-auto rounded-sm bg-white p-3 text-xs text-gray-800"><code
									>{missingMarkerJson}</code
								></pre>
							<Button
								type="button"
								variant="outline"
								size="sm"
								class="mt-3"
								onclick={copyMissingMarkerJson}
							>
								{#if markerJsonCopied}
									<Check />
									Copied
								{:else}
									<Copy />
									Copy JSON
								{/if}
							</Button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{:else if dirPicker === false && !opfsAdapter}
		<div class="flex flex-col items-center gap-2">
			<p>Your browser does not support picking a local folder</p>
			<p>Use Chrome if you want to use a local folder</p>
			<AlertDialog.Trigger><Button variant="outline">Use Browser</Button></AlertDialog.Trigger>
			{#if projectsRootError}
				<p role="alert" class="max-w-md text-center text-sm text-red-600">
					{projectsRootError.message}
				</p>
			{/if}
		</div>
	{/if}
</AlertDialog.Root>
