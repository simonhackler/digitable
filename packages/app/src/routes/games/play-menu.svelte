<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { exportProjectForPlaytest } from '$lib/playtests/project-transfer';
	import { Play, Share2 } from '@lucide/svelte';
	import type { FsDir } from '$lib/components/file-browser/adapters/adapter';
	import type { Game } from './types.js';

	let { activeGame, fileSystem }: { activeGame: Game | null; fileSystem: FsDir } = $props();

	let isCreatingPlaytest = $state(false);
	let playtestError = $state<string | null>(null);
	let inviteUrl = $state('');
	let dialogOpen = $state(false);

	async function createPlaytest() {
		if (!activeGame || isCreatingPlaytest) return;

		isCreatingPlaytest = true;
		playtestError = null;

		try {
			const files = await exportProjectForPlaytest(fileSystem);
			const response = await fetch(resolve('/api/playtests'), {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					projectName: activeGame.name,
					files
				})
			});

			if (!response.ok) {
				throw new Error(await response.text());
			}

			const result = (await response.json()) as { playtestId: string };
			inviteUrl = new URL(
				resolve('/playtests/[playtestId]', { playtestId: result.playtestId }),
				window.location.href
			).toString();
			dialogOpen = true;
		} catch (error) {
			playtestError = error instanceof Error ? error.message : 'Could not create playtest';
		} finally {
			isCreatingPlaytest = false;
		}
	}

	async function copyInviteLink() {
		await navigator.clipboard.writeText(inviteUrl);
	}
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>Play</Sidebar.GroupLabel>
	<Sidebar.Menu>
		<Sidebar.MenuItem>
			<Sidebar.MenuButton tooltipContent="Local test">
				{#snippet child({ props })}
					<a href={resolve(`/games/${activeGame?.name}/play`)} {...props}>
						<Play />
						<span>Local Test</span>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
		<Sidebar.MenuItem>
			<Sidebar.MenuButton tooltipContent="Create playtest">
				{#snippet child({ props })}
					<button
						{...props}
						type="button"
						onclick={createPlaytest}
						disabled={!activeGame || isCreatingPlaytest}
					>
						<Share2 />
						<span>{isCreatingPlaytest ? 'Syncing...' : 'Playtest'}</span>
					</button>
				{/snippet}
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
	</Sidebar.Menu>
	{#if playtestError}
		<p class="text-destructive px-2 pt-2 text-xs">{playtestError}</p>
	{/if}
</Sidebar.Group>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Playtest Invite</Dialog.Title>
			<Dialog.Description>
				Send this link to an authenticated playtester. The project will import before play opens.
			</Dialog.Description>
		</Dialog.Header>
		<div class="flex gap-2">
			<input
				class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-w-0 flex-1 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
				readonly
				value={inviteUrl}
				aria-label="Playtest invite link"
			/>
			<Button onclick={copyInviteLink}>Copy</Button>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (dialogOpen = false)}>Close</Button>
			<Button onclick={() => (window.location.href = inviteUrl)}>Open</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
