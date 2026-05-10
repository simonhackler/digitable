<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter.js';
	import { TextCursorInput } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { z } from 'zod';
	import type { ComponentFileStructure, Game } from './types.js';

	let {
		activeGame,
		deck,
		fileSystem,
		onRenamed,
		trigger
	}: {
		activeGame: Game | null;
		deck: ComponentFileStructure;
		fileSystem: FsDir;
		onRenamed: (oldName: string, newName: string) => void;
		trigger: Snippet<[{ props: Record<string, unknown> }]>;
	} = $props();

	let open = $state(false);
	let deckName = $state('');
	let error = $state('');
	let submitting = $state(false);

	const deckNameSchema = z
		.string()
		.min(3, 'Deck name must be at least 3 characters long')
		.regex(
			/^[A-Za-z0-9_-]+$/,
			'Deck name can only contain letters, numbers, underscores, and hyphens'
		);

	function setOpen(nextOpen: boolean) {
		open = nextOpen;
		if (nextOpen) {
			deckName = deck.name;
		}
		error = '';
	}

	function renamedRoute(projectName: string, oldName: string, newName: string) {
		const oldBase = resolve(`/games/${projectName}/decks/${oldName}`);
		const currentPath = page.url.pathname;

		if (currentPath !== oldBase && !currentPath.startsWith(`${oldBase}/`)) return null;

		return `/games/${projectName}/decks/${newName}${currentPath.slice(oldBase.length)}${page.url.search}${page.url.hash}`;
	}

	async function renameDeck() {
		if (!activeGame || submitting) return;

		error = '';
		const parsedName = deckNameSchema.safeParse(deckName.trim());
		if (!parsedName.success) {
			error = parsedName.error.issues[0]?.message ?? 'Invalid deck name.';
			return;
		}

		const oldName = deck.name;
		const newName = parsedName.data;
		if (newName === oldName) {
			setOpen(false);
			return;
		}

		if (activeGame.decks.some((candidate) => candidate.name === newName)) {
			error = `Deck "${newName}" already exists.`;
			return;
		}

		const projectName = activeGame.name;
		const sourcePath = joinFsPath(projectName, 'system', oldName);
		const targetPath = joinFsPath(projectName, 'system', newName);

		submitting = true;
		try {
			const moved = await fileSystem.move(sourcePath, targetPath);
			if (moved.error) {
				error = moved.error.message;
				return;
			}

			onRenamed(oldName, newName);
			setOpen(false);

			const destination = renamedRoute(projectName, oldName, newName);
			// @ts-expect-error Dynamic route with preserved suffix and query.
			if (destination) await goto(resolve(destination));
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog.Root bind:open={() => open, setOpen}>
	<Dialog.Trigger>
		{#snippet child({ props })}
			{@render trigger({ props })}
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Rename deck</Dialog.Title>
			<Dialog.Description>Rename the deck folder without changing its files.</Dialog.Description>
		</Dialog.Header>
		<form
			class="flex flex-col gap-3"
			onsubmit={(event) => {
				event.preventDefault();
				renameDeck();
			}}
		>
			<div class="flex flex-col gap-1.5">
				<label class="text-sm font-medium" for="rename-deck-name">Deck name</label>
				<Input
					id="rename-deck-name"
					bind:value={deckName}
					aria-invalid={error ? 'true' : undefined}
					aria-describedby={error ? 'rename-deck-error' : undefined}
					autocomplete="off"
					oninput={() => (error = '')}
				/>
			</div>
			{#if error}
				<p id="rename-deck-error" role="alert" class="text-destructive text-sm">
					{error}
				</p>
			{/if}
			<Dialog.Footer>
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="outline" disabled={submitting}>Cancel</Button>
					{/snippet}
				</Dialog.Close>
				<Button type="submit" disabled={submitting || !activeGame}>
					<TextCursorInput /> Rename deck
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
