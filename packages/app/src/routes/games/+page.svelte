<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { getFileSystemContext, getGamesContext } from './context.js';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Plus, FolderOpen } from '@lucide/svelte';
	import { isFolder } from '$lib/components/file-browser/browser-utils/types.svelte';
	import { resolve } from '$app/paths';
	import CreateGamePopover from './create-game-popover.svelte';

	const games = getGamesContext();
	let loading = $state(true);

	async function navigateToGame(gameName: string) {
		await goto(resolve(`/games/${gameName}`));
	}
</script>

<div class="container mx-auto max-w-4xl p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">Board Games</h1>
		<CreateGamePopover>
			{#snippet trigger(props)}
				<Button {...props} class="flex items-center gap-2">
					<Plus class="h-4 w-4" />
					Create Game
				</Button>
			{/snippet}
		</CreateGamePopover>
	</div>

	{#if games.existingGames === null}
		<div class="flex items-center justify-center py-12">
			<div class="text-muted-foreground">Loading games...</div>
		</div>
	{:else if games.existingGames.length === 0}
		<Card.Root class="py-12">
			<Card.Content class="text-center">
				<FolderOpen class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
				<h3 class="mb-2 text-lg font-medium">No games found</h3>
				<p class="text-muted-foreground mb-4">Get started by creating your first board game.</p>
				<CreateGamePopover>
					{#snippet trigger(props)}
						<Button {...props} class="flex items-center gap-2">
							<Plus class="h-4 w-4" />
							Create Game
						</Button>
					{/snippet}
				</CreateGamePopover>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each games.existingGames as game (game.name)}
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
