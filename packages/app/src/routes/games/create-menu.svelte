<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import placeholderFrontSvg from '../../../static/placeholder.svg?raw';
	import { resolve } from '$app/paths';
	import * as Select from '$lib/components/ui/select/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Ellipsis, Layers, Pencil, Table, Trash2 } from '@lucide/svelte';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { ComponentFileStructure, Game } from './types.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { z } from 'zod';
	import { superForm, defaults } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter.js';
	import { createEmptySvg } from '$lib/utils/svg-helpers.js';

	let { activeGame, fileSystem }: { activeGame: Game | null; fileSystem: FsDir } = $props();
	let openCreateDeckDialog = $state(false);

	const newDeckSchema = z.object({
		deckName: z
			.string()
			.min(3, 'Deck name must be at least 3 characters long')
			.regex(/^[A-Za-z0-9_-]+$/, 'Deck name can only contain letters and numbers without spaces'),
		width: z.number().min(10).max(300),
		height: z.number().min(10).max(300)
	});

	const form = superForm(defaults(zod4(newDeckSchema)), {
		SPA: true,
		validators: zod4(newDeckSchema),
		onUpdate({ form }) {
			if (form.valid) {
				switchPathAndCreateSvgs(activeGame!, form.data.deckName, form.data.width, form.data.height);
			}
		}
	});

	async function switchPathAndCreateSvgs(
		activeGame: Game,
		deckName: string,
		width: number,
		height: number
	) {
		const path = `/games/${activeGame.name}/decks/${deckName}/data`;
		const frontSvg = createEmptySvg(width, height);
		const backSvg = createEmptySvg(width, height);
		await Promise.all([
			uploadSvgAsSide(fileSystem, activeGame.name, deckName, frontSvg, 'front'),
			uploadSvgAsSide(fileSystem, activeGame.name, deckName, backSvg, 'back')
		]);
		await tick();
		// @ts-expect-error Weird sveltekit typing
		await goto(resolve(path));
		activeGame.decks.push({ name: deckName });

		openCreateDeckDialog = false;
	}

	async function uploadSvgAsSide(
		fileSystem: FsDir,
		currentProject: string,
		deckName: string,
		svg: SVGElement,
		side: 'front' | 'back'
	) {
		const svgString = new XMLSerializer().serializeToString(svg);
		const svgFile = new File([svgString], `${side}.svg`, { type: 'image/svg+xml' });
		const deckDir = await fileSystem.ensureDir(joinFsPath(currentProject, 'system', deckName));
		if (deckDir.error) {
			console.error(deckDir.error);
			return;
		}
		const svgWrite = await deckDir.data.write(svgFile.name, svgFile);
		if (svgWrite.error) console.error(svgWrite.error);

		const file = new File([placeholderFrontSvg], 'placeholder.svg', {
			type: 'image/svg+xml'
		});
		const filesDir = await fileSystem.ensureDir(joinFsPath(currentProject, 'files'));
		if (filesDir.error) {
			console.error(filesDir.error);
			return;
		}
		const placeholderWrite = await filesDir.data.write(file.name, file);
		if (placeholderWrite.error) console.error(placeholderWrite.error);
	}

	async function deleteDeck(
		fileSystem: FsDir,
		projectName: string,
		component: ComponentFileStructure
	) {
		const fullFolderPath = `/${projectName}/system/${component.name}`;
		console.log('deleting for', fullFolderPath);
		const removed = await fileSystem.remove(joinFsPath(fullFolderPath), { recursive: true });
		if (removed.error) {
			console.error(removed.error);
		} else {
			activeGame!.decks = activeGame!.decks.filter((x) => x.name !== component.name);
			await goto(resolve(`/games/${projectName}`));
		}
	}

	const cardFormats = {
		poker: { name: 'Poker / Euro Poker', width: 63, height: 88 },
		bridge: { name: 'Bridge', width: 56, height: 88 },
		tarot: { name: 'Tarot', width: 70, height: 121 },
		usGame: { name: 'US game', width: 55.9, height: 87.1 },
		miniUs: { name: 'Mini US / Mini American', width: 41, height: 63 },
		miniEuro: { name: 'Mini Euro / Mini European', width: 44, height: 67 },
		skat: { name: 'Skat', width: 58.9, height: 90.9 },
		domino: { name: 'Domino cards', width: 44, height: 89 },
		square50: { name: 'Square cards 50', width: 50, height: 50 },
		square63: { name: 'Square cards 63', width: 63, height: 63 },
		square70: { name: 'Square cards 70', width: 70, height: 70 },
		square89: { name: 'Square cards 89', width: 89, height: 89 }
	} as const;

	const cardFormatEntries = Object.entries(cardFormats) as [
		keyof typeof cardFormats,
		(typeof cardFormats)[keyof typeof cardFormats]
	][];

	const { form: formData, enhance, constraints } = form;
	let selectedCardFormat = $state<keyof typeof cardFormats>('poker');
	const selectedCardLabel = $derived(cardFormats[selectedCardFormat].name);

	$effect(() => {
		if (!selectedCardFormat) return;
		const card = cardFormats[selectedCardFormat];
		$formData.width = card.width;
		$formData.height = card.height;
	});
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>Create</Sidebar.GroupLabel>
	<Sidebar.Menu>
		<Collapsible.Root class="group/collapsible">
			<Sidebar.MenuItem>
				<Collapsible.Trigger>
					{#snippet child({ props })}
						<Sidebar.MenuButton {...props} tooltipContent="d">
							<Layers />
							<span>Decks</span>
							<ChevronRightIcon
								class="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
							/>
						</Sidebar.MenuButton>
					{/snippet}
				</Collapsible.Trigger>
				<Collapsible.Content>
					<Sidebar.MenuSub>
						<Sidebar.MenuSubItem>
							<Dialog.Root bind:open={openCreateDeckDialog}>
								<Dialog.Content>
									<Dialog.Header>
										<Dialog.Title>New deck</Dialog.Title>
										<form use:enhance>
											<Form.Field {form} name="deckName">
												<Form.Control>
													{#snippet children({ props })}
														<Input
															{...props}
															placeholder="deck name"
															bind:value={$formData.deckName}
														/>
													{/snippet}
												</Form.Control>
												<Form.Description />
												<Form.FieldErrors />
											</Form.Field>
											<Select.Root type="single" bind:value={selectedCardFormat}>
												<Select.Trigger class="mb-2 w-full">
													{selectedCardLabel}
												</Select.Trigger>
												<Select.Content>
													{#each cardFormatEntries as [card, format] (card)}
														<Select.Item value={card}>{format.name}</Select.Item>
													{/each}
												</Select.Content>
											</Select.Root>
											<div class="flex gap-2">
												<Form.Field {form} name="width">
													<Form.Control>
														{#snippet children({ props })}
															<div class="flex flex-row gap-1">
																<Form.Label>width:</Form.Label>
																<Input
																	{...props}
																	placeholder="width"
																	bind:value={$formData.width}
																	{...$constraints.width}
																	type="number"
																/>
															</div>
														{/snippet}
													</Form.Control>
													<Form.Description />
													<Form.FieldErrors />
												</Form.Field>
												<Form.Field {form} name="height">
													<Form.Control>
														{#snippet children({ props })}
															<div class="flex flex-row gap-1">
																<Form.Label>height:</Form.Label>
																<Input
																	{...props}
																	placeholder="height"
																	bind:value={$formData.height}
																	{...$constraints.height}
																	type="number"
																/>
															</div>
														{/snippet}
													</Form.Control>
													<Form.Description />
													<Form.FieldErrors />
												</Form.Field>
											</div>
											<Button type="submit">
												<PlusIcon /> Create new deck
											</Button>
										</form>
									</Dialog.Header>
								</Dialog.Content>
								<Sidebar.MenuSubButton>
									{#snippet child({ props })}
										<Dialog.Trigger {...props}>
											{#snippet child({ props })}
												<Button {...props} variant="outline" class="w-full">
													<PlusIcon /> New
												</Button>
											{/snippet}
										</Dialog.Trigger>
									{/snippet}
								</Sidebar.MenuSubButton>
							</Dialog.Root>
						</Sidebar.MenuSubItem>
						{#each activeGame?.decks ?? [] as deck (deck.name)}
							<Sidebar.MenuSubItem>
								<Sidebar.MenuSubButton>
									{#snippet child({ props })}
										<a
											href={resolve(`/games/${activeGame?.name}/decks/${deck.name}/data`)}
											{...props}
										>
											<span class="text-muted-foreground">{deck.name}</span>
										</a>
									{/snippet}
								</Sidebar.MenuSubButton>
								<DropdownMenu.Root>
									<DropdownMenu.Trigger>
										{#snippet child({ props })}
											<Sidebar.MenuAction
												{...props}
												class="data-[state=open]:bg-accent rounded-sm opacity-0 group-hover/menu-sub-item:opacity-100 data-[state=open]:opacity-100"
											>
												<Ellipsis />
												<span class="sr-only">More</span>
											</Sidebar.MenuAction>
										{/snippet}
									</DropdownMenu.Trigger>
									<DropdownMenu.Content class="w-24 rounded-lg">
										{@const path = `/games/${activeGame!.name}/decks/${deck.name}`}
										{/* @ts-expect-error paths*/ null}
										<DropdownMenu.Item
											onSelect={() => goto(resolve(`${path}/editor`))}
											class="flex w-full justify-start gap-2"
										>
											<Pencil />
											<span>Editor</span>
										</DropdownMenu.Item>
										{/* @ts-expect-error paths*/ null}
										<DropdownMenu.Item
											onSelect={() => goto(resolve(`${path}/data`))}
											class="flex w-full justify-start gap-2"
										>
											<Table />
											<span>Data</span>
										</DropdownMenu.Item>
										<DropdownMenu.Separator />
										<DropdownMenu.Item
											variant="destructive"
											onSelect={() => deleteDeck(fileSystem, activeGame!.name, deck)}
											class="flex w-full justify-start gap-2"
										>
											<Trash2 />
											<span>Delete</span>
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							</Sidebar.MenuSubItem>
						{/each}
					</Sidebar.MenuSub>
				</Collapsible.Content>
			</Sidebar.MenuItem>
		</Collapsible.Root>
	</Sidebar.Menu>
</Sidebar.Group>
