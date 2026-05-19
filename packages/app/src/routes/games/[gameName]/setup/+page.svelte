<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Badge } from '$lib/components/ui/badge';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { joinFsPath } from '$lib/components/file-browser/adapters/adapter';
	import { requireParam } from '$lib/utils/assert';
	import {
		ReferenceEditor,
		type ChangeEvent,
		type SelectionChangeEvent
	} from '@svg-table/svgeditor';
	import { Plus, SquareDashedMousePointer, Trash2 } from '@lucide/svelte';
	import { onDestroy, onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { getFileSystemContext } from '../../context';
	import { loadSvgsAndDataForSides } from '../data-loader';
	import { parseCsvFile } from '../csv-helper';
	import { generateSvg, loadSvgTemplate } from '../svg-helpers';
	import {
		createDefaultTableSetup,
		normalizeTableSvg,
		parseTableSetup,
		serializeTableSetup,
		setupToSvg,
		svgToTableSetup,
		SETUP_JSON_PATH,
		SETUP_SVG_PATH,
		tablePresets,
		type SetupPlacement,
		type SetupSlot,
		type TablePresetId,
		type TableSetup
	} from './table-setup';

	type CardEntry = {
		id: string;
		rowId: string;
		deckName: string;
		label: string;
		frontSvg: string | null;
	};

	type DeckEntry = {
		name: string;
		cards: CardEntry[];
	};

	type DragPayload =
		| { kind: 'deck'; deckName: string; label: string }
		| { kind: 'card'; deckName: string; cardId: string; label: string };

	const fileSystem = getFileSystemContext();
	const projectName = $derived(requireParam('gameName'));

	const setupJsonPath = $derived(joinFsPath(projectName, SETUP_JSON_PATH));
	const setupSvgPath = $derived(joinFsPath(projectName, SETUP_SVG_PATH));

	async function loadSetup(): Promise<TableSetup> {
		const read = await fileSystem.readText(setupJsonPath);
		if (read.error) return createDefaultTableSetup();
		try {
			return parseTableSetup(JSON.parse(read.data));
		} catch {
			return createDefaultTableSetup();
		}
	}

	function serializeSvg(svg: SVGSVGElement): string {
		return new XMLSerializer().serializeToString(svg);
	}

	async function loadFallbackCards(deckName: string) {
		try {
			const csv = await fileSystem.readText(
				joinFsPath(projectName, 'system', deckName, 'data.csv')
			);
			if (csv.error) return [];
			const parsed = await parseCsvFile(new File([csv.data], 'data.csv', { type: 'text/csv' }));
			const idIndex = parsed.header.indexOf('id');
			const labelIndex = parsed.header.findIndex((header) => header !== 'id');
			return parsed.data.map((row, index) => {
				const rowId = String(idIndex >= 0 ? row[idIndex] : index + 1);
				const fallback = `${deckName} ${index + 1}`;
				const label = String(labelIndex >= 0 ? row[labelIndex] || fallback : fallback);
				return {
					id: `${deckName}:${rowId}`,
					rowId,
					deckName,
					label,
					frontSvg: null
				};
			});
		} catch {
			return [];
		}
	}

	async function loadDeckLibrary(): Promise<DeckEntry[]> {
		const systemDir = await fileSystem.openDir(joinFsPath(projectName, 'system'));
		if (systemDir.error) return [];
		const entries = await systemDir.data.list();
		if (entries.error) return [];
		const decks = await Promise.all(
			entries.data
				.filter((entry) => entry.kind === 'directory')
				.sort((a, b) => a.name.localeCompare(b.name))
				.map(async (entry) => {
					const front = await systemDir.data.readText(joinFsPath(entry.name, 'front.svg'));
					if (front.error) {
						return {
							name: entry.name,
							cards: await loadFallbackCards(entry.name)
						};
					}
					const frontTemplate = loadSvgTemplate(front.data);
					const { spreadsheetData, imagePaths } = await loadSvgsAndDataForSides(
						projectName,
						entry.name,
						fileSystem,
						[{ template: frontTemplate }],
						true
					);
					const headers = spreadsheetData.cols.map((column) => String(column.title));
					const idIndex = headers.indexOf('id');
					const labelIndex = headers.findIndex((header) => header !== 'id');
					const cards = spreadsheetData.data.map((row, index) => {
						const rowId = String(idIndex >= 0 ? row[idIndex] : index + 1);
						const fallback = `${entry.name} ${index + 1}`;
						const label = String(labelIndex >= 0 ? row[labelIndex] || fallback : fallback);
						const frontSvg = serializeSvg(generateSvg(frontTemplate, headers, row, imagePaths));
						return {
							id: `${entry.name}:${rowId}`,
							rowId,
							deckName: entry.name,
							label,
							frontSvg
						};
					});
					return { name: entry.name, cards };
				})
		);
		return decks;
	}

	async function loadEditorSetup(): Promise<{ setup: TableSetup; svg: string | null }> {
		const jsonSetup = await loadSetup();
		const svgRead = await fileSystem.readText(setupSvgPath);
		if (svgRead.error) return { setup: jsonSetup, svg: null };
		return {
			setup: svgToTableSetup(svgRead.data, jsonSetup),
			svg: svgRead.data
		};
	}

	const fallbackSetup = createDefaultTableSetup();
	let setup = $state(fallbackSetup);
	let decks = $state<DeckEntry[]>([]);
	const cards = $derived(decks.flatMap((deck) => deck.cards));
	let selectedSlotId = $state<string | null>(null);
	let selectedPlacementId = $state<string | null>(null);
	let status = $state('Loading');
	let saveError = $state('');
	let isSaving = $state(false);
	let isLoading = $state(true);
	let addComponentOpen = $state(false);
	let editorSvg = $state(setupToSvg(fallbackSetup));
	let editorKey = $state(0);
	let editorPanel = $state('component');
	let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
	let saveGeneration = 0;

	const selectedSlot = $derived(setup.slots.find((slot) => slot.id === selectedSlotId) ?? null);
	const selectedPlacement = $derived(
		setup.placements.find((placement) => placement.id === selectedPlacementId) ?? null
	);
	const selectedDeckCards = $derived(
		selectedPlacement?.type === 'deck'
			? cards.filter((card) => card.deckName === selectedPlacement.deckName)
			: []
	);
	const config = $derived({
		imgPath: '/svgedit/images/',
		baseUnit: 'px',
		pageBorderSnapping: true,
		showGrid: true,
		gridSnapping: true,
		snappingStep: 20,
		initFill: { color: 'FFFFFF', opacity: 1 },
		initStroke: { color: '000000', opacity: 1, width: 1 },
		text: {
			stroke_width: 0,
			font_size: 28,
			font_family: 'system-ui, sans-serif'
		}
	});

	onMount(() => {
		Promise.all([loadEditorSetup(), loadDeckLibrary()])
			.then(([loadedSetup, loadedDecks]) => {
				setup = loadedSetup.setup;
				decks = loadedDecks;
				selectedSlotId = loadedSetup.setup.slots[0]?.id ?? null;
				selectedPlacementId = null;
				editorSvg = loadedSetup.svg
					? normalizeTableSvg(
							loadedSetup.svg,
							loadedSetup.setup,
							svgAssetsForSetup(loadedSetup.setup, loadedDecks)
						)
					: setupToSvg(loadedSetup.setup, svgAssetsForSetup(loadedSetup.setup, loadedDecks));
				editorKey += 1;
				isLoading = false;
				status = 'Loaded';
			})
			.catch((error) => {
				saveError = error instanceof Error ? error.message : 'Failed to load table setup';
				isLoading = false;
				status = 'Load failed';
			});
	});

	onDestroy(() => {
		if (autosaveTimer) clearTimeout(autosaveTimer);
	});

	function syncFromEditor() {
		setup = svgToTableSetup(editorSvg, setup);
	}

	function cardById(cardId: string, sourceDecks = decks) {
		return sourceDecks.flatMap((deck) => deck.cards).find((card) => card.id === cardId) ?? null;
	}

	function placementCardSvg(placement: SetupPlacement, sourceDecks = decks): string | null {
		if (placement.type === 'card') return cardById(placement.cardId, sourceDecks)?.frontSvg ?? null;
		const deckCards = sourceDecks.find((deck) => deck.name === placement.deckName)?.cards ?? [];
		return deckCards.find((card) => placement.cardIds.includes(card.id))?.frontSvg ?? null;
	}

	function svgAssetsForSetup(targetSetup: TableSetup, sourceDecks = decks) {
		const placementCardSvgs = new SvelteMap<string, string>();
		for (const placement of targetSetup.placements) {
			const cardSvg = placementCardSvg(placement, sourceDecks);
			if (cardSvg) placementCardSvgs.set(placement.id, cardSvg);
		}
		return { placementCardSvgs };
	}

	function renderSetupSvg(nextSetup: TableSetup, baseSvg: string | null) {
		const assets = svgAssetsForSetup(nextSetup);
		return baseSvg ? normalizeTableSvg(baseSvg, nextSetup, assets) : setupToSvg(nextSetup, assets);
	}

	function applySetup(nextSetup: TableSetup, options: { preserveSvg?: boolean } = {}) {
		setup = nextSetup;
		editorSvg = renderSetupSvg(nextSetup, options.preserveSvg === false ? null : editorSvg);
		editorKey += 1;
		scheduleAutosave();
	}

	function setPreset(presetId: TablePresetId) {
		const preset = tablePresets.find((candidate) => candidate.id === presetId);
		if (!preset) return;
		applySetup(
			{
				...setup,
				table: {
					presetId,
					width: preset.width,
					height: preset.height
				}
			},
			{ preserveSvg: false }
		);
	}

	function updateTableSize(key: 'width' | 'height', value: number) {
		applySetup(
			{
				...setup,
				table: {
					...setup.table,
					presetId: 'custom',
					[key]: Math.max(100, value)
				}
			},
			{ preserveSvg: false }
		);
	}

	function addPlacement(payload: DragPayload, x: number, y: number) {
		syncFromEditor();
		const placement: SetupPlacement =
			payload.kind === 'deck'
				? {
						id: crypto.randomUUID(),
						type: 'deck',
						deckName: payload.deckName,
						cardIds: cards
							.filter((card) => card.deckName === payload.deckName)
							.map((card) => card.id),
						x,
						y,
						rotation: 0,
						label: payload.label
					}
				: {
						id: crypto.randomUUID(),
						type: 'card',
						deckName: payload.deckName,
						cardId: payload.cardId,
						x,
						y,
						rotation: 0,
						label: payload.label
					};
		applySetup({
			...setup,
			placements: [...setup.placements, placement]
		});
		selectedPlacementId = placement.id;
		selectedSlotId = null;
		editorPanel = 'component';
	}

	function quickPlace(payload: DragPayload) {
		const offset = setup.placements.length * 36;
		addPlacement(payload, 160 + offset, 160 + offset);
	}

	function addComponent(payload: DragPayload) {
		quickPlace(payload);
		addComponentOpen = false;
	}

	function addSlot() {
		syncFromEditor();
		const slot: SetupSlot = {
			id: crypto.randomUUID(),
			label: `Slot ${setup.slots.length + 1}`,
			x: Math.round(setup.table.width / 2 - 120),
			y: Math.round(setup.table.height / 2 - 160),
			width: 240,
			height: 320,
			acceptedDeckNames: [],
			acceptedCardIds: []
		};
		applySetup({
			...setup,
			slots: [...setup.slots, slot]
		});
		selectedSlotId = slot.id;
		selectedPlacementId = null;
		editorPanel = 'component';
	}

	function updateSlot(slotId: string, patch: Partial<SetupSlot>) {
		applySetup({
			...setup,
			slots: setup.slots.map((slot) => (slot.id === slotId ? { ...slot, ...patch } : slot))
		});
	}

	function updatePlacement(placementId: string, patch: Partial<SetupPlacement>) {
		applySetup({
			...setup,
			placements: setup.placements.map((placement) =>
				placement.id === placementId ? ({ ...placement, ...patch } as SetupPlacement) : placement
			)
		});
	}

	function togglePlacementCardValue(placementId: string, cardId: string, checked: boolean) {
		const placement = setup.placements.find((candidate) => candidate.id === placementId);
		if (!placement || placement.type !== 'deck') return;
		const values = checked
			? [...placement.cardIds, cardId]
			: placement.cardIds.filter((candidate) => candidate !== cardId);
		const selectedCardIds = new Set(values);
		const deckCardIds = cards
			.filter((card) => card.deckName === placement.deckName && selectedCardIds.has(card.id))
			.map((card) => card.id);
		applySetup({
			...setup,
			placements: setup.placements.map((candidate) =>
				candidate.id === placementId && candidate.type === 'deck'
					? {
							...candidate,
							cardIds: deckCardIds
						}
					: candidate
			)
		});
	}

	function toggleSlotValue(
		slotId: string,
		key: 'acceptedDeckNames' | 'acceptedCardIds',
		value: string,
		checked: boolean
	) {
		const slot = setup.slots.find((candidate) => candidate.id === slotId);
		if (!slot) return;
		const values = checked
			? [...slot[key], value]
			: slot[key].filter((candidate) => candidate !== value);
		updateSlot(slotId, {
			[key]: values
				.filter((candidate, index) => values.indexOf(candidate) === index)
				.sort((a, b) => a.localeCompare(b))
		});
	}

	function removeSlot(slotId: string) {
		applySetup({
			...setup,
			slots: setup.slots.filter((slot) => slot.id !== slotId)
		});
		if (selectedSlotId === slotId) selectedSlotId = setup.slots[0]?.id ?? null;
	}

	function removePlacement(placementId: string) {
		applySetup({
			...setup,
			placements: setup.placements.filter((placement) => placement.id !== placementId)
		});
		if (selectedPlacementId === placementId) selectedPlacementId = null;
	}

	function handleEditorChange(event: CustomEvent<ChangeEvent>) {
		if (event.detail.source !== 'user') return;
		editorSvg = event.detail.svg;
		setup = svgToTableSetup(editorSvg, setup);
		scheduleAutosave();
	}

	function setupElementFromSelection(event: CustomEvent<SelectionChangeEvent>) {
		const element = event.detail.selectedElements[0];
		const setupElement = element?.closest?.('[data-digitable-kind]');
		if (!setupElement) return null;
		return {
			id: setupElement.getAttribute('id'),
			kind: setupElement.getAttribute('data-digitable-kind')
		};
	}

	function handleEditorSelection(event: CustomEvent<SelectionChangeEvent>) {
		const selected = setupElementFromSelection(event);
		if (!selected?.id) return;
		if (selected.kind === 'slot') {
			selectedSlotId = selected.id;
			selectedPlacementId = null;
			editorPanel = 'component';
			return;
		}
		if (selected.kind === 'placement') {
			selectedPlacementId = selected.id;
			selectedSlotId = null;
			editorPanel = 'component';
		}
	}

	function scheduleAutosave() {
		if (isLoading) return;
		saveGeneration += 1;
		status = 'Unsaved changes';
		if (autosaveTimer) clearTimeout(autosaveTimer);
		autosaveTimer = setTimeout(() => {
			autosaveTimer = null;
			void saveSetup(saveGeneration);
		}, 400);
	}

	async function saveSetup(generation = saveGeneration) {
		if (isLoading) return;
		isSaving = true;
		saveError = '';
		status = 'Autosaving';
		const syncedSetup = svgToTableSetup(editorSvg, setup);
		const syncedSvg = normalizeTableSvg(editorSvg, syncedSetup, svgAssetsForSetup(syncedSetup));
		setup = syncedSetup;
		editorSvg = syncedSvg;
		const setupDir = await fileSystem.ensureDir(joinFsPath(projectName, 'setup'));
		if (setupDir.error) {
			saveError = setupDir.error.message;
			status = 'Autosave failed';
			isSaving = false;
			return;
		}
		const jsonWrite = await setupDir.data.write('table.json', serializeTableSetup(syncedSetup));
		if (jsonWrite.error) {
			saveError = jsonWrite.error.message;
			status = 'Autosave failed';
			isSaving = false;
			return;
		}
		const svgWrite = await setupDir.data.write('table.svg', syncedSvg);
		if (svgWrite.error) {
			saveError = svgWrite.error.message;
			status = 'Autosave failed';
			isSaving = false;
			return;
		}
		if (generation === saveGeneration) {
			status = 'Autosaved';
		}
		isSaving = false;
	}
</script>

<svelte:head>
	<title>Setup {projectName}</title>
</svelte:head>

<main class="flex h-svh min-h-0 flex-col gap-3 overflow-hidden p-4">
	{@render setupTableControls()}
	<div
		role="region"
		aria-label="Table SVG editor"
		class="min-h-0 flex-1 overflow-hidden rounded-md border bg-emerald-950/10"
	>
		{#key editorKey}
			<ReferenceEditor
				value={editorSvg}
				{config}
				bind:activePanel={editorPanel}
				assetBasePath="/svgedit/images/"
				initialZoom="fit"
				toolbarActions={setupToolbarAction}
				componentPanel={setupComponentPanel}
				on:change={handleEditorChange}
				on:selectionchange={handleEditorSelection}
			/>
		{/key}
	</div>
</main>

{#snippet setupTableControls()}
	<section class="bg-background rounded-md border px-4 py-3 text-sm">
		<div class="flex flex-wrap items-end gap-3">
			<div class="mr-auto min-w-40">
				<h2 class="font-semibold">Table setup</h2>
				<p class="text-muted-foreground text-xs">{projectName}</p>
			</div>
			<div class="grid gap-1">
				<label class="font-medium" for="table-preset">Preset</label>
				<select
					id="table-preset"
					class="border-input bg-background h-9 w-44 rounded-md border px-3"
					value={setup.table.presetId}
					disabled={isLoading}
					onchange={(event) =>
						setPreset((event.currentTarget as HTMLSelectElement).value as TablePresetId)}
				>
					{#each tablePresets as preset (preset.id)}
						<option value={preset.id}>{preset.name}</option>
					{/each}
				</select>
			</div>
			<label class="grid gap-1 font-medium">
				Width
				<Input
					class="w-28"
					type="number"
					min="100"
					value={setup.table.width}
					disabled={isLoading}
					oninput={(event) => updateTableSize('width', Number(event.currentTarget.value))}
				/>
			</label>
			<label class="grid gap-1 font-medium">
				Height
				<Input
					class="w-28"
					type="number"
					min="100"
					value={setup.table.height}
					disabled={isLoading}
					oninput={(event) => updateTableSize('height', Number(event.currentTarget.value))}
				/>
			</label>
		</div>
		{#if saveError}
			<p class="text-destructive mt-2 text-xs" role="alert">{saveError}</p>
		{/if}
	</section>
{/snippet}

{#snippet setupComponentPanel()}
	<div class="space-y-4 text-sm">
		{#if selectedSlot}
			<section class="space-y-3">
				<div class="flex items-center justify-between gap-2">
					<h2 class="font-semibold">Slot</h2>
					<Badge variant="secondary">rules</Badge>
				</div>
				<label class="grid gap-1 font-medium">
					Label
					<Input
						aria-label="Slot label"
						value={selectedSlot.label}
						oninput={(event) => updateSlot(selectedSlot.id, { label: event.currentTarget.value })}
					/>
				</label>
				<div class="space-y-2">
					<h3 class="font-medium">Allowed decks</h3>
					{#each decks as deck (deck.name)}
						<label class="flex items-center gap-2">
							<Checkbox
								checked={selectedSlot.acceptedDeckNames.includes(deck.name)}
								onCheckedChange={(checked) =>
									toggleSlotValue(
										selectedSlot.id,
										'acceptedDeckNames',
										deck.name,
										checked === true
									)}
							/>
							<span>{deck.name}</span>
						</label>
					{/each}
				</div>
				<div class="space-y-2">
					<h3 class="font-medium">Allowed cards</h3>
					<div class="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
						{#each cards as card (card.id)}
							<label class="flex items-center gap-2 text-xs">
								<Checkbox
									checked={selectedSlot.acceptedCardIds.includes(card.id)}
									onCheckedChange={(checked) =>
										toggleSlotValue(selectedSlot.id, 'acceptedCardIds', card.id, checked === true)}
								/>
								<span class="truncate">{card.label}</span>
								<span class="text-muted-foreground">{card.deckName}</span>
							</label>
						{/each}
					</div>
				</div>
				<Button variant="destructive" class="w-full" onclick={() => removeSlot(selectedSlot.id)}>
					<Trash2 class="size-4" />
					Delete slot
				</Button>
			</section>
		{:else if selectedPlacement}
			<section class="space-y-3">
				<div class="flex items-center justify-between gap-2">
					<h2 class="font-semibold">Component</h2>
					<Badge variant="secondary">{selectedPlacement.type}</Badge>
				</div>
				<label class="grid gap-1 font-medium">
					Label
					<Input
						aria-label="Component label"
						value={selectedPlacement.label}
						oninput={(event) =>
							updatePlacement(selectedPlacement.id, { label: event.currentTarget.value })}
					/>
				</label>
				<p class="text-muted-foreground text-xs">{selectedPlacement.deckName}</p>
				{#if selectedPlacement.type === 'deck'}
					<div class="space-y-2">
						<div class="flex items-center justify-between gap-2">
							<h3 class="font-medium">Cards in deck</h3>
							<Badge variant="secondary">{selectedPlacement.cardIds.length}</Badge>
						</div>
						<div class="max-h-80 space-y-1 overflow-y-auto rounded-md border p-2">
							{#each selectedDeckCards as card (card.id)}
								<label class="flex items-center gap-2 text-xs">
									<Checkbox
										checked={selectedPlacement.cardIds.includes(card.id)}
										onCheckedChange={(checked) =>
											togglePlacementCardValue(selectedPlacement.id, card.id, checked === true)}
									/>
									<span class="truncate">{card.label}</span>
									<span class="text-muted-foreground">{card.rowId}</span>
								</label>
							{/each}
						</div>
					</div>
				{:else}
					<p class="text-muted-foreground text-xs">{selectedPlacement.cardId}</p>
				{/if}
				<Button
					variant="destructive"
					class="w-full"
					onclick={() => removePlacement(selectedPlacement.id)}
				>
					<Trash2 class="size-4" />
					Delete component
				</Button>
			</section>
		{:else}
			<p class="text-muted-foreground">Select a setup component or slot to edit its game rules.</p>
		{/if}
	</div>
{/snippet}

{#snippet setupToolbarAction()}
	<Dialog.Root bind:open={addComponentOpen}>
		<Dialog.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					size="sm"
					variant="ghost"
					class="rounded-lg px-3 text-xs font-semibold tracking-wide uppercase"
					title="Add component"
					disabled={isLoading}
				>
					<Plus class="size-4" />
					Add component
				</Button>
			{/snippet}
		</Dialog.Trigger>
		<Dialog.Content class="max-h-[80vh] overflow-hidden sm:max-w-xl">
			<Dialog.Header>
				<Dialog.Title>Add component</Dialog.Title>
				<Dialog.Description
					>Select a deck or individual card to place on the table.</Dialog.Description
				>
			</Dialog.Header>
			<div class="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
				{#each decks as deck (deck.name)}
					<div class="rounded-md border p-2">
						<Button
							type="button"
							variant="ghost"
							class="flex w-full justify-between"
							onclick={() => addComponent({ kind: 'deck', deckName: deck.name, label: deck.name })}
						>
							<span>{deck.name}</span>
							<span class="text-muted-foreground text-xs">deck</span>
						</Button>
						<div class="mt-2 max-h-40 space-y-1 overflow-y-auto">
							{#each deck.cards as card (card.id)}
								<Button
									type="button"
									variant="ghost"
									class="text-muted-foreground flex h-8 w-full justify-between px-2 text-xs"
									onclick={() =>
										addComponent({
											kind: 'card',
											deckName: deck.name,
											cardId: card.id,
											label: card.label
										})}
								>
									<span class="truncate">{card.label}</span>
									<span>{card.rowId}</span>
								</Button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</Dialog.Content>
	</Dialog.Root>
	<Button
		size="sm"
		variant="ghost"
		class="rounded-lg px-3 text-xs font-semibold tracking-wide uppercase"
		title="Add table slot"
		disabled={isLoading}
		onclick={addSlot}
	>
		<SquareDashedMousePointer class="size-4" />
		Add slot
	</Button>
	<span class="text-muted-foreground px-2 text-xs" role="status">
		{isSaving ? 'Autosaving' : status}
	</span>
{/snippet}
