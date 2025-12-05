<script lang="ts">
    import { resolve } from '$app/paths';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Play } from '@lucide/svelte';
	import type { Game } from './types.js';

	let { activeGame }: { activeGame: Game | null } = $props();
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>Play</Sidebar.GroupLabel>
	<Sidebar.Menu>
		<Sidebar.MenuItem>
			<Sidebar.MenuButton tooltipContent="Play game">
				{#snippet child({ props })}
					<a href={resolve(`/games/${activeGame?.name}/play`)} {...props}>
						<Play />
						<span>Play</span>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
	</Sidebar.Menu>
</Sidebar.Group>
