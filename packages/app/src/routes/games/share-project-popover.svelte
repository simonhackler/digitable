<script lang="ts">
	import { resolve } from '$app/paths';
	import { buildProjectShareUrl, type ProjectSession } from '$lib/collaboration';
	import { Button } from '$lib/components/ui/button';
	import Input from '$lib/components/ui/input/input.svelte';
	import * as Popover from '$lib/components/ui/popover';
	import { Check, Copy, Share2 } from '@lucide/svelte';
	import { Ok, tryAsync } from 'wellcrafted/result';

	let { session }: { session: ProjectSession } = $props();
	let copied = $state(false);
	let copyError = $state('');
	const invitation = $derived(
		buildProjectShareUrl(session.historyUrl, window.location.href, resolve('/games/join'))
	);

	async function copyInvitation() {
		copyError = '';
		const result = await tryAsync({
			try: async () => {
				const synchronized = await session.sync();
				if (synchronized.error) throw synchronized.error;
				await navigator.clipboard.writeText(invitation);
				return true;
			},
			catch: () => Ok(false)
		});
		copied = result.data;
		if (!copied) copyError = 'Could not copy the sharing link.';
	}
</script>

<Popover.Root>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" class="w-full justify-start">
				<Share2 />
				Share project
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content align="start" class="w-96 space-y-3">
		<div class="space-y-1">
			<h2 class="font-medium">Share this project</h2>
			<p class="text-muted-foreground text-sm">
				Anyone signed in with this link can open and edit the full project history.
			</p>
		</div>
		<label class="space-y-1 text-sm font-medium">
			Project sharing link
			<Input aria-label="Project sharing link" value={invitation} readonly />
		</label>
		<Button type="button" class="w-full" onclick={copyInvitation}>
			{#if copied}<Check />Copied{:else}<Copy />Copy link{/if}
		</Button>
		{#if copyError}<p class="text-destructive text-sm" role="alert">{copyError}</p>{/if}
	</Popover.Content>
</Popover.Root>
