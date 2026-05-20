<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from './app-sidebar.svelte';
	import PickFolder from '../../lib/components/pick-folder.svelte';
	import type { FsDir } from '$lib/components/file-browser/adapters/adapter';
	import type { Game } from './types';
	import { setFileSystemContext, setGamesContext } from './context';
	import { generateAgentFiles } from '$lib/utils/agent-generator.js';
	import { isPlaytestImportFolderName } from '$lib/playtests/project-transfer';
	import { Button } from '$lib/components/ui/button';
	import {
		listProjectComponents,
		migrateProjectLayout,
		projectMigrationState,
		PROJECT_VERSION
	} from '$lib/workspace/project-layout';

	let fileSystemState: { adapter: FsDir | null } = $state({ adapter: null });
	const fileSystem = $derived(fileSystemState.adapter);
	setFileSystemContext(fileSystemState);
	const gamesState: { existingGames: Game[] | null } = $state({ existingGames: null });
	const games = $derived(gamesState.existingGames);
	setGamesContext(gamesState);
	let projectsToMigrate = $state<string[] | null>(null);
	let migrationError = $state('');
	let isMigrating = $state(false);
	let isInspectingProjects = $state(false);

	async function getGames(fileSystem: Readonly<FsDir>) {
		const root = await fileSystem.list();
		if (root.error) return [];

		const games: Game[] = [];
		for (const entry of root.data) {
			if (entry.kind !== 'directory') continue;
			if (isPlaytestImportFolderName(entry.name)) continue;

			const projectPath = entry.name;
			const projectDir = await fileSystem.openDir(projectPath);
			if (projectDir.error) continue;

			const projectEntries = await projectDir.data.list();
			if (projectEntries.error) continue;
			if (!projectEntries.data.some((file) => file.name === 'game.json')) continue;

			const gameFile = await projectDir.data.readText('game.json');
			let description = '';
			let tags = [];
			if (!gameFile.error) {
				const gameData = JSON.parse(gameFile.data);
				description = gameData.description;
				tags = gameData.tags || [];
			}

			const componentEntries = await listProjectComponents(projectDir.data);
			const decks = componentEntries.error
				? []
				: componentEntries.data
						.filter((deck) => deck.kind === 'directory')
						.map((deck) => ({ name: deck.name }));

			games.push({
				name: entry.name,
				decks,
				description,
				tags
			});
		}
		return games;
	}

	async function getProjectsToMigrate(fileSystem: FsDir) {
		const root = await fileSystem.list();
		if (root.error) return [];

		const projects: string[] = [];
		for (const entry of root.data) {
			if (entry.kind !== 'directory') continue;
			if (isPlaytestImportFolderName(entry.name)) continue;

			const projectDir = await fileSystem.openDir(entry.name);
			if (projectDir.error) continue;

			const projectEntries = await projectDir.data.list();
			if (projectEntries.error) continue;
			if (!projectEntries.data.some((file) => file.name === 'game.json')) continue;

			const migration = await projectMigrationState(fileSystem, entry.name);
			if (migration.needsMigration) projects.push(entry.name);
		}

		return projects;
	}

	async function onSetOpfsAdapter(adapter: FsDir) {
		isInspectingProjects = true;
		fileSystemState.adapter = adapter;
		await generateAgentFiles(adapter);
		const migrations = await getProjectsToMigrate(adapter);
		projectsToMigrate = migrations;
		gamesState.existingGames = migrations.length ? null : await getGames(adapter);
		isInspectingProjects = false;
	}

	async function migrateProjects() {
		if (!fileSystem || !projectsToMigrate?.length || isMigrating) return;

		isMigrating = true;
		migrationError = '';
		for (const projectName of projectsToMigrate) {
			const migrated = await migrateProjectLayout(fileSystem, projectName);
			if (migrated.error) {
				migrationError = `${projectName}: ${migrated.error.message}`;
				isMigrating = false;
				return;
			}
		}

		projectsToMigrate = [];
		gamesState.existingGames = await getGames(fileSystem);
		isMigrating = false;
	}

	let { children } = $props();
</script>

<Sidebar.Provider>
	{#if fileSystem && games}
		<AppSidebar {games} {fileSystem} {onSetOpfsAdapter} />
	{/if}
	<Sidebar.Trigger class="z-50" />
	<main class="relative min-w-0 flex-1">
		{#if !fileSystem}
			<div class="mt-12 flex w-full flex-col items-center justify-center gap-4 text-xl">
				<PickFolder {onSetOpfsAdapter}></PickFolder>
			</div>
		{:else if isInspectingProjects || projectsToMigrate === null}
			<p class="text-muted-foreground p-6 text-sm">Loading projects...</p>
		{:else if projectsToMigrate.length}
			<div class="flex min-h-screen items-center justify-center p-6">
				<div class="border-border bg-background max-w-lg space-y-4 rounded-lg border p-6 shadow-sm">
					<div class="space-y-2">
						<h1 class="text-xl font-semibold">Migrate Projects</h1>
						<p class="text-muted-foreground text-sm">
							Digitable will migrate {projectsToMigrate.length}
							{projectsToMigrate.length === 1 ? 'project' : 'projects'} to components and assets, then
							save version {PROJECT_VERSION} in game.json.
						</p>
					</div>
					<div class="text-muted-foreground max-h-32 overflow-auto rounded-md border p-2 text-sm">
						{projectsToMigrate.join(', ')}
					</div>
					{#if migrationError}
						<p class="text-destructive text-sm" role="alert">{migrationError}</p>
					{/if}
					<div class="flex justify-end">
						<Button onclick={migrateProjects} disabled={isMigrating}>
							{isMigrating ? 'Migrating...' : 'Migrate projects'}
						</Button>
					</div>
				</div>
			</div>
		{:else}
			<svelte:boundary>
				{#snippet pending()}
					<p>loading...</p>
				{/snippet}
				{@render children?.()}
			</svelte:boundary>
		{/if}
	</main>
</Sidebar.Provider>
