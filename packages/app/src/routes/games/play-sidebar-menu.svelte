<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { ClipboardList, Play, SlidersHorizontal } from '@lucide/svelte';
	import type { Game } from './types.js';
	import { peersOnProjectPages, type RemotePresenceState } from '$lib/collaboration';
	import SidebarPresenceAvatars from './sidebar-presence-avatars.svelte';
	import { page } from '$app/state';
	import { projectViewHref } from './project-view-url';

	let { activeGame, peers }: { activeGame: Game | null; peers: RemotePresenceState[] } = $props();

	function pagePeers(routeId: string): RemotePresenceState[] {
		return peersOnProjectPages(peers, routeId, { gameName: activeGame?.name });
	}
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>Play</Sidebar.GroupLabel>
	<Sidebar.Menu>
		<Sidebar.MenuItem>
			<Sidebar.MenuButton tooltipContent="Setup">
				{#snippet child({ props })}
					<a
						href={projectViewHref(resolve(`/games/${activeGame?.name}/setup`), page.url)}
						{...props}
					>
						<SlidersHorizontal />
						<span>Setup</span>
						<SidebarPresenceAvatars
							peers={pagePeers('/games/[gameName]/setup')}
							pageLabel="Setup"
							class="ml-auto"
						/>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
		<Sidebar.MenuItem>
			<Sidebar.MenuButton tooltipContent="Local test">
				{#snippet child({ props })}
					<a
						href={projectViewHref(resolve(`/games/${activeGame?.name}/play`), page.url)}
						{...props}
					>
						<Play />
						<span>Local Test</span>
						<SidebarPresenceAvatars
							peers={pagePeers('/games/[gameName]/play')}
							pageLabel="Local Test"
							class="ml-auto"
						/>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
		<Sidebar.MenuItem>
			<Sidebar.MenuButton tooltipContent="Playtests">
				{#snippet child({ props })}
					<a
						href={projectViewHref(resolve(`/games/${activeGame?.name}/playtests`), page.url)}
						{...props}
					>
						<ClipboardList />
						<span>Playtests</span>
						<SidebarPresenceAvatars
							peers={pagePeers('/games/[gameName]/playtests')}
							pageLabel="Playtests"
							class="ml-auto"
						/>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
	</Sidebar.Menu>
</Sidebar.Group>
