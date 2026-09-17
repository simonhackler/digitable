<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Download, Gamepad2, Printer } from '@lucide/svelte';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { Game } from './types.js';
	import { peersOnProjectPages, type RemotePresenceState } from '$lib/collaboration';
	import SidebarPresenceAvatars from './sidebar-presence-avatars.svelte';

	let { activeGame, peers }: { activeGame: Game | null; peers: RemotePresenceState[] } = $props();

	function pagePeers(routeId: string): RemotePresenceState[] {
		return peersOnProjectPages(peers, routeId, { gameName: activeGame?.name });
	}
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>Actions</Sidebar.GroupLabel>
	<Sidebar.Menu>
		<Collapsible.Root class="group/collapsible">
			<Sidebar.MenuItem>
				<Collapsible.Trigger>
					{#snippet child({ props })}
						<Sidebar.MenuButton {...props} tooltipContent="Export options">
							<Download />
							<span>Export</span>
							<ChevronRightIcon
								class="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
							/>
						</Sidebar.MenuButton>
					{/snippet}
				</Collapsible.Trigger>
				<Collapsible.Content>
					<Sidebar.MenuSub>
						<Sidebar.MenuSubItem>
							<Sidebar.MenuSubButton>
								{#snippet child({ props })}
									<a href={resolve(`/games/${activeGame?.name}/export/tts`)} {...props}>
										<Gamepad2 class="mr-2 h-4 w-4" />
										<span class="flex-1">TTS</span>
										<SidebarPresenceAvatars
											peers={pagePeers('/games/[gameName]/export/tts')}
											pageLabel="TTS"
										/>
									</a>
								{/snippet}
							</Sidebar.MenuSubButton>
						</Sidebar.MenuSubItem>
						<Sidebar.MenuSubItem>
							<Sidebar.MenuSubButton>
								{#snippet child({ props })}
									<a href={resolve(`/games/${activeGame?.name}/export/paper`)} {...props}>
										<Printer class="mr-2 h-4 w-4" />
										<span class="flex-1">Paper</span>
										<SidebarPresenceAvatars
											peers={pagePeers('/games/[gameName]/export/paper')}
											pageLabel="Paper"
										/>
									</a>
								{/snippet}
							</Sidebar.MenuSubButton>
						</Sidebar.MenuSubItem>
					</Sidebar.MenuSub>
				</Collapsible.Content>
			</Sidebar.MenuItem>
		</Collapsible.Root>
	</Sidebar.Menu>
</Sidebar.Group>
