<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		createProjectNetwork,
		openProjectSession,
		parseProjectInvitation,
		readPendingJoin,
		readProjectConfig
	} from '$lib/collaboration';
	import { parseFsPath } from '$lib/components/file-browser/adapters/adapter';
	import { Button } from '$lib/components/ui/button';
	import Input from '$lib/components/ui/input/input.svelte';
	import { listProjectComponents } from '$lib/workspace/project-layout';
	import { onMount } from 'svelte';
	import { Ok, tryAsync } from 'wellcrafted/result';
	import GameTopBar from '../game-top-bar.svelte';
	import { getFileSystemContext, getGamesContext } from '../context';

	const fileSystem = getFileSystemContext();
	const games = getGamesContext();
	let invitationInput = $state('');
	let folderName = $state('shared-project');
	let errorMessage = $state('');
	let joining = $state(false);
	const invitation = $derived(parseProjectInvitation(invitationInput));
	const signInHref = $derived(
		browser
			? `/sign-in?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`)}`
			: '/sign-in'
	);

	onMount(() => {
		if (!window.location.hash) return;
		invitationInput = window.location.href;
		const parsed = parseProjectInvitation(invitationInput);
		if (parsed.state === 'valid') {
			folderName = `shared-${parsed.historyUrl.slice('automerge:'.length, 'automerge:'.length + 8)}`;
		}
	});

	async function localProject(historyUrl: string) {
		const root = await fileSystem.list();
		if (root.error) throw new Error(root.error.message, { cause: root.error });
		for (const entry of root.data) {
			if (entry.kind !== 'directory') continue;
			const directory = await fileSystem.openDir(entry.name);
			if (directory.error) continue;
			const result = await tryAsync({
				try: () => readProjectConfig(directory.data),
				catch: () => Ok(undefined)
			});
			if (result.data?.historyUrl === historyUrl) return entry.name;
		}
		return undefined;
	}

	async function joinProject() {
		if (joining || invitation.state !== 'valid') return;
		errorMessage = '';
		const name = folderName.trim();
		const path = parseFsPath('ensureDir', name);
		if (path.error || path.data.length !== 1 || name.startsWith('.')) {
			errorMessage = path.error?.message ?? 'Use a non-hidden folder name without slashes.';
			return;
		}

		joining = true;
		const existingProject = await localProject(invitation.historyUrl);
		if (existingProject) {
			await goto(resolve(`/games/${existingProject}`));
			return;
		}

		const entries = await fileSystem.list();
		if (entries.error) {
			errorMessage = entries.error.message;
			joining = false;
			return;
		}
		const existing = entries.data.find((entry) => entry.name === name);
		if (existing?.kind === 'file') {
			errorMessage = `A file named "${name}" already exists.`;
			joining = false;
			return;
		}

		const directory = existing ? await fileSystem.openDir(name) : await fileSystem.ensureDir(name);
		if (directory.error) {
			errorMessage = directory.error.message;
			joining = false;
			return;
		}
		if (existing) {
			const config = await readProjectConfig(directory.data);
			const pending = await readPendingJoin(directory.data);
			if (
				config?.historyUrl !== invitation.historyUrl &&
				pending?.historyUrl !== invitation.historyUrl
			) {
				errorMessage = `A project folder named "${name}" already exists.`;
				joining = false;
				return;
			}
		}

		const opened = await openProjectSession(directory.data, {
			joinHistoryUrl: invitation.historyUrl,
			network: createProjectNetwork(window.location.href, true),
			saveDebounceMs: 0
		});
		if (opened.error) {
			errorMessage = opened.error.message;
			joining = false;
			return;
		}
		const metadata = opened.data.metadataHandle.doc();
		const components = await listProjectComponents(directory.data);
		const closed = await opened.data.close();
		if (!metadata || closed.error) {
			errorMessage = closed.error?.message ?? 'The shared project metadata is unavailable.';
			joining = false;
			return;
		}

		if (games.existingGames && !games.existingGames.some((game) => game.name === name)) {
			games.existingGames = [
				...games.existingGames,
				{
					name,
					description: metadata.description,
					tags: [...metadata.tags],
					decks: components.error
						? []
						: components.data
								.filter((entry) => entry.kind === 'directory')
								.map((entry) => ({ name: entry.name }))
				}
			].sort((left, right) => left.name.localeCompare(right.name));
		}
		await goto(resolve(`/games/${name}`));
	}
</script>

<div class="flex min-h-svh flex-col">
	<GameTopBar title="Join Project" />
	<div class="mx-auto flex w-full max-w-xl flex-1 items-center p-6">
		<section class="border-border bg-background w-full space-y-6 rounded-xl border p-6 shadow-sm">
			<div class="space-y-2">
				<h1 class="text-xl font-semibold">Join Project</h1>
				<p class="text-muted-foreground text-sm">
					Open a shared Automerge project in a new folder in this workspace.
				</p>
			</div>

			{#if !page.data.user}
				<div class="space-y-3">
					<p class="text-sm">Sign in before joining a shared project.</p>
					<Button href={signInHref}>Sign in</Button>
				</div>
			{:else}
				<div class="space-y-2">
					<label for="project-invitation" class="text-sm font-medium">Project invitation</label>
					<Input
						id="project-invitation"
						bind:value={invitationInput}
						placeholder="Paste a Digitable sharing link"
						disabled={joining}
					/>
					{#if invitation.state === 'invalid'}
						<p class="text-destructive text-sm" role="alert">This project invitation is invalid.</p>
					{/if}
				</div>
				<div class="space-y-2">
					<label for="project-folder-name" class="text-sm font-medium">Project folder name</label>
					<Input id="project-folder-name" bind:value={folderName} disabled={joining} />
				</div>
				<p class="text-muted-foreground text-sm">
					Anyone signed in with this link can edit the project and its complete history.
				</p>
				{#if errorMessage}
					<p class="text-destructive text-sm" role="alert">{errorMessage}</p>
				{/if}
				<Button
					type="button"
					disabled={joining || invitation.state !== 'valid'}
					onclick={joinProject}
				>
					{joining ? 'Joining...' : 'Join project'}
				</Button>
			{/if}
		</section>
	</div>
</div>
