<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { OPFSAdapter } from '$lib/components/file-browser/adapters/opfs/opdfs-adapter';
	import { saveOpfsPreference } from '$lib/components/file-browser/adapters/opfs/storage-preference';
	import {
		importPlaytestProject,
		playtestImportFolderName,
		type PlaytestDownloadFile
	} from '$lib/playtests/project-transfer';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let status = $state('Importing playtest...');
	let failure = $state<string | null>(null);

	type PlaytestProjectResponse = {
		projectName: string;
		privateRoomId: string;
		files: PlaytestDownloadFile[];
	};

	onMount(async () => {
		try {
			const response = await fetch(resolve(`/api/playtests/${data.playtestId}/project`));
			if (!response.ok) {
				throw new Error(await response.text());
			}

			const project = (await response.json()) as PlaytestProjectResponse;
			const fsDir = await OPFSAdapter.create();
			const folderName = playtestImportFolderName(project.projectName, data.playtestId);
			status = 'Saving playtest locally...';
			await importPlaytestProject(fsDir, folderName, project.files);
			await saveOpfsPreference();

			const params = new URLSearchParams({ privateRoomId: project.privateRoomId });
			if (page.url.searchParams.has('e2e')) {
				params.set('e2e', '1');
			}

			status = 'Opening playtest...';
			await goto(resolve(`/games/${folderName}/play?${params.toString()}`));
		} catch (error) {
			failure = error instanceof Error ? error.message : 'Could not import playtest';
		}
	});
</script>

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
