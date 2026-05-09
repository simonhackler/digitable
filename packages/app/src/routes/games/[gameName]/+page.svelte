<script lang="ts">
	import { ConfirmDeleteDialog, confirmDelete } from '$lib/components/ui/confirm-delete-dialog';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { superForm, defaults } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import TagSelector from './tag-selector.svelte';
	import { createGameSchema, type CreateGameForm } from '../schemas.js';
	import { getFileSystemContext, getGamesContext } from '../context.js';
	import { Upload, Image } from '@lucide/svelte';
	import { CircleCheck } from '@lucide/svelte';
	import { requireParam } from '$lib/utils/assert';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { joinFsPath } from '$lib/components/file-browser/adapters/adapter';

	const fileSystem = getFileSystemContext();
	const games = getGamesContext();
	const gameNameParsed = $derived(requireParam('gameName'));
	const gameName = $derived(page.url.searchParams.get('gameName') ?? '');

	// Load game data using top-level await
	async function loadGameData(
		gameNameParsed: string,
		gameName: string
	): Promise<{
		data: CreateGameForm;
		isEditMode: boolean;
		thumbnailUrl?: string;
	}> {
		try {
			const gameDir = await fileSystem.openDir(gameNameParsed);
			if (gameDir.error) throw gameDir.error;

			const gameFileResult = await gameDir.data.readText('game.json');

			if (!gameFileResult.error) {
				const gameData = JSON.parse(gameFileResult.data);

				// Try to load existing thumbnail
				let thumbnailUrl: string | undefined;
				try {
					const thumbnailResult = await gameDir.data.read('thumbnail.jpg');
					if (!thumbnailResult.error) {
						thumbnailUrl = URL.createObjectURL(thumbnailResult.data);
					}
				} catch {
					// No thumbnail exists
				}

				return { data: gameData, isEditMode: true, thumbnailUrl };
			}
		} catch (error) {
			if (
				!(error && typeof error === 'object' && 'name' in error && error.name === 'NotFoundError')
			) {
				console.error('Failed to load game data:', error);
			}
		}

		return {
			data: {
				name: gameName,
				minPlayers: 1,
				maxPlayers: 4,
				description: '',
				tags: []
			},
			isEditMode: false
		};
	}

	const {
		data: initialData,
		isEditMode,
		thumbnailUrl: initialThumbnailUrl
	} = $derived(await loadGameData(gameNameParsed, gameName));

	const form = $derived(
		superForm(defaults(initialData, zod4(createGameSchema)), {
			SPA: true,
			validators: zod4(createGameSchema),
			async onUpdate({ form }) {
				if (form.valid) {
					isSubmitting = true;
					showSuccessMessage = false;

					const data: CreateGameForm = form.data;
					const folderName = data.name.replace(/\s+/g, '_');
					const gameData = JSON.stringify(data, null, 2);
					const gameFile = new File([gameData], 'game.json', { type: 'application/json' });

					const gameDir = await fileSystem.ensureDir(gameNameParsed);
					if (gameDir.error) {
						console.error('Failed to open game folder:', gameDir.error);
						isSubmitting = false;
						return;
					}

					const writeGame = await gameDir.data.write(gameFile.name, gameFile);
					if (writeGame.error) {
						console.error('Failed to save game:', writeGame.error);
						isSubmitting = false;
						return;
					}

					if (selectedThumbnail) {
						const thumbnailDir =
							folderName === gameNameParsed ? gameDir : await fileSystem.ensureDir(folderName);
						if (thumbnailDir.error) {
							console.error('Failed to open thumbnail folder:', thumbnailDir.error);
							isSubmitting = false;
							return;
						}
						const thumbnailWrite = await thumbnailDir.data.write(
							selectedThumbnail.name,
							selectedThumbnail
						);
						if (thumbnailWrite.error) {
							console.error('Failed to save thumbnail:', thumbnailWrite.error);
						}
					}

					syncSavedGame(data);
					isSubmitting = false;
					showSuccessMessage = true;
					setTimeout(() => {
						showSuccessMessage = false;
					}, 3000);
				}
			}
		})
	);
	const { form: formData, enhance } = $derived(form);

	let selectedTags = $derived<string[]>(initialData.tags || []);
	let selectedThumbnail = $state<File | null>(null);
	let thumbnailPreviewUrl = $derived<string | null>(initialThumbnailUrl || null);
	let showSuccessMessage = $state(false);
	let isSubmitting = $state(false);

	function syncSavedGame(data: CreateGameForm) {
		if (!games.existingGames) return;

		const existingGame = games.existingGames.find((game) => game.name === gameNameParsed);
		const savedGame = {
			name: gameNameParsed,
			decks: existingGame?.decks ?? [],
			description: data.description,
			tags: data.tags
		};

		games.existingGames = existingGame
			? games.existingGames.map((game) => (game.name === gameNameParsed ? savedGame : game))
			: [...games.existingGames, savedGame].sort((a, b) => a.name.localeCompare(b.name));
	}

	function handleTagsChange(tags: string[]) {
		selectedTags = tags;
		$formData.tags = selectedTags;
	}

	function handleThumbnailChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (file) {
			if (!file.type.startsWith('image/')) {
				alert('Please select an image file');
				return;
			}

			selectedThumbnail = new File([file], 'thumbnail.jpg', { type: 'image/jpeg' });

			if (thumbnailPreviewUrl) {
				URL.revokeObjectURL(thumbnailPreviewUrl);
			}
			thumbnailPreviewUrl = URL.createObjectURL(file);
		}
	}

	function removeThumbnail() {
		selectedThumbnail = null;
		if (thumbnailPreviewUrl) {
			URL.revokeObjectURL(thumbnailPreviewUrl);
		}
		thumbnailPreviewUrl = null;

		// Reset the file input
		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		if (input) {
			input.value = '';
		}
	}

	async function deleteGame() {
		const removed = await fileSystem.remove(joinFsPath(gameNameParsed), { recursive: true });
		if (removed.error) {
			console.error('Failed to delete game:', removed.error);
			return;
		}

		if (games.existingGames) {
			games.existingGames = games.existingGames.filter((game) => game.name !== gameNameParsed);
		}

		await goto(resolve('/games'));
	}
</script>

<div class="mx-auto max-w-4xl p-6">
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-center text-2xl font-bold">
				{isEditMode ? 'Edit Board Game' : 'Create New Board Game'}
			</Card.Title>
			{#if isEditMode}
				<ConfirmDeleteDialog />

				<div class="flex items-center justify-center">
					<Button
						variant="destructive"
						size="lg"
						onclick={() => {
							confirmDelete({
								title: 'Delete',
								description: 'Are you sure you want to delete this item?',
								input: {
									confirmationText: gameName
								},
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
			{#key form}
				<form use:enhance class="space-y-6">
					<Form.Field {form} name="name">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label class="text-base font-medium">Game Name</Form.Label>
								<Input
									{...props}
									bind:value={$formData.name}
									placeholder=""
									maxlength={80}
									class="w-full"
								/>
							{/snippet}
						</Form.Control>
						<Form.Description class="text-muted-foreground flex justify-between text-xs">
							<span>up to 80 characters · required</span>
							<span>{$formData.name?.length || 0}/80</span>
						</Form.Description>
						<Form.FieldErrors />
					</Form.Field>

					<div class="space-y-2">
						<div class="text-base font-medium">Players</div>
						<div class="flex gap-4">
							<Form.Field {form} name="minPlayers" class="flex-1">
								<Form.Control>
									{#snippet children({ props })}
										<div class="flex items-center gap-2">
											<span class="text-base">Min</span>
											<Input
												{...props}
												type="number"
												bind:value={$formData.minPlayers}
												min={1}
												max={20}
												class="w-16"
											/>
										</div>
									{/snippet}
								</Form.Control>
								<Form.FieldErrors />
							</Form.Field>

							<Form.Field {form} name="maxPlayers" class="flex-1">
								<Form.Control>
									{#snippet children({ props })}
										<div class="flex items-center gap-2">
											<span class="text-base">Max</span>
											<Input
												{...props}
												type="number"
												bind:value={$formData.maxPlayers}
												min={1}
												max={20}
												class="w-16"
											/>
										</div>
									{/snippet}
								</Form.Control>
								<Form.FieldErrors />
							</Form.Field>
						</div>
					</div>

					<Form.Field {form} name="description">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label class="text-base font-medium">Game Description</Form.Label>
								<textarea
									{...props}
									bind:value={$formData.description}
									placeholder=""
									rows={4}
									maxlength={500}
									class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-base file:border-0 file:bg-transparent file:text-base file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
								></textarea>
							{/snippet}
						</Form.Control>
						<Form.Description class="text-muted-foreground flex justify-between text-xs">
							<span>up to 500 characters · required</span>
							<span>{$formData.description?.length || 0}/500</span>
						</Form.Description>
						<Form.FieldErrors />
					</Form.Field>

					<TagSelector {form} {selectedTags} onTagsChange={handleTagsChange} />

					<!-- Thumbnail Upload -->
					<div class="space-y-2">
						<div class="text-base font-medium">Game Thumbnail</div>
						<div class="space-y-4">
							<!-- Image Preview -->
							<div class="relative">
								<div
									class="border-input bg-muted/50 w-full overflow-hidden rounded-lg border-2 border-dashed"
									style="aspect-ratio: 920 / 430;"
								>
									{#if thumbnailPreviewUrl}
										<img
											src={thumbnailPreviewUrl}
											alt="Game thumbnail preview"
											class="h-full w-full object-cover"
										/>
										<button
											aria-label="Remove thumbnail"
											type="button"
											onclick={removeThumbnail}
											class="bg-destructive text-destructive-foreground hover:bg-destructive/90 absolute top-2 right-2 rounded-full p-1"
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M6 18L18 6M6 6l12 12"
												/>
											</svg>
										</button>
									{:else}
										<div
											class="text-muted-foreground flex h-full flex-col items-center justify-center"
										>
											<Image class="mb-2 h-12 w-12" />
											<p class="text-sm">920px × 430px thumbnail</p>
											<p class="text-xs">Will be stretched to fill</p>
										</div>
									{/if}
								</div>
							</div>

							<!-- File Input -->
							<div class="flex items-center gap-2">
								<Input
									type="file"
									accept="image/*"
									onchange={handleThumbnailChange}
									class="flex-1"
								/>
								<Button
									type="button"
									onclick={() =>
										(document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
									variant="outline"
									size="sm"
								>
									<Upload class="mr-2 h-4 w-4" />
									Browse
								</Button>
							</div>

							<p class="text-muted-foreground text-xs">
								Recommended size: 920px × 430px. Larger images will be scaled to fit.
							</p>
						</div>
					</div>

					<div class="pt-4">
						<!-- Success Message -->
						{#if showSuccessMessage}
							<div
								class="mb-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-green-800"
							>
								<CircleCheck class="h-5 w-5" />
								<span>Game {isEditMode ? 'updated' : 'created'} successfully!</span>
							</div>
						{/if}

						<Button type="submit" class="w-full" disabled={isSubmitting}>
							{#if isSubmitting}
								<div
									class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
								></div>
							{/if}
							{isSubmitting ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
						</Button>
					</div>
				</form>
			{/key}
		</Card.Content>
	</Card.Root>
</div>
