<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter.js';
	import { COMPONENTS_DIR } from '$lib/workspace/project-layout';
	import { TextCursorInput } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { z } from 'zod';
	import type { ComponentFileStructure } from './types.js';

	let {
		projectFolder,
		deck,
		onRenamed,
		trigger
	}: {
		projectFolder: FsDir;
		deck: ComponentFileStructure;
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

	function renamedRoute(projectName: string, oldName: string, newName: string) {
		const oldBase = resolve(`/games/${projectName}/decks/${oldName}`);
		const currentPath = page.url.pathname;

		if (currentPath !== oldBase && !currentPath.startsWith(`${oldBase}/`)) return null;

		return `/games/${projectName}/decks/${newName}${currentPath.slice(oldBase.length)}${page.url.search}${page.url.hash}`;
	}

	async function renameDeck() {
		if (submitting) return;

		error = '';
		const parsedName = deckNameSchema.safeParse(deckName.trim());
		if (!parsedName.success) {
			error = parsedName.error.issues[0]?.message ?? 'Invalid deck name.';
			return;
		}

		const oldName = deck.name;
		const newName = parsedName.data;
		if (newName === oldName) {
			open = false;
			return;
		}

		const componentsDir = await projectFolder.openDir(COMPONENTS_DIR);
		if (componentsDir.error) {
			console.error(componentsDir.error);
			error = componentsDir.error.message;
			return;
		}

		const files = await componentsDir.data.list();
		if (files.error) {
			console.error(files.error);
			error = files.error.message;
			return;
		}

		if (files.data.some((candidate) => candidate.name === newName)) {
			error = `Deck "${newName}" already exists.`;
			return;
		}

		const projectName = projectFolder.name;
		const sourcePath = joinFsPath(COMPONENTS_DIR, oldName);
		const targetPath = joinFsPath(COMPONENTS_DIR, newName);

		submitting = true;
		const moved = await projectFolder.move(sourcePath, targetPath);
		if (moved.error) {
			error = moved.error.message;
			return;
		}
		onRenamed(oldName, newName);
		const destination = renamedRoute(projectName, oldName, newName);
		// @ts-expect-error Dynamic route with preserved suffix and query.
		if (destination) await goto(resolve(destination));
		submitting = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		{#snippet child({ props })}
			{@render trigger({ props })}
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Rename deck</Dialog.Title>
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
				<Button type="submit" disabled={submitting || !projectFolder}>
					<TextCursorInput /> Rename deck
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
