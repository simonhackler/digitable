<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { getFileSystemContext } from './context.js';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Plus, FolderOpen } from '@lucide/svelte';
	import { isFolder } from '$lib/components/file-browser/browser-utils/types.svelte';
	import { resolve } from '$app/paths';

	const fileSystem = getFileSystemContext();

	let games = $state<Array<{ name: string; description?: string; tags?: string[] }>>([]);
	let loading = $state(true);

	async function loadGames() {
		try {
			loading = true;
			const root = await fileSystem.getRootFolder();
			const res = root.result;

			if (res) {
				const gamePromises = res.children
					.filter((child) => isFolder(child))
					.map(async (folder) => {
						try {
							// Try to download game.json from the folder
							const gameJsonPath = `${folder.name}/game.json`;
							const [gameFileResult] = await fileSystem.download([gameJsonPath]);

							if (gameFileResult.result?.data) {
								const gameFileText = await gameFileResult.result.data.text();
								const gameData = JSON.parse(gameFileText);
								return {
									name: folder.name,
									description: gameData.description,
									tags: gameData.tags || []
								};
							}
						} catch (error) {
							console.log(`No game.json found for ${folder.name}:`, error);
						}

						// If no game.json, still show the folder as a game
						return {
							name: folder.name
						};
					});

				const gameResults = await Promise.all(gamePromises);
				games = gameResults.filter((game) => game !== null);
			}
		} catch (error) {
			console.error('Failed to load games:', error);
		} finally {
			loading = false;
		}
	}

	async function navigateToGame(gameName: string) {
		await goto(resolve(`/games/${gameName}`));
	}

	function createNewGame() {
		// TODO: Implement create game functionality
		console.log('Create new game clicked');
	}

	onMount(() => {
		loadGames();
	});
</script>

<div class="container mx-auto max-w-4xl p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">Board Games</h1>
		<Button onclick={createNewGame} class="flex items-center gap-2">
			<Plus class="h-4 w-4" />
			Create Game
		</Button>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-muted-foreground">Loading games...</div>
		</div>
	{:else if games.length === 0}
		<Card.Root class="py-12">
			<Card.Content class="text-center">
				<FolderOpen class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
				<h3 class="mb-2 text-lg font-medium">No games found</h3>
				<p class="text-muted-foreground mb-4">Get started by creating your first board game.</p>
				<Button onclick={createNewGame} class="flex items-center gap-2">
					<Plus class="h-4 w-4" />
					Create Game
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each games as game (game.name)}
				<Card.Root
					class="hover:bg-muted/50 cursor-pointer transition-colors"
					onclick={() => navigateToGame(game.name)}
				>
					<Card.Header>
						<Card.Title class="text-lg">{game.name}</Card.Title>
						{#if game.description}
							<Card.Description class="line-clamp-2">
								{game.description}
							</Card.Description>
						{/if}
					</Card.Header>
					{#if game.tags && game.tags.length > 0}
						<Card.Content class="pt-0">
							<div class="flex flex-wrap gap-1">
								{#each game.tags.slice(0, 3) as tag (tag)}
									<Badge variant="secondary" class="text-xs">
										{tag}
									</Badge>
								{/each}
								{#if game.tags.length > 3}
									<Badge variant="outline" class="text-xs">
										+{game.tags.length - 3} more
									</Badge>
								{/if}
							</div>
						</Card.Content>
					{/if}
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
