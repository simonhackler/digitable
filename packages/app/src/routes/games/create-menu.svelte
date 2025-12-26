<script lang="ts">
	import { resolve } from '$app/paths';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Layers } from '@lucide/svelte';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { Game } from './types.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { z } from 'zod';
	import { superForm, defaults } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';

	let { activeGame }: { activeGame: Game | null } = $props();
	let openCreateDeckDialog = $state(false);

	const newDeckSchema = z.object({
		deckName: z
			.string()
			.min(3, 'Deck name must be at least 3 characters long')
			.regex(/^[A-Za-z0-9_-]+$/, 'Deck name can only contain letters and numbers without spaces')
	});

	const form = superForm(defaults(zod4(newDeckSchema)), {
		SPA: true,
		validators: zod4(newDeckSchema),
		onUpdate({ form }) {
			if (form.valid) {
				const path = `/games/${activeGame?.name}/decks/${form.data.deckName}/data`;
				switchPath(path);
			}
		}
	});

	async function switchPath(path: string) {
		await tick();
		// @ts-expect-error Weird sveltekit typing
		await goto(resolve(path));
		openCreateDeckDialog = false;
	}

	const { form: formData, enhance } = form;
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
										<Dialog.Title>New deck name</Dialog.Title>
										<form use:enhance>
											<Form.Field {form} name="deckName">
												<Form.Control>
													{#snippet children({ props })}
														<Form.Label>Email</Form.Label>
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
							</Sidebar.MenuSubItem>
						{/each}
					</Sidebar.MenuSub>
				</Collapsible.Content>
			</Sidebar.MenuItem>
		</Collapsible.Root>
	</Sidebar.Menu>
</Sidebar.Group>
