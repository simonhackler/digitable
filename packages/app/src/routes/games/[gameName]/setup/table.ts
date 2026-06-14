export type TablePresetId = 'two-player' | 'four-player' | 'six-player' | 'square' | 'custom';

export type TablePreset = {
	id: TablePresetId;
	name: string;
	width: number;
	height: number;
};

export type TablePlacement =
	| {
			id: string;
			type: 'deck';
			deckName: string;
			cardIds: string[];
			shuffle?: boolean;
			x: number;
			y: number;
			rotation: number;
			label: string;
	  }
	| {
			id: string;
			type: 'card';
			deckName: string;
			cardId: string;
			x: number;
			y: number;
			rotation: number;
			label: string;
	  };

export type TableSlotLayout =
	| { mode: 'free' }
	| {
			mode: 'horizontal-flex';
			visibleCount: number;
			gap: number;
			cardSize: 'content-card' | 'deck-card';
	  }
	| {
			mode: 'grid';
			rows: number;
			columns: number;
			gapX: number;
			gapY: number;
			cardSize: 'content-card' | 'deck-card';
	  };

export type TableSlotContent =
	| { type: 'deck'; deckName: string; cellIndex?: number; shuffle?: boolean }
	| { type: 'card'; deckName: string; cardId: string; cellIndex?: number };

export type TableSlot = {
	id: string;
	label: string;
	x: number;
	y: number;
	rotation?: number;
	width: number;
	height: number;
	acceptedDeckNames: string[];
	acceptedCardIds: string[];
	layout?: TableSlotLayout;
	contents?: TableSlotContent[];
};

export type Table = {
	version: 1;
	table: {
		presetId: TablePresetId;
		width: number;
		height: number;
	};
	placements: TablePlacement[];
	slots: TableSlot[];
};

export type TableSvgAssets = {
	placementCardSvgs?: ReadonlyMap<string, string> | Record<string, string>;
	placementCardSizes?: ReadonlyMap<string, CardVisualSize> | Record<string, CardVisualSize>;
	cardSvgs?: ReadonlyMap<string, string> | Record<string, string>;
	deckTopCardIds?: ReadonlyMap<string, string> | Record<string, string>;
	deckCardIds?: ReadonlyMap<string, readonly string[]> | Record<string, readonly string[]>;
};

type CardVisualSize = {
	width: number;
	height: number;
};

export type TableSvgJson =
	| string
	| {
			element: string;
			attr?: Record<string, string | number>;
			children?: TableSvgJson[];
	  };

export type TableSvgElementJson = Exclude<TableSvgJson, string>;

export const TABLE_SVG_PATH = 'setup/table.svg';
const TABLE_ATTR = 'data-digitable-table';
const KIND_ATTR = 'data-digitable-kind';
const TYPE_ATTR = 'data-digitable-type';
const DECK_ATTR = 'data-deck-name';
const CARD_ATTR = 'data-card-id';
const CARD_IDS_ATTR = 'data-card-ids';
const INITIAL_SHUFFLE_ATTR = 'data-initial-shuffle';
const LABEL_ATTR = 'data-label';
const PRESET_ATTR = 'data-preset-id';
const RESIZABLE_ATTR = 'data-svgedit-resizable';
const ACCEPTED_DECKS_ATTR = 'data-accepted-deck-names';
const ACCEPTED_CARDS_ATTR = 'data-accepted-card-ids';
const SLOT_LAYOUT_MODE_ATTR = 'data-slot-layout-mode';
const SLOT_VISIBLE_COUNT_ATTR = 'data-slot-visible-count';
const SLOT_GAP_ATTR = 'data-slot-gap';
const SLOT_ROWS_ATTR = 'data-slot-rows';
const SLOT_COLUMNS_ATTR = 'data-slot-columns';
const SLOT_GAP_X_ATTR = 'data-slot-gap-x';
const SLOT_GAP_Y_ATTR = 'data-slot-gap-y';
const SLOT_CARD_SIZE_ATTR = 'data-slot-card-size';
const SLOT_CONTENTS_ATTR = 'data-slot-contents';
const DECK_STACK_ATTR = 'data-deck-stack';
const LEGACY_CARD_SIZE = { width: 110, height: 150 };
const DEFAULT_FLEX_VISIBLE_COUNT = 4;
const DEFAULT_FLEX_GAP = 16;
const DEFAULT_GRID_ROWS = 2;
const DEFAULT_GRID_COLUMNS = 2;
const TABLE_GRID_STEP = 20;

const nonResizableAttrs = () => ({ [RESIZABLE_ATTR]: 'false' });
const lockedAttrs = () => ({ ...nonResizableAttrs(), 'data-locked': 'true' });
const lockedTextAttrs = () => ({ ...lockedAttrs(), style: 'pointer-events:none;user-select:none' });

export const tablePresets: TablePreset[] = [
	{ id: 'two-player', name: '2-player', width: 1200, height: 700 },
	{ id: 'four-player', name: '4-player', width: 1400, height: 900 },
	{ id: 'six-player', name: '6-player', width: 1800, height: 1000 },
	{ id: 'square', name: 'Square', width: 1000, height: 1000 },
	{ id: 'custom', name: 'Custom', width: 1400, height: 900 }
];

export const defaultPreset = tablePresets[1];

export function createDefaultTable(): Table {
	return {
		version: 1,
		table: {
			presetId: defaultPreset.id,
			width: defaultPreset.width,
			height: defaultPreset.height
		},
		placements: [],
		slots: []
	};
}

function finiteNumber(value: unknown, fallback: number): number {
	if (typeof value !== 'number') return fallback;
	if (!Number.isFinite(value)) return fallback;
	return value;
}

function positiveNumber(value: unknown, fallback: number): number {
	const number = finiteNumber(value, fallback);
	return number > 0 ? number : fallback;
}

function legacyCardSize(): CardVisualSize {
	return { ...LEGACY_CARD_SIZE };
}

function positiveSize(value: unknown, fallback: number): number {
	const number = Number.parseFloat(String(value ?? ''));
	return Number.isFinite(number) && number > 0 ? number : fallback;
}

function svgLogicalSize(root: Element | null): CardVisualSize | null {
	if (!root || root.tagName.toLowerCase() !== 'svg') return null;
	const viewBox =
		root
			.getAttribute('viewBox')
			?.split(/[,\s]+/)
			.map((part) => Number(part)) ?? [];
	const width = Number.isFinite(viewBox[2])
		? viewBox[2]
		: positiveSize(root.getAttribute('width'), 0);
	const height = Number.isFinite(viewBox[3])
		? viewBox[3]
		: positiveSize(root.getAttribute('height'), 0);
	if (width <= 0 || height <= 0) return null;
	return { width, height };
}

export function svgMarkupLogicalSize(svg: string | null | undefined): CardVisualSize | null {
	if (!svg) return null;
	try {
		return svgLogicalSize(new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement);
	} catch {
		return null;
	}
}

function nonNegativeNumber(value: unknown, fallback: number): number {
	const number = finiteNumber(value, fallback);
	return number >= 0 ? number : fallback;
}

function positiveInteger(value: unknown, fallback: number): number {
	const number = finiteNumber(value, fallback);
	return number > 0 ? Math.floor(number) : fallback;
}

function stringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === 'string');
}

function tableSlotContent(value: unknown): TableSlotContent | null {
	if (!value || typeof value !== 'object') return null;
	const input = value as Record<string, unknown>;
	const deckName = typeof input.deckName === 'string' ? input.deckName : '';
	if (!deckName) return null;
	const rawCellIndex = finiteNumber(input.cellIndex, -1);
	const cellIndex = rawCellIndex >= 0 ? Math.floor(rawCellIndex) : undefined;
	const cell = cellIndex === undefined ? {} : { cellIndex };
	const shuffle = input.shuffle === true ? { shuffle: true } : {};
	if (input.type === 'deck') return { type: 'deck', deckName, ...cell, ...shuffle };
	if (input.type === 'card') {
		const cardId = typeof input.cardId === 'string' ? input.cardId : '';
		if (!cardId) return null;
		return { type: 'card', deckName, cardId, ...cell };
	}
	return null;
}

function tableSlotContents(value: unknown): TableSlotContent[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item) => {
		const parsed = tableSlotContent(item);
		return parsed ? [parsed] : [];
	});
}

function slotContentKey(content: TableSlotContent): string {
	return content.type === 'deck' ? `deck:${content.deckName}` : `card:${content.cardId}`;
}

function uniqueSlotContents(contents: TableSlotContent[]): TableSlotContent[] {
	const seen = new Set<string>();
	return contents.filter((content) => {
		const key = slotContentKey(content);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export function createHorizontalFlexSlotLayout(
	input: Partial<Extract<TableSlotLayout, { mode: 'horizontal-flex' }>> = {}
): Extract<TableSlotLayout, { mode: 'horizontal-flex' }> {
	const visibleCount = Math.max(1, positiveInteger(input.visibleCount, DEFAULT_FLEX_VISIBLE_COUNT));
	const gap = Math.round(nonNegativeNumber(input.gap, DEFAULT_FLEX_GAP));
	return {
		mode: 'horizontal-flex',
		visibleCount,
		gap,
		cardSize: input.cardSize === 'deck-card' ? 'deck-card' : 'content-card'
	};
}

export function createGridSlotLayout(
	input: Partial<Extract<TableSlotLayout, { mode: 'grid' }>> = {}
): Extract<TableSlotLayout, { mode: 'grid' }> {
	return {
		mode: 'grid',
		rows: Math.max(1, positiveInteger(input.rows, DEFAULT_GRID_ROWS)),
		columns: Math.max(1, positiveInteger(input.columns, DEFAULT_GRID_COLUMNS)),
		gapX: Math.round(nonNegativeNumber(input.gapX, DEFAULT_FLEX_GAP)),
		gapY: Math.round(nonNegativeNumber(input.gapY, DEFAULT_FLEX_GAP)),
		cardSize: input.cardSize === 'deck-card' ? 'deck-card' : 'content-card'
	};
}

function tableSlotLayout(value: unknown): TableSlotLayout {
	if (!value || typeof value !== 'object') return { mode: 'free' };
	const input = value as Record<string, unknown>;
	if (input.mode === 'grid') {
		return createGridSlotLayout({
			rows: finiteNumber(input.rows, DEFAULT_GRID_ROWS),
			columns: finiteNumber(input.columns, DEFAULT_GRID_COLUMNS),
			gapX: finiteNumber(input.gapX, DEFAULT_FLEX_GAP),
			gapY: finiteNumber(input.gapY, DEFAULT_FLEX_GAP),
			cardSize: input.cardSize === 'deck-card' ? 'deck-card' : 'content-card'
		});
	}
	if (input.mode !== 'horizontal-flex') return { mode: 'free' };
	return createHorizontalFlexSlotLayout({
		visibleCount: finiteNumber(input.visibleCount, DEFAULT_FLEX_VISIBLE_COUNT),
		gap: finiteNumber(input.gap, DEFAULT_FLEX_GAP),
		cardSize: input.cardSize === 'deck-card' ? 'deck-card' : 'content-card'
	});
}

function horizontalFlexSlotSize(layout: Extract<TableSlotLayout, { mode: 'horizontal-flex' }>): {
	width: number;
	height: number;
} {
	return {
		width:
			layout.visibleCount * LEGACY_CARD_SIZE.width +
			Math.max(0, layout.visibleCount - 1) * layout.gap,
		height: LEGACY_CARD_SIZE.height
	};
}

function gridSlotSize(layout: Extract<TableSlotLayout, { mode: 'grid' }>): {
	width: number;
	height: number;
} {
	return {
		width: layout.columns * LEGACY_CARD_SIZE.width + Math.max(0, layout.columns - 1) * layout.gapX,
		height: layout.rows * LEGACY_CARD_SIZE.height + Math.max(0, layout.rows - 1) * layout.gapY
	};
}

function slotLayoutCapacity(layout: TableSlotLayout): number {
	if (layout.mode === 'horizontal-flex') return layout.visibleCount;
	if (layout.mode === 'grid') return layout.rows * layout.columns;
	return 0;
}

function contentsForFixedLayout(contents: TableSlotContent[], layout: TableSlotLayout) {
	const capacity = slotLayoutCapacity(layout);
	if (capacity <= 0) return [];
	if (layout.mode !== 'grid') return uniqueSlotContents(contents).slice(0, capacity);

	const usedCells = new Set<number>();
	const nextOpenCell = () => {
		for (let index = 0; index < capacity; index += 1) {
			if (!usedCells.has(index)) return index;
		}
		return null;
	};

	return uniqueSlotContents(contents).flatMap((content) => {
		const requestedCell =
			content.cellIndex !== undefined && content.cellIndex >= 0 && content.cellIndex < capacity
				? Math.floor(content.cellIndex)
				: null;
		const cellIndex =
			requestedCell !== null && !usedCells.has(requestedCell) ? requestedCell : nextOpenCell();
		if (cellIndex === null) return [];
		usedCells.add(cellIndex);
		return [{ ...content, cellIndex }];
	});
}

export function normalizeTableSlot(slot: TableSlot): TableSlot {
	const layout = tableSlotLayout(slot.layout);
	const rotation = finiteNumber(slot.rotation, 0);
	if (layout.mode === 'horizontal-flex') {
		const fallbackSize = horizontalFlexSlotSize(layout);
		return {
			...slot,
			rotation,
			width: positiveNumber(slot.width, fallbackSize.width),
			height: positiveNumber(slot.height, fallbackSize.height),
			layout,
			contents: contentsForFixedLayout(slot.contents ?? [], layout)
		};
	}
	if (layout.mode === 'grid') {
		const fallbackSize = gridSlotSize(layout);
		return {
			...slot,
			rotation,
			width: positiveNumber(slot.width, fallbackSize.width),
			height: positiveNumber(slot.height, fallbackSize.height),
			layout,
			contents: contentsForFixedLayout(slot.contents ?? [], layout)
		};
	}
	return {
		...slot,
		rotation,
		layout,
		contents: []
	};
}

function presetId(value: unknown): TablePresetId {
	if (typeof value !== 'string') return defaultPreset.id;
	const preset = tablePresets.find((candidate) => candidate.id === value);
	return preset?.id ?? defaultPreset.id;
}

function snapToGrid(value: number, step = TABLE_GRID_STEP): number {
	if (!Number.isFinite(value)) return 0;
	return Math.round(value / step) * step;
}

export function snapPlacementToGrid<T extends TablePlacement>(
	item: T,
	size: CardVisualSize = LEGACY_CARD_SIZE
): T {
	const nextX = snapToGrid(item.x - size.width / 2) + size.width / 2;
	const nextY = snapToGrid(item.y - size.height / 2) + size.height / 2;
	if (nextX === item.x && nextY === item.y) return item;
	return { ...item, x: nextX, y: nextY };
}

function sortedStrings(values: string[]): string[] {
	return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function parseJsonStringArray(value: string | null): string[] {
	if (!value) return [];
	try {
		return stringArray(JSON.parse(value));
	} catch {
		return [];
	}
}

function parseJsonSlotContents(value: string | null): TableSlotContent[] {
	if (!value) return [];
	try {
		return tableSlotContents(JSON.parse(value));
	} catch {
		return [];
	}
}

function parseNumberAttribute(element: Element | null, name: string, fallback: number): number {
	if (!element) return fallback;
	const value = Number.parseFloat(element.getAttribute(name) ?? '');
	if (!Number.isFinite(value)) return fallback;
	return value;
}

function slotLayoutFromElement(element: Element): TableSlotLayout {
	const mode = element.getAttribute(SLOT_LAYOUT_MODE_ATTR);
	if (mode === 'grid') {
		return createGridSlotLayout({
			rows: parseNumberAttribute(element, SLOT_ROWS_ATTR, DEFAULT_GRID_ROWS),
			columns: parseNumberAttribute(element, SLOT_COLUMNS_ATTR, DEFAULT_GRID_COLUMNS),
			gapX: parseNumberAttribute(element, SLOT_GAP_X_ATTR, DEFAULT_FLEX_GAP),
			gapY: parseNumberAttribute(element, SLOT_GAP_Y_ATTR, DEFAULT_FLEX_GAP),
			cardSize:
				element.getAttribute(SLOT_CARD_SIZE_ATTR) === 'deck-card' ? 'deck-card' : 'content-card'
		});
	}
	if (mode !== 'horizontal-flex') return { mode: 'free' };
	return createHorizontalFlexSlotLayout({
		visibleCount: parseNumberAttribute(
			element,
			SLOT_VISIBLE_COUNT_ATTR,
			DEFAULT_FLEX_VISIBLE_COUNT
		),
		gap: parseNumberAttribute(element, SLOT_GAP_ATTR, DEFAULT_FLEX_GAP),
		cardSize:
			element.getAttribute(SLOT_CARD_SIZE_ATTR) === 'deck-card' ? 'deck-card' : 'content-card'
	});
}

function normalizeEditorDimension(value: number, fallback: number): number {
	if (!Number.isFinite(value) || value <= 0) return fallback;
	if (fallback > 0 && Math.abs(value / fallback - 10) < 0.001) return fallback;
	return value;
}

function roundedSvgNumber(value: number): number {
	if (!Number.isFinite(value)) return value;
	const rounded = Math.round(value * 1000) / 1000;
	return Object.is(rounded, -0) ? 0 : rounded;
}

function transformParts(value: string | null) {
	if (!value) return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
	const matrix = value.match(/matrix\(([^)]+)\)/);
	if (matrix) {
		const values = matrix[1].split(/[,\s]+/).map((part) => Number(part));
		const [a, b, c, d, e, f] = values;
		const scaleX = Math.hypot(Number.isFinite(a) ? a : 1, Number.isFinite(b) ? b : 0);
		const scaleY = Math.hypot(Number.isFinite(c) ? c : 0, Number.isFinite(d) ? d : 1);
		return {
			x: Number.isFinite(e) ? e : 0,
			y: Number.isFinite(f) ? f : 0,
			scaleX: Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1,
			scaleY: Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1,
			rotation:
				Number.isFinite(a) && Number.isFinite(b)
					? Math.round(Math.atan2(b, a) * (180 / Math.PI))
					: 0,
			matrix: {
				a: Number.isFinite(a) ? a : 1,
				b: Number.isFinite(b) ? b : 0,
				c: Number.isFinite(c) ? c : 0,
				d: Number.isFinite(d) ? d : 1,
				e: Number.isFinite(e) ? e : 0,
				f: Number.isFinite(f) ? f : 0
			}
		};
	}
	const translate = value.match(/translate\(([^)]+)\)/);
	const rotate = value.match(/rotate\(([^)]+)\)/);
	const scale = value.match(/scale\(([^)]+)\)/);
	const translateValues = translate?.[1].split(/[,\s]+/).map((part) => Number(part)) ?? [];
	const scaleValues = scale?.[1].split(/[,\s]+/).map((part) => Number(part)) ?? [];
	const rotation = Number.parseFloat(rotate?.[1] ?? '0');
	const scaleX = Number.isFinite(scaleValues[0]) && scaleValues[0] > 0 ? scaleValues[0] : 1;
	const scaleY = Number.isFinite(scaleValues[1]) && scaleValues[1] > 0 ? scaleValues[1] : scaleX;
	return {
		x: Number.isFinite(translateValues[0]) ? translateValues[0] : 0,
		y: Number.isFinite(translateValues[1]) ? translateValues[1] : 0,
		rotation: Number.isFinite(rotation) ? rotation : 0,
		scaleX,
		scaleY
	};
}

function transformTranslationForRotationOrigin(
	transform: ReturnType<typeof transformParts>,
	origin: { x: number; y: number }
) {
	if (
		!transform.matrix ||
		(Math.abs(transform.matrix.b) < 0.000001 && Math.abs(transform.matrix.c) < 0.000001)
	) {
		return { x: transform.x, y: transform.y };
	}
	const { a, b, c, d, e, f } = transform.matrix;
	return {
		x: roundedSvgNumber(e - (origin.x - a * origin.x - c * origin.y)),
		y: roundedSvgNumber(f - (origin.y - b * origin.x - d * origin.y))
	};
}

type SvgAssetMap = ReadonlyMap<string, string> | Record<string, string> | undefined;
type SvgAssetListMap =
	| ReadonlyMap<string, readonly string[]>
	| Record<string, readonly string[]>
	| undefined;
type SvgSizeMap = ReadonlyMap<string, CardVisualSize> | Record<string, CardVisualSize> | undefined;

function isReadonlyMap(value: SvgAssetMap): value is ReadonlyMap<string, string> {
	return typeof (value as { get?: unknown } | undefined)?.get === 'function';
}

function isReadonlyListMap(
	value: SvgAssetListMap
): value is ReadonlyMap<string, readonly string[]> {
	return typeof (value as { get?: unknown } | undefined)?.get === 'function';
}

function isReadonlySizeMap(value: SvgSizeMap): value is ReadonlyMap<string, CardVisualSize> {
	return typeof (value as { get?: unknown } | undefined)?.get === 'function';
}

function svgAssetValue(source: SvgAssetMap, key: string): string | null {
	if (!source) return null;
	if (isReadonlyMap(source)) return source.get(key) ?? null;
	return source[key] ?? null;
}

function svgAssetList(source: SvgAssetListMap, key: string): readonly string[] {
	if (!source) return [];
	if (isReadonlyListMap(source)) return source.get(key) ?? [];
	return source[key] ?? [];
}

function normalizedCardVisualSize(value: CardVisualSize | null | undefined): CardVisualSize | null {
	if (!value) return null;
	const width = positiveNumber(value.width, 0);
	const height = positiveNumber(value.height, 0);
	if (width <= 0 || height <= 0) return null;
	return { width, height };
}

function svgAssetSize(source: SvgSizeMap, key: string): CardVisualSize | null {
	if (!source) return null;
	const size = isReadonlySizeMap(source) ? source.get(key) : source[key];
	return normalizedCardVisualSize(size);
}

function placementCardSvg(assets: TableSvgAssets, placementId: string): string | null {
	return svgAssetValue(assets.placementCardSvgs, placementId);
}

function requirePlacementCardSvg(assets: TableSvgAssets, placement: TablePlacement): string {
	const cardSvg = placementCardSvg(assets, placement.id);
	if (cardSvg) return cardSvg;
	throw new Error(`Missing SVG asset for table placement "${placement.id}"`);
}

function slotContentCardSvg(assets: TableSvgAssets, content: TableSlotContent): string | null {
	if (content.type === 'card') return svgAssetValue(assets.cardSvgs, content.cardId);
	const topCardId = svgAssetValue(assets.deckTopCardIds, content.deckName);
	return topCardId ? svgAssetValue(assets.cardSvgs, topCardId) : null;
}

function requireSlotContentCardSvg(assets: TableSvgAssets, content: TableSlotContent): string {
	const cardSvg = slotContentCardSvg(assets, content);
	if (cardSvg) return cardSvg;
	const target = content.type === 'deck' ? content.deckName : content.cardId;
	throw new Error(`Missing SVG asset for table slot ${content.type} "${target}"`);
}

function cardSvgSize(cardSvg: string | null): CardVisualSize {
	return svgMarkupLogicalSize(cardSvg) ?? legacyCardSize();
}

function placementVisualSize(placement: TablePlacement, assets: TableSvgAssets): CardVisualSize {
	return (
		svgAssetSize(assets.placementCardSizes, placement.id) ??
		cardSvgSize(placementCardSvg(assets, placement.id))
	);
}

function placementVisualSizeFromAssets(
	group: Element,
	assets: TableSvgAssets
): CardVisualSize | null {
	const id = group.getAttribute('id');
	if (!id) return null;
	return (
		svgAssetSize(assets.placementCardSizes, id) ??
		svgMarkupLogicalSize(placementCardSvg(assets, id))
	);
}

function slotContentVisualSize(content: TableSlotContent, assets: TableSvgAssets): CardVisualSize {
	return cardSvgSize(slotContentCardSvg(assets, content));
}

function cardIdVisualSize(cardId: string, assets: TableSvgAssets): CardVisualSize | null {
	return svgMarkupLogicalSize(svgAssetValue(assets.cardSvgs, cardId));
}

function cardVisualBounds(
	group: Element,
	expectedSize: CardVisualSize | null = null
): {
	x: number;
	y: number;
	width: number;
	height: number;
	hasGraphics: boolean;
} {
	const graphics = Array.from(group.getElementsByTagName('*')).filter((element) => {
		const tag = element.tagName.toLowerCase();
		return (tag === 'rect' || tag === 'image') && element.getAttribute(DECK_STACK_ATTR) !== 'true';
	});
	const bounds = graphics.map((element) => {
		const x = parseNumberAttribute(element, 'x', 0);
		const y = parseNumberAttribute(element, 'y', 0);
		const width = parseNumberAttribute(element, 'width', 0);
		const height = parseNumberAttribute(element, 'height', 0);
		return { x, y, width, height };
	});
	const visibleBounds = bounds.filter((rect) => rect.width > 0 && rect.height > 0);
	const xValues = visibleBounds.map((rect) => rect.x);
	const yValues = visibleBounds.map((rect) => rect.y);
	const rightValues = visibleBounds.map((rect) => rect.x + rect.width);
	const bottomValues = visibleBounds.map((rect) => rect.y + rect.height);
	const x = xValues.length > 0 ? Math.min(...xValues) : 0;
	const y = yValues.length > 0 ? Math.min(...yValues) : 0;
	const width = rightValues.length > 0 ? Math.max(...rightValues) - x : LEGACY_CARD_SIZE.width;
	const height = bottomValues.length > 0 ? Math.max(...bottomValues) - y : LEGACY_CARD_SIZE.height;
	const size = expectedSize ?? { width, height };
	return {
		x,
		y,
		width: size.width,
		height: size.height,
		hasGraphics: visibleBounds.length > 0 || expectedSize !== null
	};
}

function textLabel(group: Element, fallback: string): string {
	const explicit = group.getAttribute(LABEL_ATTR);
	if (explicit) return explicit;
	const text = firstElementByTag(group, 'text')?.textContent?.trim();
	return text || fallback;
}

function elementsByKind(root: Element, kind: string): Element[] {
	if (typeof root.querySelectorAll === 'function') {
		return Array.from(root.querySelectorAll(`[${KIND_ATTR}="${kind}"]`));
	}
	return Array.from(root.getElementsByTagName('*')).filter(
		(element) => element.getAttribute(KIND_ATTR) === kind
	);
}

function firstElementByTag(root: Element, tagName: string): Element | null {
	if (typeof root.querySelector === 'function') return root.querySelector(tagName);
	return root.getElementsByTagName(tagName)[0] ?? null;
}

function svgRootToTable(root: Element, fallback: Table, assets: TableSvgAssets = {}): Table {
	if (!root || root.tagName.toLowerCase() !== 'svg') return fallback;

	const parsedPresetId = presetId(root.getAttribute(PRESET_ATTR));
	const viewBox =
		root
			.getAttribute('viewBox')
			?.split(/[,\s]+/)
			.map((part) => Number(part)) ?? [];
	const rawWidth =
		(Number.isFinite(viewBox[2]) ? viewBox[2] : 0) ||
		parseNumberAttribute(root, 'width', 0) ||
		fallback.table.width;
	const rawHeight =
		(Number.isFinite(viewBox[3]) ? viewBox[3] : 0) ||
		parseNumberAttribute(root, 'height', 0) ||
		fallback.table.height;
	const width = normalizeEditorDimension(rawWidth, fallback.table.width);
	const height = normalizeEditorDimension(rawHeight, fallback.table.height);

	const placements = elementsByKind(root, 'placement').flatMap((group): TablePlacement[] => {
		const id = group.getAttribute('id') ?? crypto.randomUUID();
		const type = group.getAttribute(TYPE_ATTR);
		const deckName = group.getAttribute(DECK_ATTR) ?? '';
		const cardIds = parseJsonStringArray(group.getAttribute(CARD_IDS_ATTR));
		const shuffle = group.getAttribute(INITIAL_SHUFFLE_ATTR) === 'true';
		const transform = transformParts(group.getAttribute('transform'));
		if (!deckName) return [];
		const visual = cardVisualBounds(group, placementVisualSizeFromAssets(group, assets));
		const topLeftGeometry = visual.hasGraphics && visual.x >= 0 && visual.y >= 0;
		const groupTranslation = transformTranslationForRotationOrigin(transform, {
			x: visual.x + visual.width / 2,
			y: visual.y + visual.height / 2
		});
		const base = {
			id,
			deckName,
			x: topLeftGeometry
				? groupTranslation.x + visual.x * transform.scaleX + (visual.width * transform.scaleX) / 2
				: groupTranslation.x,
			y: topLeftGeometry
				? groupTranslation.y + visual.y * transform.scaleY + (visual.height * transform.scaleY) / 2
				: groupTranslation.y,
			rotation: transform.rotation,
			label: textLabel(group, deckName)
		};
		const size = {
			width: positiveNumber(
				roundedSvgNumber(visual.width * transform.scaleX),
				LEGACY_CARD_SIZE.width
			),
			height: positiveNumber(
				roundedSvgNumber(visual.height * transform.scaleY),
				LEGACY_CARD_SIZE.height
			)
		};
		if (type === 'deck') {
			return [
				snapPlacementToGrid({ ...base, type, cardIds, ...(shuffle ? { shuffle } : {}) }, size)
			];
		}
		if (type === 'card') {
			const cardId = group.getAttribute(CARD_ATTR) ?? '';
			if (!cardId) return [];
			return [snapPlacementToGrid({ ...base, type, cardId }, size)];
		}
		return [];
	});

	const slots = elementsByKind(root, 'slot').flatMap((group): TableSlot[] => {
		const rect = firstElementByTag(group, 'rect');
		const id = group.getAttribute('id') ?? crypto.randomUUID();
		const transform = transformParts(group.getAttribute('transform'));
		const rectX = parseNumberAttribute(rect, 'x', 0);
		const rectY = parseNumberAttribute(rect, 'y', 0);
		const rectWidth = positiveNumber(parseNumberAttribute(rect, 'width', 240), 240);
		const rectHeight = positiveNumber(parseNumberAttribute(rect, 'height', 320), 320);
		const groupTranslation = transformTranslationForRotationOrigin(transform, {
			x: rectX + rectWidth / 2,
			y: rectY + rectHeight / 2
		});
		return [
			normalizeTableSlot({
				id,
				label: textLabel(group, 'Slot'),
				x: roundedSvgNumber(groupTranslation.x + rectX * transform.scaleX),
				y: roundedSvgNumber(groupTranslation.y + rectY * transform.scaleY),
				rotation: transform.rotation,
				width: positiveNumber(roundedSvgNumber(rectWidth * transform.scaleX), 240),
				height: positiveNumber(roundedSvgNumber(rectHeight * transform.scaleY), 320),
				acceptedDeckNames: sortedStrings(
					parseJsonStringArray(group.getAttribute(ACCEPTED_DECKS_ATTR))
				),
				acceptedCardIds: sortedStrings(
					parseJsonStringArray(group.getAttribute(ACCEPTED_CARDS_ATTR))
				),
				layout: slotLayoutFromElement(group),
				contents: parseJsonSlotContents(group.getAttribute(SLOT_CONTENTS_ATTR))
			})
		];
	});

	return {
		version: 1,
		table: {
			presetId: root.getAttribute(TABLE_ATTR) === 'true' ? parsedPresetId : fallback.table.presetId,
			width: positiveNumber(width, fallback.table.width),
			height: positiveNumber(height, fallback.table.height)
		},
		placements,
		slots
	};
}

export function svgElementToTable(
	root: Element | null | undefined,
	fallback = createDefaultTable(),
	assets: TableSvgAssets = {}
): Table {
	if (!root) return fallback;
	return svgRootToTable(root, fallback, assets);
}

export function svgToTable(
	svg: string,
	fallback = createDefaultTable(),
	assets: TableSvgAssets = {}
): Table {
	const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
	return svgElementToTable(doc.documentElement, fallback, assets);
}

function concreteSlotCardIds(slot: TableSlot, assets: TableSvgAssets): string[] {
	const cardIds = new Set<string>();
	for (const cardId of slot.acceptedCardIds) {
		cardIds.add(cardId);
	}
	for (const deckName of slot.acceptedDeckNames) {
		for (const cardId of svgAssetList(assets.deckCardIds, deckName)) {
			cardIds.add(cardId);
		}
	}
	for (const content of slot.contents ?? []) {
		if (content.type === 'card') {
			cardIds.add(content.cardId);
			continue;
		}
		const deckIds = svgAssetList(assets.deckCardIds, content.deckName);
		if (deckIds.length > 0) {
			for (const cardId of deckIds) cardIds.add(cardId);
			continue;
		}
		const topCardId = svgAssetValue(assets.deckTopCardIds, content.deckName);
		if (topCardId) cardIds.add(topCardId);
	}
	return [...cardIds];
}

function fixedSlotContentSize(slot: TableSlot, assets: TableSvgAssets): CardVisualSize | null {
	const sizes = concreteSlotCardIds(slot, assets).flatMap((cardId) => {
		const size = cardIdVisualSize(cardId, assets);
		return size ? [size] : [];
	});
	if (sizes.length === 0) return null;
	return {
		width: Math.max(...sizes.map((size) => size.width)),
		height: Math.max(...sizes.map((size) => size.height))
	};
}

export function resolveTableSlotSize(slot: TableSlot, assets: TableSvgAssets = {}): TableSlot {
	const normalized = normalizeTableSlot(slot);
	const layout = normalized.layout;
	if (layout?.mode !== 'horizontal-flex' && layout?.mode !== 'grid') return normalized;
	const cellSize = fixedSlotContentSize(normalized, assets);
	if (!cellSize) return normalized;
	if (layout.mode === 'horizontal-flex') {
		return {
			...normalized,
			width:
				layout.visibleCount * cellSize.width + Math.max(0, layout.visibleCount - 1) * layout.gap,
			height: cellSize.height
		};
	}
	return {
		...normalized,
		width: layout.columns * cellSize.width + Math.max(0, layout.columns - 1) * layout.gapX,
		height: layout.rows * cellSize.height + Math.max(0, layout.rows - 1) * layout.gapY
	};
}

function cardImageHref(cardSvg: string): string {
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardSvg)}`;
}

function cardImageElementJson(
	cardSvg: string,
	size: CardVisualSize,
	x = 0,
	y = 0
): TableSvgElementJson {
	return {
		element: 'image',
		attr: {
			x,
			y,
			width: size.width,
			height: size.height,
			preserveAspectRatio: 'xMidYMid meet',
			href: cardImageHref(cardSvg),
			...lockedAttrs()
		}
	};
}

function stackOffset(size: CardVisualSize) {
	return Math.max(2, Math.round(Math.min(size.width, size.height) / 16));
}

function deckStackElementsJson(size: CardVisualSize, x = 0, y = 0): TableSvgElementJson[] {
	const offset = stackOffset(size);
	return [
		{
			element: 'rect',
			attr: {
				x: x + offset * 2,
				y: y + offset * 2,
				width: size.width,
				height: size.height,
				rx: 10,
				fill: '#0f172a',
				'fill-opacity': 0.28,
				stroke: '#0f172a',
				'stroke-opacity': 0.45,
				'stroke-width': 2,
				[DECK_STACK_ATTR]: 'true',
				...lockedAttrs()
			}
		},
		{
			element: 'rect',
			attr: {
				x: x + offset,
				y: y + offset,
				width: size.width,
				height: size.height,
				rx: 10,
				fill: '#f8fafc',
				stroke: '#334155',
				'stroke-opacity': 0.65,
				'stroke-width': 2,
				[DECK_STACK_ATTR]: 'true',
				...lockedAttrs()
			}
		}
	];
}

function boundedDeckStackElementsJson(size: CardVisualSize, x = 0, y = 0): TableSvgElementJson[] {
	const offset = stackOffset(size);
	return [
		{
			element: 'rect',
			attr: {
				x: x + offset * 2,
				y: y + offset * 2,
				width: Math.max(1, size.width - offset * 2),
				height: Math.max(1, size.height - offset * 2),
				rx: 10,
				fill: '#0f172a',
				'fill-opacity': 0.24,
				stroke: '#0f172a',
				'stroke-opacity': 0.4,
				'stroke-width': 2,
				[DECK_STACK_ATTR]: 'true',
				...lockedAttrs()
			}
		},
		{
			element: 'rect',
			attr: {
				x: x + offset,
				y: y + offset,
				width: Math.max(1, size.width - offset),
				height: Math.max(1, size.height - offset),
				rx: 10,
				fill: '#f8fafc',
				stroke: '#334155',
				'stroke-opacity': 0.55,
				'stroke-width': 2,
				[DECK_STACK_ATTR]: 'true',
				...lockedAttrs()
			}
		}
	];
}

function slotAttributes(item: TableSlot): Record<string, string | number> {
	const slot = normalizeTableSlot(item);
	const attributes: Record<string, string | number> = {
		id: slot.id,
		[KIND_ATTR]: 'slot',
		[LABEL_ATTR]: slot.label,
		[ACCEPTED_DECKS_ATTR]: JSON.stringify(sortedStrings(slot.acceptedDeckNames)),
		[ACCEPTED_CARDS_ATTR]: JSON.stringify(sortedStrings(slot.acceptedCardIds)),
		[SLOT_LAYOUT_MODE_ATTR]: slot.layout?.mode ?? 'free',
		transform: slotTransform(slot)
	};
	if (slot.layout?.mode === 'horizontal-flex') {
		attributes[RESIZABLE_ATTR] = 'false';
		attributes[SLOT_VISIBLE_COUNT_ATTR] = slot.layout.visibleCount;
		attributes[SLOT_GAP_ATTR] = slot.layout.gap;
		attributes[SLOT_CARD_SIZE_ATTR] = slot.layout.cardSize;
		attributes[SLOT_CONTENTS_ATTR] = JSON.stringify(slot.contents ?? []);
	}
	if (slot.layout?.mode === 'grid') {
		attributes[RESIZABLE_ATTR] = 'false';
		attributes[SLOT_ROWS_ATTR] = slot.layout.rows;
		attributes[SLOT_COLUMNS_ATTR] = slot.layout.columns;
		attributes[SLOT_GAP_X_ATTR] = slot.layout.gapX;
		attributes[SLOT_GAP_Y_ATTR] = slot.layout.gapY;
		attributes[SLOT_CARD_SIZE_ATTR] = slot.layout.cardSize;
		attributes[SLOT_CONTENTS_ATTR] = JSON.stringify(slot.contents ?? []);
	}
	return attributes;
}

function slotTransform(slot: TableSlot): string {
	const rotation = finiteNumber(slot.rotation, 0);
	const rotate = rotation ? ` rotate(${rotation} ${slot.width / 2} ${slot.height / 2})` : '';
	return `translate(${slot.x} ${slot.y})${rotate}`;
}

function slotContentElementsJson(
	content: TableSlotContent,
	assets: TableSvgAssets,
	x: number,
	y: number
): TableSvgElementJson[] {
	const cardSvg = requireSlotContentCardSvg(assets, content);
	const size = slotContentVisualSize(content, assets);
	return [
		...(content.type === 'deck' ? boundedDeckStackElementsJson(size, x, y) : []),
		cardImageElementJson(cardSvg, size, x, y)
	];
}

function fixedSlotCellSize(slot: TableSlot) {
	const layout = slot.layout;
	if (layout?.mode === 'grid') {
		return {
			width: positiveNumber(
				(slot.width - Math.max(0, layout.columns - 1) * layout.gapX) / layout.columns,
				LEGACY_CARD_SIZE.width
			),
			height: positiveNumber(
				(slot.height - Math.max(0, layout.rows - 1) * layout.gapY) / layout.rows,
				LEGACY_CARD_SIZE.height
			)
		};
	}
	if (layout?.mode === 'horizontal-flex') {
		return {
			width: positiveNumber(
				(slot.width - Math.max(0, layout.visibleCount - 1) * layout.gap) / layout.visibleCount,
				LEGACY_CARD_SIZE.width
			),
			height: positiveNumber(slot.height, LEGACY_CARD_SIZE.height)
		};
	}
	return {
		width: positiveNumber(slot.width, LEGACY_CARD_SIZE.width),
		height: positiveNumber(slot.height, LEGACY_CARD_SIZE.height)
	};
}

function fixedSlotCellPosition(slot: TableSlot, index: number) {
	const layout = slot.layout;
	const cellSize = fixedSlotCellSize(slot);
	if (layout?.mode === 'grid') {
		const column = index % layout.columns;
		const row = Math.floor(index / layout.columns);
		return {
			x: column * (cellSize.width + layout.gapX),
			y: row * (cellSize.height + layout.gapY)
		};
	}
	if (layout?.mode === 'horizontal-flex') {
		return { x: index * (cellSize.width + layout.gap), y: 0 };
	}
	return { x: 0, y: 0 };
}

function fixedSlotChildrenJson(item: TableSlot, assets: TableSvgAssets): TableSvgElementJson[] {
	const slot = resolveTableSlotSize(item, assets);
	const layout = slot.layout;
	if (layout?.mode !== 'horizontal-flex' && layout?.mode !== 'grid') return [];
	const capacity = slotLayoutCapacity(layout);
	return [
		{
			element: 'title',
			children: [slot.label]
		},
		{
			element: 'rect',
			attr: {
				x: 0,
				y: 0,
				width: slot.width,
				height: slot.height,
				rx: 12,
				fill: '#eff6ff',
				'fill-opacity': 0.22,
				stroke: '#2563eb',
				'stroke-width': 3,
				'stroke-dasharray': '12 8',
				...lockedAttrs()
			}
		},
		...Array.from({ length: capacity }).map((_, index) => ({
			element: 'rect',
			attr: {
				...fixedSlotCellPosition(slot, index),
				width: fixedSlotCellSize(slot).width,
				height: fixedSlotCellSize(slot).height,
				rx: 10,
				fill: '#f8fafc',
				'fill-opacity': 0.55,
				stroke: '#2563eb',
				'stroke-opacity': 0.48,
				'stroke-width': 2,
				...lockedAttrs()
			}
		})),
		...(slot.contents ?? []).flatMap((content, index) => {
			const position = fixedSlotCellPosition(slot, content.cellIndex ?? index);
			return slotContentElementsJson(content, assets, position.x, position.y);
		})
	];
}

export function slotToSvgElementJson(
	item: TableSlot,
	assets: TableSvgAssets = {}
): TableSvgElementJson {
	const slot = resolveTableSlotSize(item, assets);
	if (slot.layout?.mode === 'horizontal-flex' || slot.layout?.mode === 'grid') {
		return {
			element: 'g',
			attr: slotAttributes(slot),
			children: fixedSlotChildrenJson(slot, assets)
		};
	}
	return {
		element: 'g',
		attr: slotAttributes(slot),
		children: [
			{
				element: 'rect',
				attr: {
					x: 0,
					y: 0,
					width: slot.width,
					height: slot.height,
					rx: 14,
					fill: '#dbeafe',
					'fill-opacity': 0.32,
					stroke: '#2563eb',
					'stroke-width': 4,
					'stroke-dasharray': '14 10'
				}
			},
			{
				element: 'text',
				attr: {
					x: 16,
					y: 32,
					fill: '#1e3a8a',
					'font-family': 'system-ui, sans-serif',
					'font-size': 28,
					'font-weight': 700,
					...lockedTextAttrs()
				},
				children: [slot.label]
			}
		]
	};
}

export function placementToSvgElementJson(
	item: TablePlacement,
	assets: TableSvgAssets = {}
): TableSvgElementJson {
	const size = placementVisualSize(item, assets);
	const placement = snapPlacementToGrid(item, size);
	const kind = item.type;
	const cardSvg = requirePlacementCardSvg(assets, placement);
	const attr: Record<string, string | number> = {
		id: placement.id,
		[KIND_ATTR]: 'placement',
		[TYPE_ATTR]: kind,
		[DECK_ATTR]: placement.deckName,
		[LABEL_ATTR]: placement.label,
		[RESIZABLE_ATTR]: 'false',
		transform: placementTransform(placement, size)
	};
	if (placement.type === 'card') {
		attr[CARD_ATTR] = placement.cardId;
	}
	if (placement.type === 'deck') {
		attr[CARD_IDS_ATTR] = JSON.stringify(placement.cardIds);
		if (placement.shuffle) attr[INITIAL_SHUFFLE_ATTR] = 'true';
	}
	const visual = [
		...(placement.type === 'deck' ? deckStackElementsJson(size) : []),
		cardImageElementJson(cardSvg, size)
	];

	return {
		element: 'g',
		attr,
		children: visual
	};
}

function placementTransform(placement: TablePlacement, size: CardVisualSize): string {
	const transformX = placement.x - size.width / 2;
	const transformY = placement.y - size.height / 2;
	return `translate(${transformX} ${transformY}) rotate(${placement.rotation} ${size.width / 2} ${size.height / 2})`;
}
