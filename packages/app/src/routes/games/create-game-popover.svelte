<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Plus } from '@lucide/svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import Input from '$lib/components/ui/input/input.svelte';
	import { navigateToCreateGameSchema } from './schemas.js';
	import type { Snippet } from 'svelte';
	import { getFileSystemContext, getGamesContext } from './context.js';
	import { parseFsPath } from '$lib/components/file-browser/adapters/adapter';
	import { gameMetadataMaterializer, type GameMetadataDocument } from '$lib/collaboration';
	import { DIGITABLE_VERSION } from '$lib/workspace/digitable-version';
	import { withProjectLock } from '$lib/collaboration/project-lock';

	interface Props {
		trigger?: Snippet<[Record<string, unknown>]>;
		open?: boolean;
	}

	let { trigger, open = $bindable(false) }: Props = $props();
	const fileSystem = getFileSystemContext();
	const games = getGamesContext();
	let gameName = $state('');
	let nameError = $state('');
	let creationError = $state('');
	let isCreating = $state(false);

	async function createGame(gameName: string) {
		if (isCreating) return;
		creationError = '';
		const folderName = gameName.trim().replace(/\s+/g, '_');
		const parsedPath = parseFsPath('ensureDir', folderName);
		if (parsedPath.error) {
			creationError = parsedPath.error.message;
			return;
		}

		isCreating = true;
		const metadata: GameMetadataDocument = {
			type: 'game-metadata',
			schemaVersion: 1,
			name: gameName,
			players: { min: 1, max: 4 },
			description: '',
			tags: [],
			digitableVersion: DIGITABLE_VERSION,
			extra: {}
		};
		const created = await withProjectLock(`create:${folderName}`, async () => {
			const root = await fileSystem.list();
			if (root.error) return root;
			if (root.data.some((entry) => entry.name === folderName)) {
				return {
					data: null,
					error: { message: `A project folder named "${folderName}" already exists.` }
				};
			}

			const project = await fileSystem.ensureDir(folderName);
			if (project.error) return project;
			const written = await project.data.write(
				'game.json',
				gameMetadataMaterializer.serialize(metadata)
			);
			if (written.error) await fileSystem.remove(folderName, { recursive: true });
			return written;
		});
		if (created.error) {
			creationError = created.error.message;
			isCreating = false;
			return;
		}

		if (games.existingGames) {
			games.existingGames = [
				...games.existingGames,
				{ name: folderName, description: '', tags: [], decks: [] }
			].sort((left, right) => left.name.localeCompare(right.name));
		}
		open = false;
		const searchParams = new URLSearchParams({ gameName });
		await goto(resolve(`/games/${folderName}?${searchParams}`));
		isCreating = false;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		nameError = '';
		const parsed = navigateToCreateGameSchema.safeParse({ name: gameName });
		if (!parsed.success) {
			nameError = parsed.error.issues[0]?.message ?? 'Invalid game name.';
			return;
		}
		await createGame(parsed.data.name);
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			{#if trigger}
				{@render trigger(props)}
			{:else}
				<Button class="flex w-full items-center gap-2" {...props}>
					<Plus class="h-4 w-4" />
					Create Game
				</Button>
			{/if}
		{/snippet}
	</Popover.Trigger>
	<Popover.Content>
		<form class="w-full space-y-6" onsubmit={submit}>
			<div class="space-y-2">
				<label for="new-game-name" class="text-sm font-medium">Gamename</label>
				<Input
					id="new-game-name"
					bind:value={gameName}
					oninput={() => {
						nameError = '';
						creationError = '';
					}}
					maxlength={80}
					aria-invalid={nameError ? 'true' : undefined}
					aria-describedby={nameError ? 'new-game-name-error' : undefined}
					class="w-full"
				/>
				<div class="text-muted-foreground flex justify-between text-xs">
					<span>Up to 80 characters, required</span>
					<span>{gameName.length}/80</span>
				</div>
				{#if nameError}
					<p id="new-game-name-error" class="text-destructive text-sm" role="alert">
						{nameError}
					</p>
				{/if}
			</div>
			{#if creationError}
				<p class="text-destructive text-sm" role="alert">{creationError}</p>
			{/if}
			<Button type="submit" disabled={isCreating}>{isCreating ? 'Creating...' : 'Create'}</Button>
		</form>
	</Popover.Content>
</Popover.Root>
