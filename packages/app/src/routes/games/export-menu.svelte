<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Download, Gamepad2, Printer } from '@lucide/svelte';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { Game } from './types.js';

	let { activeGame }: { activeGame: Game | null } = $props();
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
									<a href={`/games/${activeGame?.name}/export/tts`} {...props}>
										<Gamepad2 class="mr-2 h-4 w-4" />
										TTS
									</a>
								{/snippet}
							</Sidebar.MenuSubButton>
						</Sidebar.MenuSubItem>
						<Sidebar.MenuSubItem>
							<Sidebar.MenuSubButton>
								{#snippet child({ props })}
									<a href={`/games/${activeGame?.name}/export/paper`} {...props}>
										<Printer class="mr-2 h-4 w-4" />
										Paper
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
