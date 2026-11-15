<script lang="ts">
	import { env } from '$env/dynamic/public';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from './app-sidebar.svelte';
	import PickFolder from '../../lib/components/pick-folder.svelte';
	import type { FsDir } from '$lib/components/file-browser/adapters/adapter';
	import type { Game } from './types';
	import {
		setActiveProjectState,
		setFileSystemContext,
		setGamesContext,
		type ActiveProjectState
	} from './context';
	import { generateAgentFiles } from '$lib/utils/agent-generator.js';
	import { DevProjectsAdapter } from '$lib/dev-projects/adapter';
	import { isPlaytestImportFolderName } from '$lib/playtests/project-transfer';
	import { Button } from '$lib/components/ui/button';
	import { migrateProjectLayout } from '$lib/workspace/project-layout';
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import {
		createPresenceSurfaceRegistry,
		createProjectNetwork,
		createDocumentState,
		createProjectPresenceState,
		gameMetadataMaterializer,
		openProjectSession,
		projectPresencePage,
		setPresenceSurfaceRegistry,
		type ProjectSession
	} from '$lib/collaboration';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { Ok, trySync } from 'wellcrafted/result';
	import CollaborativeCursorLayer from '$lib/collaboration/collaborative-cursor-layer.svelte';

	let fileSystemState: { adapter: FsDir | null } = $state({ adapter: null });
	const fileSystem = $derived(fileSystemState.adapter);
	let viewFileSystemState: { adapter: FsDir | null } = $state({ adapter: null });
	setFileSystemContext(viewFileSystemState);
	const gamesState: { existingGames: Game[] | null } = $state({ existingGames: null });
	const games = $derived(gamesState.existingGames);
	setGamesContext(gamesState);
	const activeProjectState: ActiveProjectState = $state({
		phase: 'idle',
		current: null,
		reconciliation: { state: 'idle' },
		background: { state: 'idle' },
		error: null
	});
	setActiveProjectState(activeProjectState);
	let discoveryError = $state('');
	const appVersion = env.PUBLIC_APP_VERSION || 'dev';
	const activeGameName = $derived(page.params.gameName);
	const activeCheckpointId = $derived(page.url.searchParams.get('checkpoint') ?? undefined);
	const activeViewKey = $derived(`${activeGameName ?? ''}:${activeCheckpointId ?? 'latest'}`);
	const presencePage = $derived(projectPresencePage(page.route.id, page.params));
	const surfaces = createPresenceSurfaceRegistry();
	const presenceSurface = surfaces.surface({ id: 'project-page' });
	setPresenceSurfaceRegistry(surfaces);
	let projectGeneration = 0;
	let workspaceGeneration = 0;
	let closing = Promise.resolve<Awaited<ReturnType<ProjectSession['close']>>>(Ok(undefined));
	let opening: Promise<void> = Promise.resolve();
	let openingTarget: { adapter: FsDir | null; view: string } | undefined;

	function configurePresence(session: ProjectSession): void {
		session.presence.setParticipant({ displayName: page.data.user?.name || 'Collaborator' });
		session.presence.setPage(presencePage.id);
	}

	async function closeActiveProject() {
		projectGeneration += 1;
		const active = activeProjectState.current;
		activeProjectState.current = null;
		activeProjectState.phase = 'idle';
		activeProjectState.error = null;
		activeProjectState.reconciliation = { state: 'idle' };
		activeProjectState.background = { state: 'idle' };
		viewFileSystemState.adapter = fileSystem;
		if (!active) return;
		active.metadata.destroy();
		active.presence.destroy();
		closing = active.session.close();
		await closing;
	}

	async function openActiveProject(
		fileSystem: FsDir | null,
		gameName: string | undefined,
		force = false
	) {
		if (
			!force &&
			activeProjectState.phase === 'opening' &&
			openingTarget?.adapter === fileSystem &&
			openingTarget.view === activeViewKey
		)
			return;
		const active = activeProjectState.current;
		if (
			!force &&
			active &&
			activeProjectState.phase === 'ready' &&
			active.key === gameName &&
			active.viewKey === activeViewKey &&
			fileSystem
		) {
			configurePresence(active.session);
			return;
		}
		const generation = ++projectGeneration;
		openingTarget = { adapter: fileSystem, view: activeViewKey };
		const previous = activeProjectState.current;
		activeProjectState.current = null;
		activeProjectState.error = null;
		activeProjectState.reconciliation = { state: 'idle' };
		activeProjectState.phase = fileSystem && gameName ? 'opening' : 'idle';
		activeProjectState.background = { state: 'idle' };

		if (previous) {
			previous.metadata.destroy();
			previous.presence.destroy();
			closing = previous.session.close();
		}
		await opening;
		const closed = await closing;
		if (generation !== projectGeneration || !fileSystem || !gameName) return;
		if (closed.error) {
			closing = Promise.resolve(Ok(undefined));
			activeProjectState.phase = 'error';
			activeProjectState.error = closed.error.message;
			return;
		}
		const migrated = await migrateProjectLayout(fileSystem, gameName, appVersion);
		if (generation !== projectGeneration) return;
		if (migrated.error) {
			activeProjectState.phase = 'error';
			activeProjectState.error = migrated.error.message;
			return;
		}

		const projectDir = await fileSystem.openDir(gameName);
		if (generation !== projectGeneration) return;
		if (projectDir.error) {
			activeProjectState.phase = 'error';
			activeProjectState.error = projectDir.error.message;
			return;
		}

		let openingError: string | null = null;
		const pending = openProjectSession(projectDir.data, {
			network: createProjectNetwork(window.location.href, Boolean(page.data.user)),
			saveDebounceMs: 0,
			checkpointId: activeCheckpointId,
			onBackground: (status) => {
				if (generation === projectGeneration) activeProjectState.background = status;
			},
			onBranchCheckout: () => {
				if (generation !== projectGeneration) return;
				const target = new URL(page.url);
				target.searchParams.delete('checkpoint');
				target.searchParams.delete('baseline');
				void (async () => {
					// eslint-disable-next-line svelte/no-navigation-without-resolve -- target is a URL based on the current page.
					if (target.href !== page.url.href) await goto(target, { replaceState: true });
					await openActiveProject(fileSystem, gameName, true);
				})();
			},
			onStatus: (status) => {
				if (generation !== projectGeneration) return;
				activeProjectState.reconciliation = status;
				if (status.state === 'error' && status.scope === 'project') {
					openingError = status.message;
					activeProjectState.phase = 'error';
					activeProjectState.error = status.message;
				}
			}
		});
		const completion = pending.then(async (opened) => {
			if (generation === projectGeneration || opened.error) return;
			closing = opened.data.close();
			await closing;
		});
		opening = completion;
		const opened = await pending;
		if (generation !== projectGeneration) {
			await completion;
			return;
		}
		if (opened.error) {
			activeProjectState.phase = 'error';
			activeProjectState.error = opened.error.message;
			return;
		}
		if (openingError) {
			await opened.data.close();
			return;
		}

		const metadata = opened.data.metadataHandle.doc()!;
		gamesState.existingGames = [
			...(gamesState.existingGames ?? []).filter((game) => game.name !== gameName),
			{
				name: gameName,
				description: metadata.description,
				tags: [...metadata.tags],
				decks: opened.data.components().map(({ name }) => ({ name }))
			}
		];
		activeProjectState.current = {
			key: gameName,
			viewKey: activeViewKey,
			session: opened.data,
			presence: createProjectPresenceState(opened.data.presence),
			metadata: createDocumentState(opened.data.metadataHandle, (metadata) => {
				if (generation !== projectGeneration || !metadata || !gamesState.existingGames) return;
				gamesState.existingGames = gamesState.existingGames.map((game) =>
					game.name === gameName
						? { ...game, description: metadata.description, tags: [...metadata.tags] }
						: game
				);
			})
		};
		viewFileSystemState.adapter = fileSystem;
		configurePresence(opened.data);
		opened.data.subscribeInventory(() => {
			if (generation !== projectGeneration || !gamesState.existingGames) return;
			const decks = opened.data.components().map(({ name }) => ({ name }));
			const current = gamesState.existingGames.find((game) => game.name === gameName);
			if (
				current &&
				current.decks.length === decks.length &&
				current.decks.every((deck, index) => deck.name === decks[index].name)
			)
				return;
			gamesState.existingGames = gamesState.existingGames.map((game) =>
				game.name === gameName ? { ...game, decks } : game
			);
		});
		activeProjectState.phase = 'ready';
	}
	async function getGames(fileSystem: Readonly<FsDir>, generation: number) {
		const root = await fileSystem.list();
		if (root.error) {
			if (generation !== workspaceGeneration) return;
			discoveryError = root.error.message;
			gamesState.existingGames ??= [];
			return;
		}

		for (const entry of root.data) {
			if (generation !== workspaceGeneration) return;
			if (entry.kind !== 'directory') continue;
			if (isPlaytestImportFolderName(entry.name)) continue;

			const projectPath = entry.name;
			const projectDir = await fileSystem.openDir(projectPath);
			if (projectDir.error) continue;

			const gameFile = await projectDir.data.readText('game.json');
			if (gameFile.error) continue;
			const { data: metadata } = trySync({
				try: () => gameMetadataMaterializer.parse(gameFile.data, { hash: '' }),
				catch: () => Ok(null)
			});

			if (generation !== workspaceGeneration) return;
			if (gamesState.existingGames?.some((game) => game.name === entry.name)) continue;
			gamesState.existingGames = [
				...(gamesState.existingGames ?? []),
				{
					name: entry.name,
					decks: [],
					description: metadata?.description ?? '',
					tags: metadata?.tags ?? []
				}
			];
		}
		if (generation === workspaceGeneration) gamesState.existingGames ??= [];
	}

	async function onSetProjectsAdapter(adapter: FsDir) {
		const generation = ++workspaceGeneration;
		await closeActiveProject();
		if (generation !== workspaceGeneration) return;
		discoveryError = '';
		gamesState.existingGames = null;
		fileSystemState.adapter = adapter;
		viewFileSystemState.adapter = adapter;
		void getGames(adapter, generation);
		if (!(adapter instanceof DevProjectsAdapter)) void generateAgentFiles(adapter);
		await openActiveProject(adapter, page.params.gameName);
	}

	let { children } = $props();

	afterNavigate(() => {
		if (!fileSystem) return;
		void openActiveProject(fileSystem, page.params.gameName);
	});

	beforeNavigate(({ cancel, willUnload }) => {
		if (willUnload && activeProjectState.reconciliation.state === 'syncing') cancel();
		if (!willUnload) activeProjectState.current?.session.releasePage();
	});

	onDestroy(() => {
		workspaceGeneration += 1;
		surfaces.close();
		void closeActiveProject();
	});
</script>

<Sidebar.Provider>
	{#if fileSystem && games}
		<AppSidebar
			{games}
			{fileSystem}
			{onSetProjectsAdapter}
			projectSession={activeProjectState.current?.session ?? null}
			peers={activeProjectState.current?.presence.peers ?? []}
		/>
	{/if}
	<main class="relative min-w-0 flex-1" {@attach presenceSurface}>
		{#if discoveryError}<p role="alert" class="text-destructive p-4 text-sm">
				{discoveryError}
			</p>{/if}
		{#if activeProjectState.current?.session.readOnly}
			<div
				class="border-primary/20 bg-primary/10 text-primary absolute top-2 right-3 z-40 rounded-full border px-3 py-1 text-xs font-medium shadow-sm"
				role="status"
			>
				Viewing historical checkpoint · Read only
			</div>
		{/if}
		{#if !fileSystem}
			<div class="mt-12 flex w-full flex-col items-center justify-center gap-4 text-xl">
				<PickFolder {onSetProjectsAdapter}></PickFolder>
			</div>
		{:else if activeGameName && activeProjectState.phase === 'opening'}
			<p class="text-muted-foreground p-6 text-sm">Opening project...</p>
		{:else if activeGameName && activeProjectState.phase === 'error'}
			<div class="flex min-h-screen items-center justify-center p-6">
				<div class="border-border bg-background max-w-lg space-y-4 rounded-lg border p-6 shadow-sm">
					<p class="text-destructive text-sm" role="alert">{activeProjectState.error}</p>
					<Button onclick={() => openActiveProject(fileSystem, activeGameName)}>Retry</Button>
					<Button variant="outline" href="/games">Back to games</Button>
				</div>
			</div>
		{:else if !activeGameName || activeProjectState.current?.key === activeGameName}
			{#key activeProjectState.current?.viewKey}
				<svelte:boundary>
					{#snippet pending()}
						<p role="status" class="text-muted-foreground p-6 text-sm">Loading page...</p>
					{/snippet}
					{#snippet failed(error, reset)}
						<div class="space-y-3 p-6">
							<p role="alert">
								{error instanceof Error ? error.message : 'Could not load this page.'}
							</p>
							<Button onclick={reset}>Retry</Button>
						</div>
					{/snippet}
					{@render children?.()}
				</svelte:boundary>
			{/key}
		{/if}
		{#if activeProjectState.current && !activeProjectState.current.session.readOnly && presencePage.pointerEnabled}
			{#key activeProjectState.current.session.rootUrl}
				<CollaborativeCursorLayer
					presence={activeProjectState.current.session.presence}
					pageId={presencePage.id}
					{surfaces}
					peers={activeProjectState.current.presence.peers}
				/>
			{/key}
		{/if}
	</main>
</Sidebar.Provider>
