<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import CreateMenu from './create-menu.svelte';
	import ExportMenu from './export-menu.svelte';
	import ProjectSwitcher from './project-switcher.svelte';
	import type { Game } from './types.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PlayMenu from './play-menu.svelte';

	let { games }: { games: Game[] } = $props();

	// We'll need to track the active project to get its decks
	let activeProject = $derived.by(() => {
		const game = games.find((game) => game.name === page.params.gameName);
		if (game) return game;
		return games.length > 0 ? games[0] : null;
	});

	function onProjectChange(project: Game) {
		activeProject = project;
		goto(`/games/${project.name}`);
	}
</script>

<Sidebar.Root>
	<Sidebar.Header>
		<ProjectSwitcher {games} {activeProject} {onProjectChange} />
	</Sidebar.Header>
	<Sidebar.Content>
		<CreateMenu activeGame={activeProject} />
		<ExportMenu activeGame={activeProject} />
		<PlayMenu activeGame={activeProject} />
		<Sidebar.Group />
	</Sidebar.Content>
	<Sidebar.Footer />
</Sidebar.Root>
