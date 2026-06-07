<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { resolve } from '$app/paths';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import {
		Ellipsis,
		Layers,
		LayoutTemplate,
		Table2,
		TextCursorInput,
		Trash2
	} from '@lucide/svelte';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { ComponentFileStructure, Game } from './types.js';
	import RenameDeckDialog from './rename-deck-dialog.svelte';
	import NewDeckDialog from './new-deck-dialog.svelte';
	import { goto } from '$app/navigation';
	import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter.js';
	import { BookOpenText } from '@lucide/svelte';
	import { COMPONENTS_DIR } from '$lib/workspace/project-layout';

	let { activeGame, fileSystem }: { activeGame: Game | null; fileSystem: FsDir } = $props();

	function onDeckRenamed(oldName: string, newName: string) {
		if (!activeGame) return;

		activeGame.decks = activeGame.decks.map((deck) =>
			deck.name === oldName ? { name: newName } : deck
		);
	}

	function onDeckCreated(deckName: string) {
		if (!activeGame) return;

		activeGame.decks = [...activeGame.decks, { name: deckName }];
	}

	async function deleteDeck(
		fileSystem: FsDir,
		projectName: string,
		component: ComponentFileStructure
	) {
		const fullFolderPath = joinFsPath(COMPONENTS_DIR, component.name);
		console.log('deleting for', fullFolderPath);
		const removed = await fileSystem.remove(fullFolderPath, { recursive: true });
		if (removed.error) {
			console.error(removed.error);
		} else {
			activeGame!.decks = activeGame!.decks.filter((x) => x.name !== component.name);
			await goto(resolve(`/games/${projectName}`));
		}
	}
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>Create</Sidebar.GroupLabel>
	<Sidebar.Menu>
		<Sidebar.MenuItem>
			<Sidebar.MenuButton tooltipContent="Rules">
				{#snippet child({ props })}
					<a href={resolve(`/games/${activeGame?.name}/rules`)} {...props}>
						<BookOpenText />
						<span>Rules</span>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
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
							<NewDeckDialog {activeGame} {fileSystem} {onDeckCreated} />
						</Sidebar.MenuSubItem>
						{#each activeGame?.decks ?? [] as deck (deck.name)}
							<Sidebar.MenuSubItem>
								<Sidebar.MenuSubButton>
									{#snippet child({ props })}
										<a
											href={resolve(`/games/${activeGame?.name}/decks/${deck.name}/editor`)}
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
												<span class="sr-only">More for {deck.name}</span>
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
											<LayoutTemplate />
											<span>Layout</span>
										</DropdownMenu.Item>
										{/* @ts-expect-error paths*/ null}
										<DropdownMenu.Item
											onSelect={() => goto(resolve(`${path}/data`))}
											class="flex w-full justify-start gap-2"
										>
											<Table2 />
											<span>Spreadsheet</span>
										</DropdownMenu.Item>
										<RenameDeckDialog projectFolder={fileSystem} {deck} onRenamed={onDeckRenamed}>
											{#snippet trigger({ props })}
												<DropdownMenu.Item
													{...props}
													onSelect={(event) => event.preventDefault()}
													class="flex w-full justify-start gap-2"
												>
													<TextCursorInput />
													<span>Rename</span>
												</DropdownMenu.Item>
											{/snippet}
										</RenameDeckDialog>
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
