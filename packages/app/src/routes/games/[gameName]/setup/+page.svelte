<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { asset } from '$app/paths';
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
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { useDebounce } from 'runed';
	import { ASSETS_DIR, COMPONENTS_DIR } from '$lib/workspace/project-layout';
	import { getActiveProjectContext, getFileSystemContext } from '../../context';
	import {
		getProjectFilePath,
		isEmbeddedImageReference,
		loadSpreadsheetData,
		resolveImageReference
	} from '../data-loader';
	import { generateSvg, getSvgDataMapForSides, loadSvgTemplate } from '../svg-helpers';
	import { ImageEditor } from '../decks/[deckName]/data/custom-image';
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
		type TableSvgJson,
		type TableSlot,
		type TablePresetId,
		type Table
	} from './table';

	const SVG_EDITOR_ASSET_BASE_PATH = asset('/svgedit/images');
	const SVG_MIME_TYPE = 'image/svg+xml';
	const SVG_NS = 'http://www.w3.org/2000/svg';
	const XLINK_NS = 'http://www.w3.org/1999/xlink';

	type CardEntry = {
		id: string;
		rowId: string;
		deckName: string;
		label: string;
		frontSvg: string;
		linkedFrontSvg: string;
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
	const project = getActiveProjectContext();
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

	const getImageHref = (image: SVGImageElement) =>
		image.getAttribute('href') ?? image.getAttribute('xlink:href') ?? '';

	const setImageHref = (image: SVGImageElement, value: string) => {
		const svgRoot =
			image.ownerSVGElement ??
			(image.ownerDocument.documentElement as unknown as SVGSVGElement | null);
		if (svgRoot && !svgRoot.hasAttribute('xmlns:xlink')) {
			svgRoot.setAttribute('xmlns:xlink', XLINK_NS);
		}
		image.setAttribute('href', value);
		image.setAttributeNS(XLINK_NS, 'xlink:href', value);
	};

	async function resolveSvgImagesForEditor(value: string, projectName: string) {
		if (!value) return value;

		const doc = new DOMParser().parseFromString(value, SVG_MIME_TYPE);
		const root = doc.documentElement;
		if (!root || root.tagName.toLowerCase() !== 'svg') return value;

		await Promise.all(
			Array.from(root.querySelectorAll<SVGImageElement>('image')).map(async (image) => {
				const href = getImageHref(image).trim();
				if (!href || isEmbeddedImageReference(href)) return;

				const resolvedHref = await resolveImageReference(fileSystem, projectName, href, true);
				setImageHref(image, resolvedHref);
			})
		);

		return serializeSvg(root);
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

	function stringifyAttributes(attributes: Record<string, string | number | null>) {
		return Object.fromEntries(
			Object.entries(attributes).map(([key, value]) => [key, value === null ? null : String(value)])
		);
	}

	function setupAssetHref(value: string) {
		const projectFilePath = getProjectFilePath(projectName, value);
		if (!projectFilePath) return value.trim();
		const assetPrefix = `/${projectName}/${ASSETS_DIR}/`;
		if (!projectFilePath.startsWith(assetPrefix)) return value.trim();
		return `../${ASSETS_DIR}/${projectFilePath.slice(assetPrefix.length)}`;
	}

	function linkedImagePaths(spreadsheetData: {
		cols: Array<{ type?: unknown }>;
		data: string[][];
	}) {
		const imageColumnIndexes = spreadsheetData.cols.flatMap((column, index) =>
			column.type === ImageEditor ? [index] : []
		);
		return new Map(
			Array.from(
				new Set(
					spreadsheetData.data.flatMap((row) =>
						imageColumnIndexes.map((index) => row[index]).filter((value) => value?.trim())
					)
				)
			).map((value) => [value, setupAssetHref(value)])
		);
	}

	async function loadDeckEntry(deckName: string, frontSvgText: string): Promise<DeckEntry> {
		const frontTemplate = loadSvgTemplate(frontSvgText);
		const svgData = getSvgDataMapForSides([{ template: frontTemplate }]);
		const loadedSpreadsheetData = await loadSpreadsheetData(
			svgData,
			projectName,
			deckName,
			fileSystem
		);
		if (loadedSpreadsheetData.error) throw new Error(loadedSpreadsheetData.error.message);
		const spreadsheetData = loadedSpreadsheetData.data;
		const imagePaths = linkedImagePaths(spreadsheetData);
		const headers = spreadsheetData.cols.map((column) => String(column.title));
		const idIndex = headers.indexOf('id');
		const labelIndex = headers.findIndex((header) => header !== 'id');
		if (idIndex < 0) {
			throw new Error(`Component "${deckName}" is missing an id column.`);
		}
		const cards = await Promise.all(
			spreadsheetData.data.map(async (row, index) => {
				const rowId = String(row[idIndex] ?? '').trim();
				if (!rowId) {
					throw new Error(`Component "${deckName}" has an empty id in row ${index + 1}.`);
				}
				const label = String(labelIndex >= 0 ? row[labelIndex] : '');
				const linkedFrontSvg = serializeSvg(generateSvg(frontTemplate, headers, row, imagePaths));
				const frontSvg = await resolveSvgImagesForEditor(linkedFrontSvg, projectName);
				return {
					id: `${deckName}:${rowId}`,
					rowId,
					deckName,
					label,
					frontSvg,
					linkedFrontSvg,
					size: svgMarkupLogicalSize(frontSvg)
				};
			})
		);
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
		return resolveSvgImagesForEditor(svgRead.data, projectName);
	}

	const fallbackTable = createDefaultTable();
	let decks = $state<DeckEntry[]>([]);
	let tableInfo = $state<TableInfo>(fallbackTable.table);
	const cards = $derived(decks.flatMap((deck) => deck.cards));
	let tableSlots = $state<TableSlot[]>([]);
	let tablePlacements = $state<TablePlacement[]>([]);
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
	let activeSavePromises = $state<Promise<void>[]>([]);
	let tableSaveChain: Promise<void> = Promise.resolve();
	const editorController = createEditorController();

	const AUTOSAVE_DELAY_MS = 800;
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
	const deckLookup = $derived.by(() => createDeckLookup(decks));
	const config = $derived({
		imgPath: SVG_EDITOR_ASSET_BASE_PATH,
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
				tableSlots = loadedTable.slots;
				tablePlacements = loadedTable.placements;
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

	function createDeckLookup(sourceDecks: DeckEntry[]) {
		const deckByName = new Map<string, DeckEntry>();
		const cardById = new Map<string, CardEntry>();
		const cardSizes = new Map<string, { width: number; height: number }>();
		const deckTopCardIds = new Map<string, string>();
		const deckCardIds = new Map<string, string[]>();
		const deckSizes = new Map<string, { width: number; height: number }>();
		for (const deck of sourceDecks) {
			deckByName.set(deck.name, deck);
			const ids = deck.cards.map((card) => card.id);
			deckCardIds.set(deck.name, ids);
			const firstCard = deck.cards[0];
			if (firstCard) deckTopCardIds.set(deck.name, firstCard.id);
			const sizes = deck.cards.flatMap((card) => {
				cardById.set(card.id, card);
				if (!card.size) return [];
				cardSizes.set(card.id, card.size);
				return [card.size];
			});
			if (sizes.length > 0) {
				deckSizes.set(deck.name, {
					width: Math.max(...sizes.map((size) => size.width)),
					height: Math.max(...sizes.map((size) => size.height))
				});
			}
		}
		return { deckByName, cardById, cardSizes, deckTopCardIds, deckCardIds, deckSizes };
	}

	function lookupForDecks(sourceDecks: DeckEntry[]) {
		return sourceDecks === decks ? deckLookup : createDeckLookup(sourceDecks);
	}

	function linkedDeckLibrary(sourceDecks = decks): DeckEntry[] {
		return sourceDecks.map((deck) => ({
			...deck,
			cards: deck.cards.map((card) => ({
				...card,
				frontSvg: card.linkedFrontSvg
			}))
		}));
	}

	function appendSvgJson(parent: Element, svgJson: TableSvgJson, doc: Document) {
		if (typeof svgJson === 'string') {
			parent.appendChild(doc.createTextNode(svgJson));
			return;
		}
		const element = doc.createElementNS(SVG_NS, svgJson.element);
		for (const [key, value] of Object.entries(svgJson.attr ?? {})) {
			element.setAttribute(key, String(value));
		}
		for (const child of svgJson.children ?? []) {
			appendSvgJson(element, child, doc);
		}
		parent.appendChild(element);
	}

	function tableSvgForSave() {
		const liveElement = (id: string) => !editorApi || Boolean(editorApi.getElementById(id));
		const table: Table = {
			version: 1,
			table: { ...tableInfo },
			slots: tableSlots.filter((slot) => liveElement(slot.id)),
			placements: tablePlacements.filter((placement) => liveElement(placement.id))
		};
		if (typeof DOMParser === 'undefined') return emptyTableSvg(table.table);
		const linkedDecks = linkedDeckLibrary();

		const doc = new DOMParser().parseFromString(emptyTableSvg(table.table), SVG_MIME_TYPE);
		const root = doc.documentElement;
		if (!root || root.tagName.toLowerCase() !== 'svg') return emptyTableSvg(table.table);
		applyTableRootInfo(root, table.table);

		const layer = doc.createElementNS(SVG_NS, 'g');
		layer.setAttribute('class', 'layer');
		const title = doc.createElementNS(SVG_NS, 'title');
		title.textContent = 'Layer 1';
		layer.appendChild(title);
		for (const slot of table.slots) {
			appendSvgJson(
				layer,
				withCurrentTransform(
					slot.id,
					slotToSvgElementJson(slot, svgAssetsForSlot(slot, linkedDecks))
				),
				doc
			);
		}
		for (const placement of table.placements) {
			appendSvgJson(
				layer,
				withCurrentTransform(
					placement.id,
					placementToSvgElementJson(placement, svgAssetsForPlacement(placement, linkedDecks))
				),
				doc
			);
		}
		root.appendChild(layer);

		return serializeSvg(root);
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
		return lookupForDecks(sourceDecks).cardById.get(cardId) ?? null;
	}

	function deckByName(deckName: string, sourceDecks = decks) {
		return lookupForDecks(sourceDecks).deckByName.get(deckName) ?? null;
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
		const lookup = lookupForDecks(sourceDecks);
		const cardSvgs = new Map<string, string>();
		const previewDeckNames = new Set(
			(slot.contents ?? [])
				.filter((content) => content.type === 'deck')
				.map((content) => content.deckName)
		);
		const addCardSvg = (card: CardEntry | null) => {
			if (!card) return;
			cardSvgs.set(card.id, card.frontSvg);
		};

		for (const content of slot.contents ?? []) {
			if (content.type === 'deck') {
				const topCardId = lookup.deckTopCardIds.get(content.deckName);
				addCardSvg(topCardId ? (lookup.cardById.get(topCardId) ?? null) : null);
				continue;
			}
			addCardSvg(lookup.cardById.get(content.cardId) ?? null);
		}

		for (const deckName of previewDeckNames) {
			const topCardId = lookup.deckTopCardIds.get(deckName);
			addCardSvg(topCardId ? (lookup.cardById.get(topCardId) ?? null) : null);
		}

		return {
			cardSvgs,
			cardSizes: lookup.cardSizes,
			deckSizes: lookup.deckSizes,
			deckTopCardIds: lookup.deckTopCardIds,
			deckCardIds: lookup.deckCardIds
		};
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

	function updateTableElement(
		elementId: string,
		element: TableSvgElementJson,
		historyLabel = 'Update table element'
	): boolean {
		const updated =
			editorApi?.updateSvgElement(elementId, element, {
				select: true,
				historyLabel
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
		tablePlacements = [...tablePlacements, placement];
		selectPlacement(placement);
		editorPanel = 'component';
	}

	function quickPlace(payload: DragPayload) {
		const offset = tablePlacements.length * 36;
		addPlacement(payload, 160 + offset, 160 + offset);
	}

	function addComponent(payload: DragPayload) {
		quickPlace(payload);
		addComponentOpen = false;
	}

	function addSlot() {
		const slot: TableSlot = {
			id: crypto.randomUUID(),
			label: `Slot ${tableSlots.length + 1}`,
			x: Math.round(tableInfo.width / 2 - 120),
			y: Math.round(tableInfo.height / 2 - 160),
			rotation: 0,
			width: 240,
			height: 320,
			acceptedDeckNames: [],
			acceptedCardIds: [],
			layout: { mode: 'free' },
			contents: []
		};
		if (!insertTableElement(slot.id, slotToSvgElementJson(slot, svgAssetsForSlot(slot)))) return;
		tableSlots = [...tableSlots, slot];
		selectSlot(slot);
		editorPanel = 'component';
	}

	function updateSlot(
		slotId: string,
		patch: Partial<TableSlot>,
		historyLabel = 'Update table element'
	) {
		if (!selectedSlot || selectedSlot.id !== slotId) return;
		const candidate = normalizeTableSlot({ ...selectedSlot, ...patch });
		const assets = svgAssetsForSlot(candidate);
		const nextSlot = resolveTableSlotSize(candidate, assets);
		if (
			!updateTableElement(
				slotId,
				withCurrentTransform(slotId, slotToSvgElementJson(nextSlot, assets)),
				historyLabel
			)
		) {
			return;
		}
		tableSlots = tableSlots.map((slot) => (slot.id === slotId ? nextSlot : slot));
		selectSlot(nextSlot);
	}

	function updateSlotRules(slotId: string, patch: Partial<TableSlot>) {
		updateSlot(slotId, patch, 'Update slot rules');
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
		tablePlacements = tablePlacements.map((placement) =>
			placement.id === placementId ? nextPlacement : placement
		);
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
		tableSlots = tableSlots.filter((slot) => slot.id !== slotId);
		if (selectedSlot?.id === slotId) {
			selectSlot(null);
		}
	}

	function removePlacement(placementId: string) {
		removeTableElement(placementId);
		tablePlacements = tablePlacements.filter((placement) => placement.id !== placementId);
		if (selectedPlacement?.id === placementId) selectPlacement(null);
	}

	function handleEditorChange(event: CustomEvent<ChangeEvent>) {
		if (event.detail.source !== 'user') return;
		if (editorApi) {
			tableSlots = tableSlots.filter((slot) => editorApi?.getElementById(slot.id));
			tablePlacements = tablePlacements.filter((placement) =>
				editorApi?.getElementById(placement.id)
			);
		}
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
		if (selected.kind === 'slot') {
			selectSlot(tableSlots.find((slot) => slot.id === selectedId) ?? null);
			editorPanel = 'component';
			return;
		}
		if (selected.kind === 'placement') {
			selectPlacement(tablePlacements.find((placement) => placement.id === selectedId) ?? null);
			editorPanel = 'component';
		}
	}

	function scheduleAutosave() {
		if (isLoading) return;
		status = 'Unsaved';
		saveError = '';
		const save = saveTableDebounced();
		void save.catch(() => {});
	}

	async function saveTableSvg(svg: string): Promise<void> {
		const svgWrite = await project.session.writeFiles([{ path: TABLE_SVG_PATH, data: svg }]);
		if (svgWrite.error) throw new Error(svgWrite.error.message);
	}

	async function saveLatestTable() {
		if (isLoading) return;
		saveError = '';
		status = 'Autosaving';
		const svg = tableSvgForSave();
		await saveTableSvg(svg);
		status = 'Autosaved';
	}

	function saveTableAndTrack() {
		const save = tableSaveChain.then(saveLatestTable);
		tableSaveChain = save.catch(() => {});
		const trackedSave = save
			.catch((error) => {
				console.error('Failed to save table.svg', error);
				saveError = error instanceof Error ? error.message : 'Failed to save table SVG';
				status = 'Autosave failed';
			})
			.finally(() => {
				activeSavePromises = activeSavePromises.filter((activeSave) => activeSave !== trackedSave);
				if (activeSavePromises.length === 0) isSaving = false;
			});
		activeSavePromises = [...activeSavePromises, trackedSave];
		isSaving = true;
		return trackedSave;
	}

	const saveTableDebounced = useDebounce(saveTableAndTrack, AUTOSAVE_DELAY_MS);

	async function flushPendingSaves() {
		await saveTableDebounced.runScheduledNow();
		await Promise.allSettled(activeSavePromises);
	}

	onNavigate(() => {
		if (!saveTableDebounced.pending && activeSavePromises.length === 0) {
			return;
		}
		return flushPendingSaves();
	});
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
				assetBasePath={SVG_EDITOR_ASSET_BASE_PATH}
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
