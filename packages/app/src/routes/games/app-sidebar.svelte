<script lang="ts">
	import { resolve } from '$app/paths';
	import { env } from '$env/dynamic/public';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { pickProjectsRoot, readProjectsRootMarker } from '$lib/workspace/projects-root';
	import { saveDevProjectsPreference } from '$lib/components/file-browser/adapters/opfs/storage-preference';
	import { DevProjectsAdapter } from '$lib/dev-projects/adapter';
	import { dev } from '$app/environment';
	import CreateMenu from './create-menu.svelte';
	import ExportMenu from './export-menu.svelte';
	import ProjectSwitcher from './project-switcher.svelte';
	import type { Game } from './types.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PlaySidebarMenu from './play-sidebar-menu.svelte';
	import { FsError, type FsDir } from '$lib/components/file-browser/adapters/adapter';
	import Button from '$lib/components/ui/button/button.svelte';
	import { UserRound } from '@lucide/svelte';
	import type { ProjectSession, RemotePresenceState } from '$lib/collaboration';
	import ProjectBranches from './project-branches.svelte';
	import ShareProjectPopover from './share-project-popover.svelte';

	let {
		games,
		fileSystem,
		onSetProjectsAdapter,
		projectSession,
		peers
	}: {
		games: Game[];
		fileSystem: FsDir;
		onSetProjectsAdapter: (adapter: FsDir) => Promise<void>;
		projectSession: ProjectSession | null;
		peers: RemotePresenceState[];
	} = $props();

	let activeProject = $derived.by(() => {
		const game = games.find((game) => game.name === page.params.gameName);
		return game ?? null;
	});

	// TODO why have this bs be null?
	// TODO does this even make sense? I like always having the correct folders ready on the correct paths. Seems to simplify things
	let projectFolderResult = $derived(
		activeProject
			? await fileSystem.openDir(activeProject.name)
			: FsError.NotFound({ operation: 'openDir', path: '' })
	);

	let user = $derived(page.data.user);
	let projectsRootError = $state('');
	const appVersion = env.PUBLIC_APP_VERSION || 'dev';

	async function pickFolder() {
		projectsRootError = '';
		const root = await pickProjectsRoot({ appVersion });
		if (root.error) {
			projectsRootError = root.error.message;
			return;
		}

		await onSetProjectsAdapter(root.data);
		await goto(resolve('/games'));
	}

	async function useWorktreeProjects() {
		projectsRootError = '';
		const adapter = new DevProjectsAdapter();
		const root = await readProjectsRootMarker(adapter);
		if (root.error) {
			projectsRootError = root.error.message;
			return;
		}
		await saveDevProjectsPreference();
		await onSetProjectsAdapter(adapter);
		await goto(resolve('/games'));
	}

	function onProjectChange(project: Game) {
		activeProject = project;
		goto(resolve(`/games/${project.name}`));
	}
</script>

<Sidebar.Root>
	<Sidebar.Header>
		<ProjectSwitcher {games} {activeProject} {onProjectChange} {peers} />
		{#if projectSession}
			{#key projectSession.rootUrl}
				<ProjectBranches session={projectSession} />
				{#if user}
					<div class="px-2 pb-2">
						<ShareProjectPopover session={projectSession} />
					</div>
				{/if}
			{/key}
		{/if}
	</Sidebar.Header>
	{#if projectFolderResult.error}
		<!-- Todo display error -->
	{:else}
		<Sidebar.Content>
			{#if projectSession}
				<CreateMenu
					activeGame={activeProject}
					fileSystem={projectFolderResult.data}
					{projectSession}
					{peers}
				/>
			{/if}
			<ExportMenu activeGame={activeProject} {peers} />
			<PlaySidebarMenu activeGame={activeProject} {peers} />
			<Sidebar.Group />
		</Sidebar.Content>
	{/if}
	<Sidebar.Footer>
		<Sidebar.Menu>
			{#if user}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton tooltipContent="User settings">
						{#snippet child({ props })}
							<a {...props} href={resolve('/settings')}>
								<UserRound />
								<span>{user.name ?? user.email}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{:else}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton tooltipContent="Sign up">
						{#snippet child({ props })}
							<a {...props} href={resolve('/sign-up')}>
								<UserRound />
								<span>Sign up</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton tooltipContent="Sign in">
						{#snippet child({ props })}
							<a {...props} href={resolve('/sign-in')}>
								<UserRound />
								<span>Sign in</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{/if}
		</Sidebar.Menu>
		<Button onclick={pickFolder}>Change Projects Folder</Button>
		{#if dev && env.PUBLIC_DEV_PROJECTS === 'true' && !(fileSystem instanceof DevProjectsAdapter)}
			<Button variant="outline" onclick={useWorktreeProjects}>Use worktree projects</Button>
		{/if}
		{#if projectsRootError}
			<p role="alert" class="px-2 text-sm text-red-600">{projectsRootError}</p>
		{/if}
	</Sidebar.Footer>
</Sidebar.Root>
