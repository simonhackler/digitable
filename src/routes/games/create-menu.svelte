<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Layers } from '@lucide/svelte';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { Game } from './types.js';

    let { activeGame }: { activeGame: Game | null} = $props();

</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>Create</Sidebar.GroupLabel>
	<Sidebar.Menu>
			<Collapsible.Root class="group/collapsible">
					<Sidebar.MenuItem>
						<Collapsible.Trigger>
							{#snippet child({ props })}
								<Sidebar.MenuButton {...props} tooltipContent='d'>
                                    <Layers />
									<span>Decks</span>
									<ChevronRightIcon
										class="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
									/>
								</Sidebar.MenuButton>
							{/snippet}
						</Collapsible.Trigger>
						<Collapsible.Content>
							<Sidebar.MenuSub>
								{#each activeGame?.decks ?? [] as deck (deck.name)}
									<Sidebar.MenuSubItem>
										<Sidebar.MenuSubButton>
											{#snippet child({ props })}
											    <a href={`${activeGame?.name}decks/${deck.name}`} {...props}>
                                                	<span class="text-muted-foreground">{deck.name}</span>
												</a>
											{/snippet}
										</Sidebar.MenuSubButton>
									</Sidebar.MenuSubItem>
								{/each}
							</Sidebar.MenuSub>
						</Collapsible.Content>
					</Sidebar.MenuItem>
			</Collapsible.Root>
	</Sidebar.Menu>
</Sidebar.Group>
