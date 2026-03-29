<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import { Plus } from '@lucide/svelte';
	import type { Game } from './types.js';
	import CreateGamePopover from './create-game-popover.svelte';

	let {
		games,
		activeProject,
		onProjectChange
	}: {
		games: Game[];
		activeProject: Game | null;
		onProjectChange: (project: Game) => void;
	} = $props();

	const sidebar = useSidebar();
</script>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		{#if activeProject != null}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Sidebar.MenuButton
							{...props}
							size="lg"
							class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<div
								class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
							>
								<!-- <activeProject.logo class="size-4" /> -->
							</div>
							<div class="grid flex-1 text-left text-sm leading-tight">
								<span class="truncate font-medium">
									{activeProject.name}
								</span>
								<!-- <span class="truncate text-xs">{activeProject.plan}</span> -->
							</div>
							<ChevronsUpDownIcon class="ml-auto" />
						</Sidebar.MenuButton>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content
					class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
					align="start"
					side={sidebar.isMobile ? 'bottom' : 'right'}
					sideOffset={4}
				>
					<DropdownMenu.Label class="text-muted-foreground text-xs">Games</DropdownMenu.Label>
					{#each games as game, index (game.name)}
						<DropdownMenu.Item onSelect={() => onProjectChange(game)} class="gap-2 p-2">
							<div class="flex size-6 items-center justify-center rounded-md border">
								<!-- <game.logo class="size-3.5 shrink-0" /> -->
							</div>
							{game.name}
							<DropdownMenu.Shortcut>⌘{index + 1}</DropdownMenu.Shortcut>
						</DropdownMenu.Item>
					{/each}
					<DropdownMenu.Separator />
					<DropdownMenu.Item class="gap-2 p-2">
						<div class="flex size-6 items-center justify-center rounded-md border bg-transparent">
							<Plus class="size-4" />
						</div>
						<div class="text-muted-foreground font-medium">New Game</div>
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}
		<CreateGamePopover>
			{#snippet trigger(props)}
				<Button {...props} class="flex w-full items-center gap-2">
					<Plus class="h-4 w-4" />
					Create Game
				</Button>
			{/snippet}
		</CreateGamePopover>
	</Sidebar.MenuItem>
</Sidebar.Menu>
