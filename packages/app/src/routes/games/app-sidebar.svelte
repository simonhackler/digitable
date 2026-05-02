<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { saveFolderHandle } from '$lib/components/file-browser/adapters/opfs/storage-preference';
	import CreateMenu from './create-menu.svelte';
	import ExportMenu from './export-menu.svelte';
	import ProjectSwitcher from './project-switcher.svelte';
	import type { Game } from './types.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PlayMenu from './play-menu.svelte';
	import type { FsDir } from '$lib/components/file-browser/adapters/adapter';
	import Button from '$lib/components/ui/button/button.svelte';
	import { OPFSAdapter } from '$lib/components/file-browser/adapters/opfs/opdfs-adapter';
	import { UserRound } from '@lucide/svelte';

	let {
		games,
		fileSystem,
		onSetOpfsAdapter
	}: { games: Game[]; fileSystem: FsDir; onSetOpfsAdapter: (opfsAdapter: OPFSAdapter) => void } =
		$props();

	let activeProject = $derived.by(() => {
		const game = games.find((game) => game.name === page.params.gameName);
		if (game) return game;
		return games.length > 0 ? games[0] : null;
	});
	let user = $derived(page.data.user);

	async function pickFolder() {
		const folderHandle = await window.showDirectoryPicker({ mode: 'readwrite' as const });
		await saveFolderHandle(folderHandle);
		const opfsAdapter = new OPFSAdapter(folderHandle);
		onSetOpfsAdapter(opfsAdapter);
	}

	function onProjectChange(project: Game) {
		activeProject = project;
		goto(resolve(`/games/${project.name}`));
	}
</script>

<Sidebar.Root>
	<Sidebar.Header>
		<ProjectSwitcher {games} {activeProject} {onProjectChange} />
	</Sidebar.Header>
	<Sidebar.Content>
		<CreateMenu activeGame={activeProject} {fileSystem} />
		<ExportMenu activeGame={activeProject} />
		<PlayMenu activeGame={activeProject} />
		<Sidebar.Group />
	</Sidebar.Content>
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
	</Sidebar.Footer>
</Sidebar.Root>
