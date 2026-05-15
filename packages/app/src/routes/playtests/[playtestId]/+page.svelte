<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { FsDir } from '$lib/components/file-browser/adapters/adapter';
	import { OPFSAdapter } from '$lib/components/file-browser/adapters/opfs/opdfs-adapter';
	import { saveOpfsPreference } from '$lib/components/file-browser/adapters/opfs/storage-preference';
	import PlaySurface from '$lib/play/PlaySurface.svelte';
	import { importPlaytestProject, playtestImportFolderName } from '$lib/playtests/project-transfer';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let status = $state('Importing playtest...');
	let failure = $state<string | null>(null);
	let importedPlaytest = $state<{
		projectName: string;
		privateRoomId: string;
		fileSystem: FsDir;
	} | null>(null);
	const e2e = $derived(page.url.searchParams.has('e2e'));

	async function getGameTicket(privateRoomId: string) {
		const response = await fetch(resolve('/api/game-ticket'), {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({ privateRoomId })
		});

		if (!response.ok) {
			throw new Error(await response.text());
		}

		const { ticket } = (await response.json()) as { ticket: string };
		return ticket;
	}

	function privatePlaytestConnection(privateRoomId: string) {
		return {
			kind: 'privatePlaytest' as const,
			privateRoomId,
			getAuthToken: () => getGameTicket(privateRoomId)
		};
	}

	onMount(async () => {
		try {
			const fsDir = await OPFSAdapter.create();
			const folderName = playtestImportFolderName(data.projectName, data.playtestId);
			status = 'Saving playtest locally...';
			await importPlaytestProject(fsDir, folderName, data.files);
			await saveOpfsPreference();

			importedPlaytest = {
				projectName: folderName,
				privateRoomId: data.privateRoomId,
				fileSystem: fsDir
			};
		} catch (error) {
			failure = error instanceof Error ? error.message : 'Could not import playtest';
		}
	});
</script>

{#if importedPlaytest}
	<PlaySurface
		projectName={importedPlaytest.projectName}
		fileSystem={importedPlaytest.fileSystem}
		roomConnection={privatePlaytestConnection(importedPlaytest.privateRoomId)}
		{e2e}
	/>
{:else}
	<main class="flex min-h-screen w-full items-center justify-center p-6">
		<div class="bg-background flex w-full max-w-md flex-col gap-3 rounded-lg border p-6 shadow-sm">
			<h1 class="text-lg font-semibold">Playtest</h1>
			{#if failure}
				<p class="text-destructive text-sm">{failure}</p>
				<a class="text-primary text-sm underline" href={resolve('/games')}>Back to games</a>
			{:else}
				<p class="text-muted-foreground text-sm">{status}</p>
			{/if}
		</div>
	</main>
{/if}
