<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ConfirmDeleteDialog, confirmDelete } from '$lib/components/ui/confirm-delete-dialog';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input';
	import { assert } from '$lib/utils/assert';
	import { updateText } from '@automerge/automerge-repo';
	import { CircleCheck } from '@lucide/svelte';
	import { createGameSchema, type CreateGameForm } from '../schemas.js';
	import {
		getActiveProjectContext,
		getActiveProjectState,
		getFileSystemContext,
		getGamesContext
	} from '../context.js';
	import GameTopBar from '../game-top-bar.svelte';

	const fileSystem = getFileSystemContext();
	const games = getGamesContext();
	const projectState = getActiveProjectState();
	const project = getActiveProjectContext();
	const readOnly = project.session.readOnly;
	const initial = project.metadata.current;
	assert(initial, 'Game metadata document is unavailable');

	const metadata = $derived(project.metadata.current);
	let errors = $state<Partial<Record<keyof CreateGameForm, string>>>({});
	let saveError = $state<string | null>(null);
	let successMessage = $state('');
	let isSubmitting = $state(false);
	const isCreateMode = $derived(page.url.searchParams.has('gameName'));
	const saveStatus = $derived(
		projectState.reconciliation.state === 'syncing' ? 'Saving locally' : 'Saved locally'
	);
	const reconciliationError = $derived(
		projectState.reconciliation.state === 'error' ? projectState.reconciliation.message : null
	);

	function changeText(field: 'name' | 'description', value: string) {
		const valid = field === 'name' ? value.length >= 1 && value.length <= 80 : value.length <= 500;
		if (!valid) {
			errors[field] = field === 'name' ? 'Game name is required' : 'Description is too long';
			return;
		}
		errors[field] = undefined;

		project.metadata.change((document) => {
			if (document[field] !== value) updateText(document, [field], value);
		});
	}

	function changePlayers(field: 'minPlayers' | 'maxPlayers', value: number) {
		const current = project.metadata.current;
		if (!current) return;
		const minPlayers = field === 'minPlayers' ? value : current.players.min;
		const maxPlayers = field === 'maxPlayers' ? value : current.players.max;
		const valid =
			Number.isInteger(minPlayers) &&
			minPlayers >= 1 &&
			minPlayers <= 20 &&
			Number.isInteger(maxPlayers) &&
			maxPlayers >= 1 &&
			maxPlayers <= 20 &&
			minPlayers <= maxPlayers;
		if (!valid) {
			errors[field] = 'Players must be between 1 and 20, with minimum no greater than maximum';
			return;
		}
		errors.minPlayers = undefined;
		errors.maxPlayers = undefined;

		project.metadata.change((document) => {
			document.players = { min: minPlayers, max: maxPlayers };
		});
	}

	async function saveGame(event: SubmitEvent) {
		event.preventDefault();
		if (Object.values(errors).some(Boolean)) return;
		const current = project.metadata.current;
		if (!current) return;
		const parsed = createGameSchema.safeParse({
			name: current.name,
			minPlayers: current.players.min,
			maxPlayers: current.players.max,
			description: current.description
		});
		if (!parsed.success) {
			errors = Object.fromEntries(
				parsed.error.issues.flatMap((issue) => {
					const field = issue.path[0];
					return typeof field === 'string' ? [[field, issue.message]] : [];
				})
			);
			return;
		}

		isSubmitting = true;
		saveError = null;
		successMessage = '';
		const synchronized = await project.session.sync();
		isSubmitting = false;
		if (synchronized.error) {
			saveError = synchronized.error.message;
			return;
		}

		successMessage = isCreateMode ? 'Game created successfully!' : 'Game updated successfully!';
		setTimeout(() => (successMessage = ''), 3000);
		if (isCreateMode) {
			await goto(resolve(`/games/${project.key}`), {
				replaceState: true,
				noScroll: true,
				keepFocus: true
			});
		}
	}

	async function deleteGame() {
		const closed = await project.session.close();
		if (closed.error) {
			saveError = closed.error.message;
			return;
		}
		project.metadata.destroy();
		projectState.current = null;
		projectState.phase = 'idle';

		const removed = await fileSystem.remove(project.key, { recursive: true });
		if (removed.error) {
			saveError = removed.error.message;
			return;
		}
		if (games.existingGames) {
			games.existingGames = games.existingGames.filter((game) => game.name !== project.key);
		}
		await goto(resolve('/games'));
	}
</script>

<svelte:head>
	<title>{metadata?.name ?? project.key}</title>
</svelte:head>

<div class="flex min-h-svh flex-col">
	<GameTopBar status={saveStatus} statusError={saveError ?? reconciliationError} />
	<div class="mx-auto w-full max-w-4xl p-6">
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-center text-2xl font-bold">
					{isCreateMode ? 'Create New Board Game' : 'Edit Board Game'}
				</Card.Title>
				{#if !isCreateMode && !readOnly}
					<ConfirmDeleteDialog />
					<div class="flex items-center justify-center">
						<Button
							variant="destructive"
							size="lg"
							onclick={() => {
								confirmDelete({
									title: 'Delete',
									description: 'Are you sure you want to delete this item?',
									input: { confirmationText: metadata?.name ?? project.key },
									onConfirm: deleteGame
								});
							}}
						>
							Delete
						</Button>
					</div>
				{/if}
				<hr class="border-t border-gray-300" />
			</Card.Header>
			<Card.Content>
				<form class="space-y-6" onsubmit={saveGame}>
					<div class="space-y-2">
						<label class="text-base font-medium" for="game-name">Game Name</label>
						<Input
							id="game-name"
							value={metadata?.name ?? ''}
							oninput={(event) => changeText('name', event.currentTarget.value)}
							maxlength={80}
							aria-invalid={errors.name ? 'true' : undefined}
							aria-describedby={errors.name ? 'game-name-error' : undefined}
							class="w-full"
							disabled={readOnly}
						/>
						<div class="text-muted-foreground flex justify-between text-xs">
							<span>Up to 80 characters, required</span>
							<span>{metadata?.name.length ?? 0}/80</span>
						</div>
						{#if errors.name}
							<p id="game-name-error" class="text-destructive text-sm" role="alert">
								{errors.name}
							</p>
						{/if}
					</div>

					<div class="space-y-2">
						<div class="text-base font-medium">Players</div>
						<div class="flex gap-4">
							<div class="flex-1 space-y-1">
								<label class="text-base" for="min-players">Min</label>
								<Input
									id="min-players"
									type="number"
									value={metadata?.players.min ?? 1}
									oninput={(event) =>
										changePlayers('minPlayers', event.currentTarget.valueAsNumber)}
									min={1}
									max={20}
									aria-invalid={errors.minPlayers ? 'true' : undefined}
									class="w-20"
									disabled={readOnly}
								/>
								{#if errors.minPlayers}
									<p class="text-destructive text-sm" role="alert">{errors.minPlayers}</p>
								{/if}
							</div>
							<div class="flex-1 space-y-1">
								<label class="text-base" for="max-players">Max</label>
								<Input
									id="max-players"
									type="number"
									value={metadata?.players.max ?? 1}
									oninput={(event) =>
										changePlayers('maxPlayers', event.currentTarget.valueAsNumber)}
									min={1}
									max={20}
									aria-invalid={errors.maxPlayers ? 'true' : undefined}
									class="w-20"
									disabled={readOnly}
								/>
								{#if errors.maxPlayers}
									<p class="text-destructive text-sm" role="alert">{errors.maxPlayers}</p>
								{/if}
							</div>
						</div>
					</div>

					<div class="space-y-2">
						<label class="text-base font-medium" for="game-description">Game Description</label>
						<textarea
							id="game-description"
							value={metadata?.description ?? ''}
							oninput={(event) => changeText('description', event.currentTarget.value)}
							rows={4}
							maxlength={500}
							aria-invalid={errors.description ? 'true' : undefined}
							aria-describedby={errors.description ? 'game-description-error' : undefined}
							class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
							disabled={readOnly}
						></textarea>
						<div class="text-muted-foreground flex justify-between text-xs">
							<span>Up to 500 characters, optional</span>
							<span>{metadata?.description.length ?? 0}/500</span>
						</div>
						{#if errors.description}
							<p id="game-description-error" class="text-destructive text-sm" role="alert">
								{errors.description}
							</p>
						{/if}
					</div>

					{#if successMessage}
						<div
							class="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-green-800"
						>
							<CircleCheck class="h-5 w-5" />
							<span>{successMessage}</span>
						</div>
					{/if}

					<Button type="submit" class="w-full" disabled={isSubmitting || readOnly}>
						{isSubmitting ? 'Saving...' : isCreateMode ? 'Create' : 'Update'}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</div>
