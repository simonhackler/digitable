<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Badge } from '$lib/components/ui/badge';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { joinFsPath } from '$lib/components/file-browser/adapters/adapter';
	import { requireParam } from '$lib/utils/assert';
	import {
		createEditorController,
		ReferenceEditor,
		ReferenceEditorToolbar,
		type ChangeEvent,
		type SelectionChangeEvent,
		type SvgEditorApi
	} from '@svg-table/svgeditor';
	import { Maximize2, Plus, SquareDashedMousePointer, Trash2 } from '@lucide/svelte';
	import { onDestroy, onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { COMPONENTS_DIR } from '$lib/workspace/project-layout';
	import { getFileSystemContext } from '../../context';
	import { loadSvgsAndDataForSides } from '../data-loader';
	import { generateSvg, loadSvgTemplate } from '../svg-helpers';
	import GameTopBar from '../../game-top-bar.svelte';
	import {
		createHorizontalFlexSlotLayout,
		createGridSlotLayout,
		createDefaultTable,
		normalizeTableSlot,
		resolveTableSlotSize,
		placementToSvgElementJson,
		slotToSvgElementJson,
		snapPlacementToGrid,
		svgMarkupLogicalSize,
		svgToTable,
		TABLE_SVG_PATH,
		tablePresets,
		type TablePlacement,
		type TableSlotContent,
		type TableSlotLayout,
		type TableSvgAssets,
		type TableSvgElementJson,
		type TableSlot,
		type TablePresetId,
		type Table
	} from './table';

	type CardEntry = {
		id: string;
		rowId: string;
		deckName: string;
		label: string;
		frontSvg: string;
		size: { width: number; height: number } | null;
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

	const tableSvgPath = $derived(joinFsPath(projectName, TABLE_SVG_PATH));

	function sortedUniqueStrings(values: string[]) {
		return [...new Set(values)].sort((a, b) => a.localeCompare(b));
	}

	type TableInfo = Table['table'];

	function serializeSvg(svg: Element): string {
		return new XMLSerializer().serializeToString(svg);
	}

	function emptyTableSvg(table: TableInfo) {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${table.width}" height="${table.height}" viewBox="0 0 ${table.width} ${table.height}" role="img" aria-label="Digitable table setup" data-digitable-table="true" data-preset-id="${table.presetId}"></svg>`;
	}

	function applyTableRootMetadata(root: Element, table: TableInfo) {
		root.setAttribute('role', 'img');
		root.setAttribute('aria-label', 'Digitable table setup');
		root.setAttribute('data-digitable-table', 'true');
		root.setAttribute('data-preset-id', table.presetId);
	}

	function applyTableRootInfo(root: Element, table: TableInfo) {
		root.setAttribute('width', String(table.width));
		root.setAttribute('height', String(table.height));
		root.setAttribute('viewBox', `0 0 ${table.width} ${table.height}`);
		applyTableRootMetadata(root, table);
	}

	function updateSerializedTableRoot(svg: string, table: TableInfo) {
		const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
		const root = doc.documentElement;
		if (!root || root.tagName.toLowerCase() !== 'svg') return emptyTableSvg(table);
		applyTableRootInfo(root, table);
		return serializeSvg(root);
	}

	function stringifyAttributes(attributes: Record<string, string | number | null>) {
		return Object.fromEntries(
			Object.entries(attributes).map(([key, value]) => [key, value === null ? null : String(value)])
		);
	}

	async function loadDeckEntry(deckName: string, frontSvgText: string): Promise<DeckEntry> {
		const frontTemplate = loadSvgTemplate(frontSvgText);
		const loadedSvgsAndData = await loadSvgsAndDataForSides(
			projectName,
			deckName,
			fileSystem,
			[{ template: frontTemplate }],
			true
		);
		if (loadedSvgsAndData.error) throw new Error(loadedSvgsAndData.error.message);
		const { spreadsheetData, imagePaths } = loadedSvgsAndData.data;
		const headers = spreadsheetData.cols.map((column) => String(column.title));
		const idIndex = headers.indexOf('id');
		const labelIndex = headers.findIndex((header) => header !== 'id');
		if (idIndex < 0) {
			throw new Error(`Component "${deckName}" is missing an id column.`);
		}
		const cards = spreadsheetData.data.map((row, index) => {
			const rowId = String(row[idIndex] ?? '').trim();
			if (!rowId) {
				throw new Error(`Component "${deckName}" has an empty id in row ${index + 1}.`);
			}
			const label = String(labelIndex >= 0 ? row[labelIndex] : '');
			const frontSvg = serializeSvg(generateSvg(frontTemplate, headers, row, imagePaths));
			return {
				id: `${deckName}:${rowId}`,
				rowId,
				deckName,
				label,
				frontSvg,
				size: svgMarkupLogicalSize(frontSvg)
			};
		});
		return { name: deckName, cards };
	}

	async function loadDeckLibrary(): Promise<DeckEntry[]> {
		const componentsDir = await fileSystem.openDir(joinFsPath(projectName, COMPONENTS_DIR));
		if (componentsDir.error) throw new Error(componentsDir.error.message);
		const entries = await componentsDir.data.list();
		if (entries.error) throw new Error(entries.error.message);
		const decks = await Promise.all(
			entries.data
				.filter((entry) => entry.kind === 'directory')
				.sort((a, b) => a.name.localeCompare(b.name))
				.map(async (entry) => {
					const front = await fileSystem.readText(
						joinFsPath(projectName, COMPONENTS_DIR, entry.name, 'front.svg')
					);
					if (front.error) {
						if (front.error.name === 'NotFoundError') return null;
						throw new Error(front.error.message);
					}
					return loadDeckEntry(entry.name, front.data);
				})
		);
		return decks.filter((deck) => deck !== null);
	}

	async function loadEditorSvg(): Promise<string> {
		const svgRead = await fileSystem.readText(tableSvgPath);
		if (svgRead.error) {
			return emptyTableSvg(createDefaultTable().table);
		}
		return svgRead.data;
	}

	const fallbackTable = createDefaultTable();
	let decks = $state<DeckEntry[]>([]);
	let tableInfo = $state<TableInfo>(fallbackTable.table);
	const cards = $derived(decks.flatMap((deck) => deck.cards));
	let selectedSlot = $state<TableSlot | null>(null);
	let selectedPlacement = $state<TablePlacement | null>(null);
	let status = $state('Loading');
	let saveError = $state('');
	let isSaving = $state(false);
	let isLoading = $state(true);
	let addComponentOpen = $state(false);
	let addSlotContentOpen = $state(false);
	let resizeTableOpen = $state(false);
	let resizeTablePresetId = $state<TablePresetId>(fallbackTable.table.presetId);
	let resizeTableWidth = $state<number | undefined>(fallbackTable.table.width);
	let resizeTableHeight = $state<number | undefined>(fallbackTable.table.height);
	let resizeTableError = $state('');
	let editorSvg = $state(emptyTableSvg(fallbackTable.table));
	let editorApi = $state<SvgEditorApi | null>(null);
	let editorPanel = $state('component');
	let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
	let autosaveIdleHandle: number | null = null;
	let saveGeneration = 0;
	let saveInFlight = false;
	let pendingSaveGeneration: number | null = null;
	const editorController = createEditorController();

	type WindowWithIdleCallback = Window & {
		requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
		cancelIdleCallback?: (handle: number) => void;
	};

	const AUTOSAVE_DELAY_MS = 800;
	const AUTOSAVE_IDLE_TIMEOUT_MS = 2000;
	const MIN_TABLE_DIMENSION = 100;
	const selectedSlotLayout = $derived<TableSlotLayout>(selectedSlot?.layout ?? { mode: 'free' });
	const selectedSlotContents = $derived(selectedSlot?.contents ?? []);
	const selectedTableElementId = $derived(selectedPlacement?.id ?? selectedSlot?.id ?? null);
	const selectedDeckCards = $derived.by(() => {
		const placement = selectedPlacement;
		return placement?.type === 'deck'
			? cards.filter((card) => card.deckName === placement.deckName)
			: [];
	});
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
		Promise.all([loadEditorSvg(), loadDeckLibrary()])
			.then(([loadedSvg, loadedDecks]) => {
				decks = loadedDecks;
				const loadedTable = tableViewFromSvg(loadedSvg);
				tableInfo = loadedTable.table;
				editorSvg = loadedSvg;
				selectSlot(loadedTable.slots[0] ?? null);
				isLoading = false;
				status = 'Loaded';
			})
			.catch((error) => {
				console.error('Failed to load setup table data', error);
				saveError = error instanceof Error ? error.message : 'Failed to load table';
				isLoading = false;
				status = 'Load failed';
			});
	});

	onDestroy(() => {
		cancelQueuedAutosave();
	});

	function cancelQueuedAutosave() {
		if (autosaveTimer) {
			clearTimeout(autosaveTimer);
			autosaveTimer = null;
		}
		if (autosaveIdleHandle !== null && typeof window !== 'undefined') {
			const browser = window as WindowWithIdleCallback;
			if (browser.cancelIdleCallback) {
				browser.cancelIdleCallback(autosaveIdleHandle);
			} else {
				clearTimeout(autosaveIdleHandle);
			}
			autosaveIdleHandle = null;
		}
	}

	function currentEditorSvg() {
		return editorApi?.getSvg() ?? editorSvg;
	}

	function currentEditorSvgForSave() {
		return updateSerializedTableRoot(currentEditorSvg(), tableInfo);
	}

	function currentEditorSvgElement() {
		return editorApi?._unsafe?.rawCanvas()?.getSvgContent?.() ?? null;
	}

	function fallbackTableWithRoot(tableInfo: TableInfo = fallbackTable.table): Table {
		return {
			version: 1,
			table: { ...tableInfo },
			placements: [],
			slots: []
		};
	}

	function tableViewFromSvg(svg: string) {
		if (typeof DOMParser === 'undefined') return fallbackTableWithRoot();
		return svgToTable(svg, fallbackTableWithRoot());
	}

	function currentEditorTable() {
		if (typeof DOMParser === 'undefined') return fallbackTableWithRoot(tableInfo);
		return svgToTable(currentEditorSvg(), fallbackTableWithRoot(tableInfo));
	}

	function selectSlot(slot: TableSlot | null) {
		selectedSlot = slot;
		selectedPlacement = null;
	}

	function selectPlacement(placement: TablePlacement | null) {
		selectedPlacement = placement;
		selectedSlot = null;
	}

	function cardById(cardId: string, sourceDecks = decks) {
		return sourceDecks.flatMap((deck) => deck.cards).find((card) => card.id === cardId) ?? null;
	}

	function deckByName(deckName: string, sourceDecks = decks) {
		return sourceDecks.find((deck) => deck.name === deckName) ?? null;
	}

	function placementCardSvg(placement: TablePlacement, sourceDecks = decks): string | null {
		if (placement.type === 'card') return cardById(placement.cardId, sourceDecks)?.frontSvg ?? null;
		return deckByName(placement.deckName, sourceDecks)?.cards[0]?.frontSvg ?? null;
	}

	function cardSvgSize(cardSvg: string | null) {
		return svgMarkupLogicalSize(cardSvg) ?? undefined;
	}

	function payloadCardSize(payload: DragPayload) {
		if (payload.kind === 'card') {
			const card = cardById(payload.cardId);
			return card?.size ?? cardSvgSize(card?.frontSvg ?? null);
		}
		const card = deckByName(payload.deckName)?.cards[0];
		return card?.size ?? cardSvgSize(card?.frontSvg ?? null);
	}

	function placementCardSize(placement: TablePlacement, sourceDecks = decks) {
		if (placement.type === 'card') {
			const card = cardById(placement.cardId, sourceDecks);
			return card?.size ?? cardSvgSize(card?.frontSvg ?? null);
		}
		const card = deckByName(placement.deckName, sourceDecks)?.cards[0];
		return card?.size ?? cardSvgSize(card?.frontSvg ?? null);
	}

	function svgAssetsForSlot(slot: TableSlot, sourceDecks = decks): TableSvgAssets {
		const cardSvgs = new SvelteMap<string, string>();
		const cardSizes = new SvelteMap<string, { width: number; height: number }>();
		const deckTopCardIds = new SvelteMap<string, string>();
		const deckCardIds = new SvelteMap<string, string[]>();
		const deckNames = new Set(slot.acceptedDeckNames);
		const previewDeckNames = new Set(
			(slot.contents ?? [])
				.filter((content) => content.type === 'deck')
				.map((content) => content.deckName)
		);
		const addCard = (card: CardEntry | null, includeSvg: boolean) => {
			if (!card) return;
			if (card.size) cardSizes.set(card.id, card.size);
			if (includeSvg) cardSvgs.set(card.id, card.frontSvg);
		};

		for (const content of slot.contents ?? []) {
			if (content.type === 'deck') {
				deckNames.add(content.deckName);
				continue;
			}
			const card = cardById(content.cardId, sourceDecks);
			if (card) {
				deckNames.add(card.deckName);
				addCard(card, true);
			}
		}

		for (const cardId of slot.acceptedCardIds) {
			const card = cardById(cardId, sourceDecks);
			if (card) {
				deckNames.add(card.deckName);
				addCard(card, false);
			}
		}

		for (const deck of sourceDecks) {
			if (!deckNames.has(deck.name)) continue;
			const firstCard = deck.cards[0];
			if (firstCard) {
				deckTopCardIds.set(deck.name, firstCard.id);
				addCard(firstCard, previewDeckNames.has(deck.name));
			}
			deckCardIds.set(
				deck.name,
				deck.cards.map((card) => card.id)
			);
			for (const card of deck.cards) {
				addCard(card, false);
			}
		}

		return { cardSvgs, cardSizes, deckTopCardIds, deckCardIds };
	}

	function svgAssetsForPlacement(placement: TablePlacement, sourceDecks = decks): TableSvgAssets {
		const placementCardSvgs = new SvelteMap<string, string>();
		const placementCardSizes = new SvelteMap<string, { width: number; height: number }>();
		const cardSvg = placementCardSvg(placement, sourceDecks);
		if (cardSvg) {
			placementCardSvgs.set(placement.id, cardSvg);
			const size = placementCardSize(placement, sourceDecks) ?? svgMarkupLogicalSize(cardSvg);
			if (size) placementCardSizes.set(placement.id, size);
		}
		return { placementCardSvgs, placementCardSizes };
	}

	function insertTableElement(elementId: string, element: TableSvgElementJson): boolean {
		const inserted =
			editorApi?.insertSvgElement(element, {
				selectId: elementId,
				historyLabel: 'Add table element'
			}) ?? null;
		if (!inserted) return false;
		scheduleAutosave();
		return true;
	}

	function withCurrentTransform(elementId: string, element: TableSvgElementJson) {
		const transform = editorApi?.getElementById(elementId)?.getAttribute('transform');
		if (!transform) return element;
		return {
			...element,
			attr: {
				...(element.attr ?? {}),
				transform
			}
		};
	}

	function updateTableElement(elementId: string, element: TableSvgElementJson): boolean {
		const updated =
			editorApi?.updateSvgElement(elementId, element, {
				select: true,
				historyLabel: 'Update table element'
			}) ?? false;
		if (!updated) return false;
		scheduleAutosave();
		return true;
	}

	function updateTableElementAttributes(
		elementId: string,
		attributes: Record<string, string | number | null>,
		historyLabel: string
	): boolean {
		const stringAttributes = stringifyAttributes(attributes);
		const updated =
			editorApi?.updateElementAttributes(elementId, stringAttributes, {
				select: true,
				historyLabel
			}) ?? false;
		if (!updated) return false;
		scheduleAutosave();
		return true;
	}

	function removeTableElement(elementId: string) {
		if (!editorApi?.removeElementById(elementId, { historyLabel: 'Remove table element' })) return;
		scheduleAutosave();
	}

	type ResizeTableDimensionResult = { value: number } | { error: string };

	function parseResizeTableDimension(
		label: 'Width' | 'Height',
		value: number | undefined
	): ResizeTableDimensionResult {
		if (value === undefined || !Number.isFinite(value) || value < MIN_TABLE_DIMENSION) {
			return { error: `${label} must be at least ${MIN_TABLE_DIMENSION}.` };
		}
		return { value: Math.round(value) };
	}

	function openResizeTableDialog() {
		resizeTablePresetId = tableInfo.presetId;
		resizeTableWidth = tableInfo.width;
		resizeTableHeight = tableInfo.height;
		resizeTableError = '';
		resizeTableOpen = true;
	}

	function setResizeTablePreset(presetId: TablePresetId) {
		const preset = tablePresets.find((candidate) => candidate.id === presetId);
		if (!preset) return;
		resizeTablePresetId = presetId;
		resizeTableWidth = preset.width;
		resizeTableHeight = preset.height;
		resizeTableError = '';
	}

	function resizeTablePresetForDimensions(presetId: TablePresetId, width: number, height: number) {
		const preset = tablePresets.find((candidate) => candidate.id === presetId);
		return preset?.width === width && preset.height === height ? presetId : 'custom';
	}

	function resizeTable(table: TableInfo) {
		if (!editorApi?.setResolution(table.width, table.height)) return;
		tableInfo = table;
		const root = currentEditorSvgElement();
		if (root) applyTableRootMetadata(root, table);
		scheduleAutosave();
	}

	function applyResizeTable() {
		const width = parseResizeTableDimension('Width', resizeTableWidth);
		if ('error' in width) {
			resizeTableError = width.error;
			return;
		}
		const height = parseResizeTableDimension('Height', resizeTableHeight);
		if ('error' in height) {
			resizeTableError = height.error;
			return;
		}
		resizeTable({
			width: width.value,
			height: height.value,
			presetId: resizeTablePresetForDimensions(resizeTablePresetId, width.value, height.value)
		});
		resizeTableError = '';
		resizeTableOpen = false;
	}

	function addPlacement(payload: DragPayload, x: number, y: number) {
		const placementInput =
			payload.kind === 'deck'
				? {
						id: crypto.randomUUID(),
						type: 'deck' as const,
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
						type: 'card' as const,
						deckName: payload.deckName,
						cardId: payload.cardId,
						x,
						y,
						rotation: 0,
						label: payload.label
					};
		const placement = snapPlacementToGrid(placementInput, payloadCardSize(payload));
		if (
			!insertTableElement(
				placement.id,
				placementToSvgElementJson(placement, svgAssetsForPlacement(placement))
			)
		) {
			return;
		}
		selectPlacement(placement);
		editorPanel = 'component';
	}

	function quickPlace(payload: DragPayload) {
		const offset = currentEditorTable().placements.length * 36;
		addPlacement(payload, 160 + offset, 160 + offset);
	}

	function addComponent(payload: DragPayload) {
		quickPlace(payload);
		addComponentOpen = false;
	}

	function addSlot() {
		const currentTable = currentEditorTable();
		const table = currentTable.table;
		const slot: TableSlot = {
			id: crypto.randomUUID(),
			label: `Slot ${currentTable.slots.length + 1}`,
			x: Math.round(table.width / 2 - 120),
			y: Math.round(table.height / 2 - 160),
			rotation: 0,
			width: 240,
			height: 320,
			acceptedDeckNames: [],
			acceptedCardIds: [],
			layout: { mode: 'free' },
			contents: []
		};
		if (!insertTableElement(slot.id, slotToSvgElementJson(slot, svgAssetsForSlot(slot)))) return;
		selectSlot(slot);
		editorPanel = 'component';
	}

	function updateSlot(slotId: string, patch: Partial<TableSlot>) {
		if (!selectedSlot || selectedSlot.id !== slotId) return;
		const candidate = normalizeTableSlot({ ...selectedSlot, ...patch });
		const assets = svgAssetsForSlot(candidate);
		const nextSlot = resolveTableSlotSize(candidate, assets);
		if (
			!updateTableElement(
				slotId,
				withCurrentTransform(slotId, slotToSvgElementJson(nextSlot, assets))
			)
		) {
			return;
		}
		selectSlot(nextSlot);
	}

	function updateSlotRules(slotId: string, patch: Partial<TableSlot>) {
		if (!selectedSlot || selectedSlot.id !== slotId) return;
		const next = normalizeTableSlot({ ...selectedSlot, ...patch });
		if (
			!updateTableElementAttributes(
				slotId,
				{
					'data-accepted-deck-names': JSON.stringify(sortedUniqueStrings(next.acceptedDeckNames)),
					'data-accepted-card-ids': JSON.stringify(sortedUniqueStrings(next.acceptedCardIds))
				},
				'Update slot rules'
			)
		) {
			return;
		}
		selectSlot(next);
	}

	function slotContentKey(content: TableSlotContent) {
		return content.type === 'deck' ? `deck:${content.deckName}` : `card:${content.cardId}`;
	}

	function slotContentLabel(content: TableSlotContent) {
		if (content.type === 'deck') return content.deckName;
		return cards.find((card) => card.id === content.cardId)?.label ?? content.cardId;
	}

	function slotHasContent(slot: TableSlot, content: TableSlotContent) {
		const key = slotContentKey(content);
		return (slot.contents ?? []).some((candidate) => slotContentKey(candidate) === key);
	}

	function slotCanAddContent(slot: TableSlot) {
		const capacity = slotContentCapacity(slot.layout ?? { mode: 'free' });
		return capacity > 0 && (slot.contents ?? []).length < capacity;
	}

	function slotContentCapacity(layout: TableSlotLayout) {
		if (layout.mode === 'horizontal-flex') return layout.visibleCount;
		if (layout.mode === 'grid') return layout.rows * layout.columns;
		return 0;
	}

	function setSlotLayoutMode(slotId: string, mode: TableSlotLayout['mode']) {
		const current = selectedSlot?.id === slotId ? selectedSlot : null;
		if (!current) return;
		if (mode === 'horizontal-flex') {
			const layout =
				current.layout?.mode === 'horizontal-flex'
					? current.layout
					: createHorizontalFlexSlotLayout();
			updateSlot(slotId, {
				layout,
				contents: (current.contents ?? []).slice(0, layout.visibleCount)
			});
			return;
		}
		if (mode === 'grid') {
			const layout = current.layout?.mode === 'grid' ? current.layout : createGridSlotLayout();
			updateSlot(slotId, {
				layout,
				contents: (current.contents ?? []).slice(0, slotContentCapacity(layout))
			});
			return;
		}
		updateSlot(slotId, { layout: { mode: 'free' }, contents: [] });
	}

	function updateHorizontalSlotLayout(
		slotId: string,
		patch: Partial<Extract<TableSlotLayout, { mode: 'horizontal-flex' }>>
	) {
		const current = selectedSlot?.id === slotId ? selectedSlot : null;
		if (!current) return;
		const currentLayout =
			current.layout?.mode === 'horizontal-flex'
				? current.layout
				: createHorizontalFlexSlotLayout();
		const layout = createHorizontalFlexSlotLayout({ ...currentLayout, ...patch });
		updateSlot(slotId, {
			layout,
			contents: (current.contents ?? []).slice(0, layout.visibleCount)
		});
	}

	function updateGridSlotLayout(
		slotId: string,
		patch: Partial<Extract<TableSlotLayout, { mode: 'grid' }>>
	) {
		const current = selectedSlot?.id === slotId ? selectedSlot : null;
		if (!current) return;
		const currentLayout = current.layout?.mode === 'grid' ? current.layout : createGridSlotLayout();
		const layout = createGridSlotLayout({ ...currentLayout, ...patch });
		updateSlot(slotId, {
			layout,
			contents: (current.contents ?? []).slice(0, slotContentCapacity(layout))
		});
	}

	function addSlotContent(slotId: string, content: TableSlotContent) {
		const current = selectedSlot?.id === slotId ? selectedSlot : null;
		if (!current || !slotCanAddContent(current) || slotHasContent(current, content)) return;
		updateSlot(slotId, { contents: [...(current.contents ?? []), content] });
		addSlotContentOpen = false;
	}

	function removeSlotContent(slotId: string, index: number) {
		const current = selectedSlot?.id === slotId ? selectedSlot : null;
		if (!current) return;
		updateSlot(slotId, {
			contents: (current.contents ?? []).filter((_, candidateIndex) => candidateIndex !== index)
		});
	}

	function updateSlotDeckContentShuffle(slotId: string, index: number, checked: boolean) {
		const current = selectedSlot?.id === slotId ? selectedSlot : null;
		if (!current) return;
		updateSlot(slotId, {
			contents: (current.contents ?? []).map((content, candidateIndex) => {
				if (candidateIndex !== index || content.type !== 'deck') return content;
				if (checked) return { ...content, shuffle: true };
				return {
					type: 'deck',
					deckName: content.deckName,
					...(content.cellIndex === undefined ? {} : { cellIndex: content.cellIndex })
				};
			})
		});
	}

	function updatePlacement(placementId: string, patch: Partial<TablePlacement>) {
		const placement = selectedPlacement?.id === placementId ? selectedPlacement : null;
		if (!placement) return;
		const nextPlacement = { ...placement, ...patch } as TablePlacement;
		const attributes: Record<string, string | number | null> = {};
		if (patch.label !== undefined) attributes['data-label'] = nextPlacement.label;
		if (nextPlacement.type === 'deck' && 'cardIds' in patch) {
			attributes['data-card-ids'] = JSON.stringify(nextPlacement.cardIds);
		}
		if (nextPlacement.type === 'deck' && 'shuffle' in patch) {
			attributes['data-initial-shuffle'] = nextPlacement.shuffle ? 'true' : null;
		}
		if (Object.keys(attributes).length === 0) return;
		if (!updateTableElementAttributes(placementId, attributes, 'Update component metadata')) return;
		selectPlacement(nextPlacement);
	}

	function togglePlacementCardValue(placementId: string, cardId: string, checked: boolean) {
		const placement = selectedPlacement?.id === placementId ? selectedPlacement : null;
		if (!placement || placement.type !== 'deck') return;
		const values = checked
			? [...placement.cardIds, cardId]
			: placement.cardIds.filter((candidate) => candidate !== cardId);
		const selectedCardIds = new Set(values);
		const deckCardIds = cards
			.filter((card) => card.deckName === placement.deckName && selectedCardIds.has(card.id))
			.map((card) => card.id);
		updatePlacement(placementId, { cardIds: deckCardIds });
	}

	function toggleSlotValue(
		slotId: string,
		key: 'acceptedDeckNames' | 'acceptedCardIds',
		value: string,
		checked: boolean
	) {
		const slot = selectedSlot?.id === slotId ? selectedSlot : null;
		if (!slot) return;
		const values = checked
			? [...slot[key], value]
			: slot[key].filter((candidate) => candidate !== value);
		const nextValues = sortedUniqueStrings(values);
		if (key === 'acceptedDeckNames') {
			updateSlotRules(slotId, { acceptedDeckNames: nextValues });
			return;
		}
		updateSlotRules(slotId, { acceptedCardIds: nextValues });
	}

	function removeSlot(slotId: string) {
		removeTableElement(slotId);
		if (selectedSlot?.id === slotId) {
			selectSlot(null);
		}
	}

	function removePlacement(placementId: string) {
		removeTableElement(placementId);
		if (selectedPlacement?.id === placementId) selectPlacement(null);
	}

	function handleEditorChange(event: CustomEvent<ChangeEvent>) {
		if (event.detail.source !== 'user') return;
		if (selectedPlacement && !editorApi?.getElementById(selectedPlacement.id)) {
			selectPlacement(null);
		}
		if (selectedSlot && !editorApi?.getElementById(selectedSlot.id)) {
			selectSlot(null);
		}
		scheduleAutosave();
	}

	function tableElementFromSelection(event: CustomEvent<SelectionChangeEvent>) {
		const element = event.detail.selectedElements[0];
		const tableElement = element?.closest?.('[data-digitable-kind]');
		if (!tableElement) return null;
		return {
			id: tableElement.getAttribute('id'),
			kind: tableElement.getAttribute('data-digitable-kind'),
			selectedElement: element,
			tableElement
		};
	}

	function handleEditorSelection(event: CustomEvent<SelectionChangeEvent>) {
		const selected = tableElementFromSelection(event);
		if (!selected?.id) {
			selectSlot(null);
			return;
		}
		const selectedId = selected.id;
		if (selected.selectedElement !== selected.tableElement) {
			requestAnimationFrame(() => editorApi?.selectElementById(selectedId));
		}
		const table = currentEditorTable();
		if (selected.kind === 'slot') {
			selectSlot(table.slots.find((slot) => slot.id === selectedId) ?? null);
			editorPanel = 'component';
			return;
		}
		if (selected.kind === 'placement') {
			selectPlacement(table.placements.find((placement) => placement.id === selectedId) ?? null);
			editorPanel = 'component';
		}
	}

	function scheduleAutosave() {
		if (isLoading) return;
		saveGeneration += 1;
		status = 'Unsaved';
		queueAutosave(saveGeneration);
	}

	function queueAutosave(generation: number) {
		cancelQueuedAutosave();
		autosaveTimer = setTimeout(() => {
			autosaveTimer = null;
			if (typeof window === 'undefined') {
				void saveTable(generation);
				return;
			}
			const browser = window as WindowWithIdleCallback;
			if (browser.requestIdleCallback) {
				autosaveIdleHandle = browser.requestIdleCallback(
					() => {
						autosaveIdleHandle = null;
						void saveTable(generation);
					},
					{ timeout: AUTOSAVE_IDLE_TIMEOUT_MS }
				);
				return;
			}
			autosaveIdleHandle = window.setTimeout(() => {
				autosaveIdleHandle = null;
				void saveTable(generation);
			}, 0);
		}, AUTOSAVE_DELAY_MS);
	}

	async function saveTableSvg(svg: string, generation: number): Promise<boolean> {
		try {
			const tableDir = await fileSystem.ensureDir(joinFsPath(projectName, 'setup'));
			if (tableDir.error) {
				if (generation === saveGeneration) {
					saveError = tableDir.error.message;
					status = 'Autosave failed';
				}
				return false;
			}
			const svgWrite = await tableDir.data.write('table.svg', svg);
			if (svgWrite.error && generation === saveGeneration) {
				saveError = svgWrite.error.message;
				status = 'Autosave failed';
				return false;
			}
			return !svgWrite.error;
		} catch (error) {
			if (generation === saveGeneration) {
				saveError = error instanceof Error ? error.message : 'Failed to save table SVG';
				status = 'Autosave failed';
			}
			return false;
		}
	}

	async function saveTable(generation = saveGeneration) {
		if (isLoading) return;
		if (saveInFlight) {
			pendingSaveGeneration = generation;
			return;
		}
		saveInFlight = true;
		isSaving = true;
		saveError = '';
		status = 'Autosaving';
		try {
			const svg = currentEditorSvgForSave();
			const saved = await saveTableSvg(svg, generation);
			if (saved && generation === saveGeneration) {
				status = 'Autosaved';
			}
		} finally {
			isSaving = false;
			saveInFlight = false;
			const queuedGeneration = pendingSaveGeneration;
			pendingSaveGeneration = null;
			if (
				(queuedGeneration !== null || generation !== saveGeneration) &&
				!autosaveTimer &&
				autosaveIdleHandle === null
			) {
				queueAutosave(saveGeneration);
			}
		}
	}
</script>

<svelte:head>
	<title>Table {projectName}</title>
</svelte:head>

<main class="flex h-svh min-h-0 flex-col overflow-hidden">
	<GameTopBar title="Table" status={isSaving ? 'Autosaving' : status} statusError={saveError}>
		<ReferenceEditorToolbar
			controller={editorController}
			variant="actions"
			framed={false}
			wrap={false}
		/>
		{@render tableToolbarAction()}
	</GameTopBar>
	<div role="region" aria-label="Table SVG editor" class="min-h-0 flex-1 overflow-hidden p-2">
		{#if isLoading}
			<div class="text-muted-foreground flex h-full items-center justify-center text-sm">
				Loading table
			</div>
		{:else}
			<ReferenceEditor
				value={editorSvg}
				bind:api={editorApi}
				controller={editorController}
				showActionToolbar={false}
				{config}
				bind:activePanel={editorPanel}
				assetBasePath="/svgedit/images/"
				emitChangeSvg={false}
				selectedElementId={selectedTableElementId}
				componentPanel={tableComponentPanel}
				on:change={handleEditorChange}
				on:selectionchange={handleEditorSelection}
			/>
		{/if}
	</div>
</main>

{#snippet tableComponentPanel()}
	<div class="space-y-4 text-sm">
		{#if selectedSlot}
			{@const slot = selectedSlot}
			<section class="space-y-3">
				<div class="flex items-center justify-between gap-2">
					<h2 class="font-semibold">Slot</h2>
					<Badge variant="secondary">rules</Badge>
				</div>
				<label class="grid gap-1 font-medium">
					Layout
					<select
						aria-label="Slot layout"
						class="border-input bg-background h-9 rounded-md border px-3"
						value={selectedSlotLayout.mode}
						onchange={(event) =>
							setSlotLayoutMode(
								slot.id,
								(event.currentTarget as HTMLSelectElement).value as TableSlotLayout['mode']
							)}
					>
						<option value="free">Free</option>
						<option value="horizontal-flex">Horizontal flex</option>
						<option value="grid">Grid</option>
					</select>
				</label>
				{#if selectedSlotLayout.mode === 'horizontal-flex'}
					<div class="grid grid-cols-2 gap-2">
						<label class="grid gap-1 font-medium">
							Items
							<Input
								aria-label="Slot item count"
								type="number"
								min="1"
								value={selectedSlotLayout.visibleCount}
								oninput={(event) =>
									updateHorizontalSlotLayout(slot.id, {
										visibleCount: Number(event.currentTarget.value)
									})}
							/>
						</label>
						<label class="grid gap-1 font-medium">
							Spacing
							<Input
								aria-label="Slot spacing"
								type="number"
								min="0"
								value={selectedSlotLayout.gap}
								oninput={(event) =>
									updateHorizontalSlotLayout(slot.id, {
										gap: Number(event.currentTarget.value)
									})}
							/>
						</label>
					</div>
				{:else if selectedSlotLayout.mode === 'grid'}
					<div class="grid grid-cols-2 gap-2">
						<label class="grid gap-1 font-medium">
							Rows
							<Input
								aria-label="Slot grid rows"
								type="number"
								min="1"
								value={selectedSlotLayout.rows}
								oninput={(event) =>
									updateGridSlotLayout(slot.id, {
										rows: Number(event.currentTarget.value)
									})}
							/>
						</label>
						<label class="grid gap-1 font-medium">
							Columns
							<Input
								aria-label="Slot grid columns"
								type="number"
								min="1"
								value={selectedSlotLayout.columns}
								oninput={(event) =>
									updateGridSlotLayout(slot.id, {
										columns: Number(event.currentTarget.value)
									})}
							/>
						</label>
						<label class="grid gap-1 font-medium">
							Column spacing
							<Input
								aria-label="Slot grid column spacing"
								type="number"
								min="0"
								value={selectedSlotLayout.gapX}
								oninput={(event) =>
									updateGridSlotLayout(slot.id, {
										gapX: Number(event.currentTarget.value)
									})}
							/>
						</label>
						<label class="grid gap-1 font-medium">
							Row spacing
							<Input
								aria-label="Slot grid row spacing"
								type="number"
								min="0"
								value={selectedSlotLayout.gapY}
								oninput={(event) =>
									updateGridSlotLayout(slot.id, {
										gapY: Number(event.currentTarget.value)
									})}
							/>
						</label>
					</div>
				{/if}
				{#if selectedSlotLayout.mode === 'horizontal-flex' || selectedSlotLayout.mode === 'grid'}
					<div class="space-y-2">
						<div class="flex items-center justify-between gap-2">
							<h3 class="font-medium">Initial contents</h3>
							<Badge variant="secondary"
								>{selectedSlotContents.length}/{slotContentCapacity(selectedSlotLayout)}</Badge
							>
						</div>
						<div class="space-y-1">
							{#each selectedSlotContents as content, index (slotContentKey(content))}
								<div class="flex items-center gap-2 rounded-md border px-2 py-1">
									<Badge variant="outline">{content.type}</Badge>
									<span class="min-w-0 flex-1 truncate">{slotContentLabel(content)}</span>
									{#if content.type === 'deck'}
										<label class="text-muted-foreground flex items-center gap-1 text-xs">
											<Checkbox
												aria-label={`Shuffle ${slotContentLabel(content)} at start`}
												checked={content.shuffle === true}
												onCheckedChange={(checked) =>
													updateSlotDeckContentShuffle(slot.id, index, checked === true)}
											/>
											<span>Shuffle</span>
										</label>
									{/if}
									<Button
										type="button"
										variant="ghost"
										size="icon"
										class="size-8"
										aria-label={`Remove ${slotContentLabel(content)}`}
										onclick={() => removeSlotContent(slot.id, index)}
									>
										<Trash2 class="size-4" />
									</Button>
								</div>
							{:else}
								<p class="text-muted-foreground rounded-md border px-2 py-2 text-xs">
									No initial contents.
								</p>
							{/each}
						</div>
						<Dialog.Root bind:open={addSlotContentOpen}>
							<Dialog.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										type="button"
										variant="outline"
										class="w-full"
										disabled={!slotCanAddContent(slot)}
									>
										<Plus class="size-4" />
										Add content
									</Button>
								{/snippet}
							</Dialog.Trigger>
							<Dialog.Content class="max-h-[80vh] overflow-hidden sm:max-w-xl">
								<Dialog.Header>
									<Dialog.Title>Add content</Dialog.Title>
									<Dialog.Description>Select a deck or card for the slot cells.</Dialog.Description>
								</Dialog.Header>
								<div class="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
									{#each decks as deck (deck.name)}
										<div class="rounded-md border p-2">
											<Button
												type="button"
												variant="ghost"
												class="flex w-full justify-between"
												disabled={!slotCanAddContent(slot) ||
													slotHasContent(slot, {
														type: 'deck',
														deckName: deck.name
													})}
												onclick={() =>
													addSlotContent(slot.id, {
														type: 'deck',
														deckName: deck.name
													})}
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
														disabled={!slotCanAddContent(slot) ||
															slotHasContent(slot, {
																type: 'card',
																deckName: deck.name,
																cardId: card.id
															})}
														onclick={() =>
															addSlotContent(slot.id, {
																type: 'card',
																deckName: deck.name,
																cardId: card.id
															})}
													>
														<span class="truncate">{card.label}</span>
														<span>{card.rowId}</span>
													</Button>
												{/each}
											</div>
										</div>
									{:else}
										<p class="text-muted-foreground rounded-md border p-3 text-sm">
											No decks found.
										</p>
									{/each}
								</div>
							</Dialog.Content>
						</Dialog.Root>
					</div>
				{/if}
				<div class="space-y-2">
					<h3 class="font-medium">Allowed decks</h3>
					{#each decks as deck (deck.name)}
						<label class="flex items-center gap-2">
							<Checkbox
								checked={slot.acceptedDeckNames.includes(deck.name)}
								onCheckedChange={(checked) =>
									toggleSlotValue(slot.id, 'acceptedDeckNames', deck.name, checked === true)}
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
									checked={slot.acceptedCardIds.includes(card.id)}
									onCheckedChange={(checked) =>
										toggleSlotValue(slot.id, 'acceptedCardIds', card.id, checked === true)}
								/>
								<span class="truncate">{card.label}</span>
								<span class="text-muted-foreground">{card.deckName}</span>
							</label>
						{/each}
					</div>
				</div>
				<Button variant="destructive" class="w-full" onclick={() => removeSlot(slot.id)}>
					<Trash2 class="size-4" />
					Delete slot
				</Button>
			</section>
		{:else if selectedPlacement}
			{@const placement = selectedPlacement}
			<section class="space-y-3">
				<div class="flex items-center justify-between gap-2">
					<h2 class="font-semibold">Component</h2>
					<Badge variant="secondary">{placement.type}</Badge>
				</div>
				<label class="grid gap-1 font-medium">
					Label
					<Input
						aria-label="Component label"
						value={placement.label}
						oninput={(event) => updatePlacement(placement.id, { label: event.currentTarget.value })}
					/>
				</label>
				<p class="text-muted-foreground text-xs">{placement.deckName}</p>
				{#if placement.type === 'deck'}
					<label class="flex items-center gap-2 rounded-md border px-2 py-2">
						<Checkbox
							aria-label="Shuffle stack at start"
							checked={placement.shuffle === true}
							onCheckedChange={(checked) =>
								updatePlacement(placement.id, { shuffle: checked === true })}
						/>
						<span>Shuffle at start</span>
					</label>
					<div class="space-y-2">
						<div class="flex items-center justify-between gap-2">
							<h3 class="font-medium">Cards in deck</h3>
							<Badge variant="secondary">{placement.cardIds.length}</Badge>
						</div>
						<div class="max-h-80 space-y-1 overflow-y-auto rounded-md border p-2">
							{#each selectedDeckCards as card (card.id)}
								<label class="flex items-center gap-2 text-xs">
									<Checkbox
										checked={placement.cardIds.includes(card.id)}
										onCheckedChange={(checked) =>
											togglePlacementCardValue(placement.id, card.id, checked === true)}
									/>
									<span class="truncate">{card.label}</span>
									<span class="text-muted-foreground">{card.rowId}</span>
								</label>
							{/each}
						</div>
					</div>
				{:else}
					<p class="text-muted-foreground text-xs">{placement.cardId}</p>
				{/if}
				<Button variant="destructive" class="w-full" onclick={() => removePlacement(placement.id)}>
					<Trash2 class="size-4" />
					Delete component
				</Button>
			</section>
		{:else}
			<p class="text-muted-foreground">Select a table component or slot to edit its game rules.</p>
		{/if}
	</div>
{/snippet}

{#snippet tableToolbarAction()}
	<Dialog.Root bind:open={addComponentOpen}>
		<Dialog.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					size="sm"
					variant="ghost"
					class="rounded-lg px-3 text-xs font-semibold tracking-wide uppercase"
					title="Add component"
					disabled={isLoading || !editorApi}
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
				{:else}
					<p class="text-muted-foreground rounded-md border p-3 text-sm">No decks found.</p>
				{/each}
			</div>
		</Dialog.Content>
	</Dialog.Root>
	<Button
		size="sm"
		variant="ghost"
		class="rounded-lg px-3 text-xs font-semibold tracking-wide uppercase"
		title="Add table slot"
		disabled={isLoading || !editorApi}
		onclick={addSlot}
	>
		<SquareDashedMousePointer class="size-4" />
		Add slot
	</Button>
	<Dialog.Root bind:open={resizeTableOpen}>
		<Dialog.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					size="sm"
					variant="ghost"
					class="rounded-lg px-3 text-xs font-semibold tracking-wide uppercase"
					title="Resize table"
					disabled={isLoading || !editorApi}
					onclick={openResizeTableDialog}
				>
					<Maximize2 class="size-4" />
					ResizeTable
				</Button>
			{/snippet}
		</Dialog.Trigger>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>ResizeTable</Dialog.Title>
				<Dialog.Description>Set the table canvas size.</Dialog.Description>
			</Dialog.Header>
			<div class="grid gap-4">
				<div class="grid gap-1">
					<label class="font-medium" for="resize-table-preset">Preset</label>
					<select
						id="resize-table-preset"
						class="border-input bg-background h-9 rounded-md border px-3"
						value={resizeTablePresetId}
						onchange={(event) =>
							setResizeTablePreset(
								(event.currentTarget as HTMLSelectElement).value as TablePresetId
							)}
					>
						{#each tablePresets as preset (preset.id)}
							<option value={preset.id}>{preset.name}</option>
						{/each}
					</select>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<label class="grid gap-1 font-medium">
						Width
						<Input
							aria-label="Table width"
							aria-describedby={resizeTableError ? 'resize-table-error' : undefined}
							aria-invalid={resizeTableError.startsWith('Width') ? 'true' : undefined}
							type="number"
							min="100"
							bind:value={resizeTableWidth}
						/>
					</label>
					<label class="grid gap-1 font-medium">
						Height
						<Input
							aria-label="Table height"
							aria-describedby={resizeTableError ? 'resize-table-error' : undefined}
							aria-invalid={resizeTableError.startsWith('Height') ? 'true' : undefined}
							type="number"
							min="100"
							bind:value={resizeTableHeight}
						/>
					</label>
				</div>
				{#if resizeTableError}
					<p id="resize-table-error" class="text-destructive text-sm" role="alert">
						{resizeTableError}
					</p>
				{/if}
				<div class="flex justify-end">
					<Button type="button" onclick={applyResizeTable}>Apply</Button>
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Root>
{/snippet}
