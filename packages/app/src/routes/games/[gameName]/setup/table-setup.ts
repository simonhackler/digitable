export type TablePresetId = 'two-player' | 'four-player' | 'six-player' | 'square' | 'custom';

export type TablePreset = {
	id: TablePresetId;
	name: string;
	width: number;
	height: number;
};

export type SetupPlacement =
	| {
			id: string;
			type: 'deck';
			deckName: string;
			cardIds: string[];
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

export type SetupSlotLayout =
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

export type SetupSlotContent =
	| { type: 'deck'; deckName: string; cellIndex?: number }
	| { type: 'card'; deckName: string; cardId: string; cellIndex?: number };

export type SetupSlot = {
	id: string;
	label: string;
	x: number;
	y: number;
	rotation?: number;
	width: number;
	height: number;
	acceptedDeckNames: string[];
	acceptedCardIds: string[];
	layout?: SetupSlotLayout;
	contents?: SetupSlotContent[];
};

export type TableSetup = {
	version: 1;
	table: {
		presetId: TablePresetId;
		width: number;
		height: number;
	};
	placements: SetupPlacement[];
	slots: SetupSlot[];
};

export type TableSetupSvgAssets = {
	placementCardSvgs?: ReadonlyMap<string, string> | Record<string, string>;
	cardSvgs?: ReadonlyMap<string, string> | Record<string, string>;
	deckTopCardIds?: ReadonlyMap<string, string> | Record<string, string>;
	cardLabels?: ReadonlyMap<string, string> | Record<string, string>;
};

export type SetupSvgJson =
	| string
	| {
			element: string;
			attr?: Record<string, string | number>;
			children?: SetupSvgJson[];
	  };

export type SetupSvgElementJson = Exclude<SetupSvgJson, string>;

export const SETUP_SVG_PATH = 'setup/table.svg';
const TABLE_ATTR = 'data-digitable-table';
const KIND_ATTR = 'data-digitable-kind';
const TYPE_ATTR = 'data-digitable-type';
const DECK_ATTR = 'data-deck-name';
const CARD_ATTR = 'data-card-id';
const CARD_IDS_ATTR = 'data-card-ids';
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
const LOCKED_ATTRS = `${RESIZABLE_ATTR}="false" data-locked="true"`;
const CARD_WIDTH = 110;
const CARD_HEIGHT = 150;
const DEFAULT_FLEX_VISIBLE_COUNT = 4;
const DEFAULT_FLEX_GAP = 16;
const DEFAULT_GRID_ROWS = 2;
const DEFAULT_GRID_COLUMNS = 2;
const TABLE_GRID_STEP = 20;
const NON_RENDERED_TAGS = new Set(['defs', 'style', 'metadata', 'title', 'desc']);
const LEGACY_TABLE_BACKGROUND_FILL = '#166534';
const LEGACY_TABLE_BORDER_STROKE = '#bbf7d0';

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

export function createDefaultTableSetup(): TableSetup {
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

function setupSlotContent(value: unknown): SetupSlotContent | null {
	if (!value || typeof value !== 'object') return null;
	const input = value as Record<string, unknown>;
	const deckName = typeof input.deckName === 'string' ? input.deckName : '';
	if (!deckName) return null;
	const rawCellIndex = finiteNumber(input.cellIndex, -1);
	const cellIndex = rawCellIndex >= 0 ? Math.floor(rawCellIndex) : undefined;
	const cell = cellIndex === undefined ? {} : { cellIndex };
	if (input.type === 'deck') return { type: 'deck', deckName, ...cell };
	if (input.type === 'card') {
		const cardId = typeof input.cardId === 'string' ? input.cardId : '';
		if (!cardId) return null;
		return { type: 'card', deckName, cardId, ...cell };
	}
	return null;
}

function setupSlotContents(value: unknown): SetupSlotContent[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item) => {
		const parsed = setupSlotContent(item);
		return parsed ? [parsed] : [];
	});
}

function slotContentKey(content: SetupSlotContent): string {
	return content.type === 'deck' ? `deck:${content.deckName}` : `card:${content.cardId}`;
}

function uniqueSlotContents(contents: SetupSlotContent[]): SetupSlotContent[] {
	const seen = new Set<string>();
	return contents.filter((content) => {
		const key = slotContentKey(content);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export function createHorizontalFlexSlotLayout(
	input: Partial<Extract<SetupSlotLayout, { mode: 'horizontal-flex' }>> = {}
): Extract<SetupSlotLayout, { mode: 'horizontal-flex' }> {
	const visibleCount = Math.max(
		1,
		positiveInteger(input.visibleCount, DEFAULT_FLEX_VISIBLE_COUNT)
	);
	const gap = Math.round(nonNegativeNumber(input.gap, DEFAULT_FLEX_GAP));
	return {
		mode: 'horizontal-flex',
		visibleCount,
		gap,
		cardSize: input.cardSize === 'deck-card' ? 'deck-card' : 'content-card'
	};
}

export function createGridSlotLayout(
	input: Partial<Extract<SetupSlotLayout, { mode: 'grid' }>> = {}
): Extract<SetupSlotLayout, { mode: 'grid' }> {
	return {
		mode: 'grid',
		rows: Math.max(1, positiveInteger(input.rows, DEFAULT_GRID_ROWS)),
		columns: Math.max(1, positiveInteger(input.columns, DEFAULT_GRID_COLUMNS)),
		gapX: Math.round(nonNegativeNumber(input.gapX, DEFAULT_FLEX_GAP)),
		gapY: Math.round(nonNegativeNumber(input.gapY, DEFAULT_FLEX_GAP)),
		cardSize: input.cardSize === 'deck-card' ? 'deck-card' : 'content-card'
	};
}

function setupSlotLayout(value: unknown): SetupSlotLayout {
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

function horizontalFlexSlotSize(
	layout: Extract<SetupSlotLayout, { mode: 'horizontal-flex' }>
): { width: number; height: number } {
	return {
		width: layout.visibleCount * CARD_WIDTH + Math.max(0, layout.visibleCount - 1) * layout.gap,
		height: CARD_HEIGHT
	};
}

function gridSlotSize(layout: Extract<SetupSlotLayout, { mode: 'grid' }>): {
	width: number;
	height: number;
} {
	return {
		width: layout.columns * CARD_WIDTH + Math.max(0, layout.columns - 1) * layout.gapX,
		height: layout.rows * CARD_HEIGHT + Math.max(0, layout.rows - 1) * layout.gapY
	};
}

function slotLayoutCapacity(layout: SetupSlotLayout): number {
	if (layout.mode === 'horizontal-flex') return layout.visibleCount;
	if (layout.mode === 'grid') return layout.rows * layout.columns;
	return 0;
}

function contentsForFixedLayout(contents: SetupSlotContent[], layout: SetupSlotLayout) {
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

export function normalizeSetupSlot(slot: SetupSlot): SetupSlot {
	const layout = setupSlotLayout(slot.layout);
	const rotation = finiteNumber(slot.rotation, 0);
	if (layout.mode === 'horizontal-flex') {
		const size = horizontalFlexSlotSize(layout);
		return {
			...slot,
			rotation,
			width: size.width,
			height: size.height,
			layout,
			contents: contentsForFixedLayout(slot.contents ?? [], layout)
		};
	}
	if (layout.mode === 'grid') {
		const size = gridSlotSize(layout);
		return {
			...slot,
			rotation,
			width: size.width,
			height: size.height,
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

export function snapPlacementToGrid<T extends SetupPlacement>(item: T): T {
	const nextX = snapToGrid(item.x - CARD_WIDTH / 2) + CARD_WIDTH / 2;
	const nextY = snapToGrid(item.y - CARD_HEIGHT / 2) + CARD_HEIGHT / 2;
	if (nextX === item.x && nextY === item.y) return item;
	return { ...item, x: nextX, y: nextY };
}

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
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

function parseJsonSlotContents(value: string | null): SetupSlotContent[] {
	if (!value) return [];
	try {
		return setupSlotContents(JSON.parse(value));
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

function slotLayoutFromElement(element: Element): SetupSlotLayout {
	const mode = element.getAttribute(SLOT_LAYOUT_MODE_ATTR);
	if (mode === 'grid') {
		return createGridSlotLayout({
			rows: parseNumberAttribute(element, SLOT_ROWS_ATTR, DEFAULT_GRID_ROWS),
			columns: parseNumberAttribute(element, SLOT_COLUMNS_ATTR, DEFAULT_GRID_COLUMNS),
			gapX: parseNumberAttribute(element, SLOT_GAP_X_ATTR, DEFAULT_FLEX_GAP),
			gapY: parseNumberAttribute(element, SLOT_GAP_Y_ATTR, DEFAULT_FLEX_GAP),
			cardSize: element.getAttribute(SLOT_CARD_SIZE_ATTR) === 'deck-card' ? 'deck-card' : 'content-card'
		});
	}
	if (mode !== 'horizontal-flex') return { mode: 'free' };
	return createHorizontalFlexSlotLayout({
		visibleCount: parseNumberAttribute(element, SLOT_VISIBLE_COUNT_ATTR, DEFAULT_FLEX_VISIBLE_COUNT),
		gap: parseNumberAttribute(element, SLOT_GAP_ATTR, DEFAULT_FLEX_GAP),
		cardSize: element.getAttribute(SLOT_CARD_SIZE_ATTR) === 'deck-card' ? 'deck-card' : 'content-card'
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
	if (!transform.matrix || (Math.abs(transform.matrix.b) < 0.000001 && Math.abs(transform.matrix.c) < 0.000001)) {
		return { x: transform.x, y: transform.y };
	}
	const { a, b, c, d, e, f } = transform.matrix;
	return {
		x: roundedSvgNumber(e - (origin.x - a * origin.x - c * origin.y)),
		y: roundedSvgNumber(f - (origin.y - b * origin.x - d * origin.y))
	};
}

function visualBoundsOrigin(group: Element): { x: number; y: number; hasGraphics: boolean } {
	const graphics = Array.from(group.getElementsByTagName('*')).filter((element) => {
		const tag = element.tagName.toLowerCase();
		return tag === 'rect' || tag === 'image';
	});
	const xValues = graphics.map((element) => parseNumberAttribute(element, 'x', 0));
	const yValues = graphics.map((element) => parseNumberAttribute(element, 'y', 0));
	return {
		x: xValues.length > 0 ? Math.min(...xValues) : 0,
		y: yValues.length > 0 ? Math.min(...yValues) : 0,
		hasGraphics: graphics.length > 0
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

function isLegacyTableBackground(element: Element): boolean {
	if (element.tagName.toLowerCase() !== 'rect') return false;
	return (
		element.getAttribute('fill') === LEGACY_TABLE_BACKGROUND_FILL ||
		element.getAttribute('stroke') === LEGACY_TABLE_BORDER_STROKE
	);
}

function removeLegacyTableBackground(root: Element) {
	const children = Array.from(root.childNodes).filter(
		(child): child is Element => child.nodeType === 1
	);
	for (const child of children) {
		if (isLegacyTableBackground(child)) child.parentNode?.removeChild(child);
	}
}

function hasCustomTableContentElement(element: Element, root: Element): boolean {
	const tag = element.tagName.toLowerCase();
	if (NON_RENDERED_TAGS.has(tag)) return false;
	if (element.hasAttribute(KIND_ATTR)) return false;
	if (element !== root && isLegacyTableBackground(element)) return false;
	const children = Array.from(element.children);
	if ((element === root || tag === 'g' || tag === 'svg') && children.length > 0) {
		return children.some((child) => hasCustomTableContentElement(child, root));
	}
	return element !== root;
}

export function svgHasCustomTableContent(svg: string): boolean {
	const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
	const root = doc.documentElement;
	if (!root || root.tagName.toLowerCase() !== 'svg') return false;
	return hasCustomTableContentElement(root, root);
}

function svgRootToTableSetup(root: Element, fallback: TableSetup): TableSetup {
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

	const placements = elementsByKind(root, 'placement').flatMap((group): SetupPlacement[] => {
		const id = group.getAttribute('id') ?? crypto.randomUUID();
		const type = group.getAttribute(TYPE_ATTR);
		const deckName = group.getAttribute(DECK_ATTR) ?? '';
		const cardIds = parseJsonStringArray(group.getAttribute(CARD_IDS_ATTR));
		const transform = transformParts(group.getAttribute('transform'));
		if (!deckName) return [];
		const origin = visualBoundsOrigin(group);
		const topLeftGeometry = origin.hasGraphics && origin.x >= 0 && origin.y >= 0;
		const groupTranslation = transformTranslationForRotationOrigin(transform, {
			x: CARD_WIDTH / 2,
			y: CARD_HEIGHT / 2
		});
		const base = {
			id,
			deckName,
			x: topLeftGeometry
				? groupTranslation.x + origin.x * transform.scaleX + CARD_WIDTH / 2
				: groupTranslation.x,
			y: topLeftGeometry
				? groupTranslation.y + origin.y * transform.scaleY + CARD_HEIGHT / 2
				: groupTranslation.y,
			rotation: transform.rotation,
			label: textLabel(group, deckName)
		};
		if (type === 'deck') return [snapPlacementToGrid({ ...base, type, cardIds })];
		if (type === 'card') {
			const cardId = group.getAttribute(CARD_ATTR) ?? '';
			if (!cardId) return [];
			return [snapPlacementToGrid({ ...base, type, cardId })];
		}
		return [];
	});

	const slots = elementsByKind(root, 'slot').flatMap((group): SetupSlot[] => {
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
			normalizeSetupSlot({
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

export function svgElementToTableSetup(
	root: Element | null | undefined,
	fallback = createDefaultTableSetup()
): TableSetup {
	if (!root) return fallback;
	return svgRootToTableSetup(root, fallback);
}

export function svgToTableSetup(svg: string, fallback = createDefaultTableSetup()): TableSetup {
	const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
	return svgElementToTableSetup(doc.documentElement, fallback);
}

export function normalizeTableSvg(
	svg: string,
	setup: TableSetup,
	assets: TableSetupSvgAssets = {}
): string {
	return normalizeTableSvgWithAssets(svg, setup, assets);
}

export function normalizeTableSvgWithAssets(
	svg: string,
	setup: TableSetup,
	assets: TableSetupSvgAssets = {}
): string {
	const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
	const root = doc.documentElement;
	if (!root || root.tagName.toLowerCase() !== 'svg') return setupToSvg(setup, assets);

	root.setAttribute('width', String(setup.table.width));
	root.setAttribute('height', String(setup.table.height));
	root.setAttribute('viewBox', `0 0 ${setup.table.width} ${setup.table.height}`);
	root.setAttribute('role', 'img');
	root.setAttribute('aria-label', 'Digitable table setup');
	root.setAttribute(TABLE_ATTR, 'true');
	root.setAttribute(PRESET_ATTR, setup.table.presetId);

	removeLegacyTableBackground(root);
	syncGeneratedElements(doc, root, setup, assets);

	return new XMLSerializer().serializeToString(root);
}

type SvgAssetMap = ReadonlyMap<string, string> | Record<string, string> | undefined;

function isReadonlyMap(value: SvgAssetMap): value is ReadonlyMap<string, string> {
	return typeof (value as { get?: unknown } | undefined)?.get === 'function';
}

function svgAssetValue(source: SvgAssetMap, key: string): string | null {
	if (!source) return null;
	if (isReadonlyMap(source)) return source.get(key) ?? null;
	return source[key] ?? null;
}

function placementCardSvg(assets: TableSetupSvgAssets, placementId: string): string | null {
	return svgAssetValue(assets.placementCardSvgs, placementId);
}

function slotContentCardSvg(assets: TableSetupSvgAssets, content: SetupSlotContent): string | null {
	if (content.type === 'card') return svgAssetValue(assets.cardSvgs, content.cardId);
	const topCardId = svgAssetValue(assets.deckTopCardIds, content.deckName);
	return topCardId ? svgAssetValue(assets.cardSvgs, topCardId) : null;
}

function slotContentLabel(assets: TableSetupSvgAssets, content: SetupSlotContent): string {
	if (content.type === 'deck') return content.deckName;
	return svgAssetValue(assets.cardLabels, content.cardId) ?? content.cardId;
}

function cardImageHref(cardSvg: string): string {
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardSvg)}`;
}

function cardImageElementJson(cardSvg: string, x = 0, y = 0): SetupSvgElementJson {
	return {
		element: 'image',
		attr: {
			x,
			y,
			width: CARD_WIDTH,
			height: CARD_HEIGHT,
			preserveAspectRatio: 'xMidYMid meet',
			href: cardImageHref(cardSvg),
			...lockedAttrs()
		}
	};
}

function cardImageMarkup(cardSvg: string, x = 0, y = 0): string {
	const href = cardImageHref(cardSvg);
	return `<image x="${x}" y="${y}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" preserveAspectRatio="xMidYMid meet" href="${escapeXml(href)}" ${LOCKED_ATTRS}/>`;
}

function deckStackElementsJson(x = 0, y = 0): SetupSvgElementJson[] {
	return [
		{
			element: 'rect',
			attr: {
				x: x + 14,
				y: y + 14,
				width: CARD_WIDTH,
				height: CARD_HEIGHT,
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
				x: x + 7,
				y: y + 7,
				width: CARD_WIDTH,
				height: CARD_HEIGHT,
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

function deckStackMarkup(): string[] {
	return [
		`    <rect x="14" y="14" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="10" fill="#0f172a" fill-opacity="0.28" stroke="#0f172a" stroke-opacity="0.45" stroke-width="2" ${DECK_STACK_ATTR}="true" ${LOCKED_ATTRS}/>`,
		`    <rect x="7" y="7" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="10" fill="#f8fafc" stroke="#334155" stroke-opacity="0.65" stroke-width="2" ${DECK_STACK_ATTR}="true" ${LOCKED_ATTRS}/>`
	];
}

function boundedDeckStackElementsJson(x = 0, y = 0): SetupSvgElementJson[] {
	return [
		{
			element: 'rect',
			attr: {
				x: x + 8,
				y: y + 8,
				width: CARD_WIDTH - 8,
				height: CARD_HEIGHT - 8,
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
				x: x + 4,
				y: y + 4,
				width: CARD_WIDTH - 4,
				height: CARD_HEIGHT - 4,
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

function boundedDeckStackMarkup(x = 0, y = 0): string[] {
	return [
		`    <rect x="${x + 8}" y="${y + 8}" width="${CARD_WIDTH - 8}" height="${CARD_HEIGHT - 8}" rx="10" fill="#0f172a" fill-opacity="0.24" stroke="#0f172a" stroke-opacity="0.4" stroke-width="2" ${DECK_STACK_ATTR}="true" ${LOCKED_ATTRS}/>`,
		`    <rect x="${x + 4}" y="${y + 4}" width="${CARD_WIDTH - 4}" height="${CARD_HEIGHT - 4}" rx="10" fill="#f8fafc" stroke="#334155" stroke-opacity="0.55" stroke-width="2" ${DECK_STACK_ATTR}="true" ${LOCKED_ATTRS}/>`
	];
}

function fallbackPlacementElementsJson(
	item: SetupPlacement,
	label: string,
	kind: string,
	x = 0,
	y = 0
) {
	const fill = item.type === 'deck' ? '#fef3c7' : '#f0fdf4';
	const stroke = item.type === 'deck' ? '#b45309' : '#15803d';
	return [
		...(item.type === 'deck' ? deckStackElementsJson(x, y) : []),
		{
			element: 'rect',
			attr: {
				x,
				y,
				width: CARD_WIDTH,
				height: CARD_HEIGHT,
				rx: 10,
				fill,
				stroke,
				'stroke-width': 3,
				...lockedAttrs()
			}
		},
		{
			element: 'text',
			attr: {
				x: x + CARD_WIDTH / 2,
				y: y + CARD_HEIGHT / 2 - 6,
				'text-anchor': 'middle',
				fill: '#111827',
				'font-family': 'system-ui, sans-serif',
				'font-size': 20,
				'font-weight': 700,
				...lockedTextAttrs()
			},
			children: [label]
		},
		{
			element: 'text',
			attr: {
				x: x + CARD_WIDTH / 2,
				y: y + CARD_HEIGHT / 2 + 24,
				'text-anchor': 'middle',
				fill: '#4b5563',
				'font-family': 'system-ui, sans-serif',
				'font-size': 16,
				...lockedTextAttrs()
			},
			children: [kind]
		}
	];
}

function fallbackPlacementMarkup(item: SetupPlacement, label: string, kind: string): string[] {
	const fill = item.type === 'deck' ? '#fef3c7' : '#f0fdf4';
	const stroke = item.type === 'deck' ? '#b45309' : '#15803d';
	return [
		...(item.type === 'deck' ? deckStackMarkup() : []),
		`    <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="3" ${RESIZABLE_ATTR}="false"/>`,
		`    <text x="${CARD_WIDTH / 2}" y="${CARD_HEIGHT / 2 - 6}" text-anchor="middle" fill="#111827" font-family="system-ui, sans-serif" font-size="20" font-weight="700" ${LOCKED_ATTRS} style="pointer-events:none;user-select:none">${label}</text>`,
		`    <text x="${CARD_WIDTH / 2}" y="${CARD_HEIGHT / 2 + 24}" text-anchor="middle" fill="#4b5563" font-family="system-ui, sans-serif" font-size="16" ${LOCKED_ATTRS} style="pointer-events:none;user-select:none">${kind}</text>`
	];
}

function slotAttributes(item: SetupSlot): Record<string, string | number> {
	const slot = normalizeSetupSlot(item);
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

function slotTransform(slot: SetupSlot): string {
	const rotation = finiteNumber(slot.rotation, 0);
	const rotate = rotation ? ` rotate(${rotation} ${slot.width / 2} ${slot.height / 2})` : '';
	return `translate(${slot.x} ${slot.y})${rotate}`;
}

function fallbackSlotContentElementsJson(
	content: SetupSlotContent,
	label: string,
	x: number,
	y: number
): SetupSvgElementJson[] {
	const fill = content.type === 'deck' ? '#fef3c7' : '#f0fdf4';
	const stroke = content.type === 'deck' ? '#b45309' : '#15803d';
	return [
		...(content.type === 'deck' ? boundedDeckStackElementsJson(x, y) : []),
		{
			element: 'rect',
			attr: {
				x,
				y,
				width: CARD_WIDTH,
				height: CARD_HEIGHT,
				rx: 10,
				fill,
				stroke,
				'stroke-width': 3,
				...lockedAttrs()
			}
		},
		{
			element: 'text',
			attr: {
				x: x + CARD_WIDTH / 2,
				y: y + CARD_HEIGHT / 2 - 6,
				'text-anchor': 'middle',
				fill: '#111827',
				'font-family': 'system-ui, sans-serif',
				'font-size': 18,
				'font-weight': 700,
				...lockedTextAttrs()
			},
			children: [label]
		},
		{
			element: 'text',
			attr: {
				x: x + CARD_WIDTH / 2,
				y: y + CARD_HEIGHT / 2 + 22,
				'text-anchor': 'middle',
				fill: '#4b5563',
				'font-family': 'system-ui, sans-serif',
				'font-size': 15,
				...lockedTextAttrs()
			},
			children: [content.type]
		}
	];
}

function slotContentElementsJson(
	content: SetupSlotContent,
	assets: TableSetupSvgAssets,
	x: number,
	y: number
): SetupSvgElementJson[] {
	const cardSvg = slotContentCardSvg(assets, content);
	if (!cardSvg) return fallbackSlotContentElementsJson(content, slotContentLabel(assets, content), x, y);
	return [
		...(content.type === 'deck' ? boundedDeckStackElementsJson(x, y) : []),
		cardImageElementJson(cardSvg, x, y)
	];
}

function fixedSlotCellPosition(slot: SetupSlot, index: number) {
	const layout = slot.layout;
	if (layout?.mode === 'grid') {
		const column = index % layout.columns;
		const row = Math.floor(index / layout.columns);
		return {
			x: column * (CARD_WIDTH + layout.gapX),
			y: row * (CARD_HEIGHT + layout.gapY)
		};
	}
	if (layout?.mode === 'horizontal-flex') {
		return { x: index * (CARD_WIDTH + layout.gap), y: 0 };
	}
	return { x: 0, y: 0 };
}

function fixedSlotChildrenJson(item: SetupSlot, assets: TableSetupSvgAssets): SetupSvgElementJson[] {
	const slot = normalizeSetupSlot(item);
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
				width: CARD_WIDTH,
				height: CARD_HEIGHT,
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
	item: SetupSlot,
	assets: TableSetupSvgAssets = {}
): SetupSvgElementJson {
	const slot = normalizeSetupSlot(item);
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
	item: SetupPlacement,
	assets: TableSetupSvgAssets = {}
): SetupSvgElementJson {
	const placement = snapPlacementToGrid(item);
	const kind = item.type;
	const cardSvg = placementCardSvg(assets, placement.id);
	const attr: Record<string, string | number> = {
		id: placement.id,
		[KIND_ATTR]: 'placement',
		[TYPE_ATTR]: kind,
		[DECK_ATTR]: placement.deckName,
		[LABEL_ATTR]: placement.label,
		[RESIZABLE_ATTR]: 'false'
	};
	if (placement.type === 'card') {
		attr[CARD_ATTR] = placement.cardId;
	}
	if (placement.type === 'deck') {
		attr[CARD_IDS_ATTR] = JSON.stringify(placement.cardIds);
	}
	const visualX = placement.x - CARD_WIDTH / 2;
	const visualY = placement.y - CARD_HEIGHT / 2;
	const visual = cardSvg
		? [
				...(placement.type === 'deck' ? deckStackElementsJson(visualX, visualY) : []),
				cardImageElementJson(cardSvg, visualX, visualY)
			]
		: fallbackPlacementElementsJson(placement, placement.label, kind, visualX, visualY);
	if (placement.rotation) {
		attr.transform = `rotate(${placement.rotation} ${placement.x} ${placement.y})`;
	}

	return {
		element: 'g',
		attr,
		children: visual
	};
}

function slotAttributesMarkup(item: SetupSlot): string {
	const slot = normalizeSetupSlot(item);
	const label = escapeXml(slot.label);
	const base = [
		`id="${escapeXml(slot.id)}"`,
		`${KIND_ATTR}="slot"`,
		`${LABEL_ATTR}="${label}"`,
		`${ACCEPTED_DECKS_ATTR}="${escapeXml(JSON.stringify(sortedStrings(slot.acceptedDeckNames)))}"`,
		`${ACCEPTED_CARDS_ATTR}="${escapeXml(JSON.stringify(sortedStrings(slot.acceptedCardIds)))}"`,
		`${SLOT_LAYOUT_MODE_ATTR}="${slot.layout?.mode ?? 'free'}"`
	];
	if (slot.layout?.mode === 'horizontal-flex') {
		base.push(`${RESIZABLE_ATTR}="false"`);
		base.push(`${SLOT_VISIBLE_COUNT_ATTR}="${slot.layout.visibleCount}"`);
		base.push(`${SLOT_GAP_ATTR}="${slot.layout.gap}"`);
		base.push(`${SLOT_CARD_SIZE_ATTR}="${slot.layout.cardSize}"`);
		base.push(`${SLOT_CONTENTS_ATTR}="${escapeXml(JSON.stringify(slot.contents ?? []))}"`);
	}
	if (slot.layout?.mode === 'grid') {
		base.push(`${RESIZABLE_ATTR}="false"`);
		base.push(`${SLOT_ROWS_ATTR}="${slot.layout.rows}"`);
		base.push(`${SLOT_COLUMNS_ATTR}="${slot.layout.columns}"`);
		base.push(`${SLOT_GAP_X_ATTR}="${slot.layout.gapX}"`);
		base.push(`${SLOT_GAP_Y_ATTR}="${slot.layout.gapY}"`);
		base.push(`${SLOT_CARD_SIZE_ATTR}="${slot.layout.cardSize}"`);
		base.push(`${SLOT_CONTENTS_ATTR}="${escapeXml(JSON.stringify(slot.contents ?? []))}"`);
	}
	base.push(`transform="${slotTransform(slot)}"`);
	return base.join(' ');
}

function fallbackSlotContentMarkup(
	content: SetupSlotContent,
	label: string,
	x: number,
	y: number
): string[] {
	const fill = content.type === 'deck' ? '#fef3c7' : '#f0fdf4';
	const stroke = content.type === 'deck' ? '#b45309' : '#15803d';
	return [
		...(content.type === 'deck' ? boundedDeckStackMarkup(x, y) : []),
		`    <rect x="${x}" y="${y}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="3" ${LOCKED_ATTRS}/>`,
		`    <text x="${x + CARD_WIDTH / 2}" y="${y + CARD_HEIGHT / 2 - 6}" text-anchor="middle" fill="#111827" font-family="system-ui, sans-serif" font-size="18" font-weight="700" ${LOCKED_ATTRS} style="pointer-events:none;user-select:none">${escapeXml(label)}</text>`,
		`    <text x="${x + CARD_WIDTH / 2}" y="${y + CARD_HEIGHT / 2 + 22}" text-anchor="middle" fill="#4b5563" font-family="system-ui, sans-serif" font-size="15" ${LOCKED_ATTRS} style="pointer-events:none;user-select:none">${content.type}</text>`
	];
}

function slotContentMarkup(
	content: SetupSlotContent,
	assets: TableSetupSvgAssets,
	x: number,
	y: number
): string[] {
	const cardSvg = slotContentCardSvg(assets, content);
	if (!cardSvg) return fallbackSlotContentMarkup(content, slotContentLabel(assets, content), x, y);
	return [
		...(content.type === 'deck' ? boundedDeckStackMarkup(x, y) : []),
		`    ${cardImageMarkup(cardSvg, x, y)}`
	];
}

function slotMarkup(item: SetupSlot, assets: TableSetupSvgAssets): string {
	const slot = normalizeSetupSlot(item);
	const label = escapeXml(slot.label);
	const layout = slot.layout;
	if (layout?.mode === 'horizontal-flex' || layout?.mode === 'grid') {
		const capacity = slotLayoutCapacity(layout);
		const cells = Array.from({ length: capacity }).map((_, index) => {
			const { x, y } = fixedSlotCellPosition(slot, index);
			return `    <rect x="${x}" y="${y}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="10" fill="#f8fafc" fill-opacity="0.55" stroke="#2563eb" stroke-opacity="0.48" stroke-width="2" ${LOCKED_ATTRS}/>`;
		});
		const contents = (slot.contents ?? []).flatMap((content, index) => {
			const { x, y } = fixedSlotCellPosition(slot, content.cellIndex ?? index);
			return slotContentMarkup(content, assets, x, y);
		});
		return [
			`  <g ${slotAttributesMarkup(slot)}>`,
			`    <title>${label}</title>`,
			`    <rect x="0" y="0" width="${slot.width}" height="${slot.height}" rx="12" fill="#eff6ff" fill-opacity="0.22" stroke="#2563eb" stroke-width="3" stroke-dasharray="12 8" ${LOCKED_ATTRS}/>`,
			...cells,
			...contents,
			'  </g>'
		].join('\n');
	}
	return [
		`  <g ${slotAttributesMarkup(slot)}>`,
		`    <rect x="0" y="0" width="${slot.width}" height="${slot.height}" rx="14" fill="#dbeafe" fill-opacity="0.32" stroke="#2563eb" stroke-width="4" stroke-dasharray="14 10"/>`,
		`    <text x="16" y="32" fill="#1e3a8a" font-family="system-ui, sans-serif" font-size="28" font-weight="700" ${LOCKED_ATTRS} style="pointer-events:none;user-select:none">${label}</text>`,
		'  </g>'
	].join('\n');
}

function placementMarkup(item: SetupPlacement, assets: TableSetupSvgAssets): string {
	const placement = snapPlacementToGrid(item);
	const label = escapeXml(placement.label);
	const kind = escapeXml(placement.type);
	const cardAttrs =
		placement.type === 'card' ? ` ${CARD_ATTR}="${escapeXml(placement.cardId)}"` : '';
	const deckAttrs =
		placement.type === 'deck'
			? ` ${CARD_IDS_ATTR}="${escapeXml(JSON.stringify(placement.cardIds))}"`
			: '';
	const cardSvg = placementCardSvg(assets, placement.id);
	const visual = cardSvg
		? [
				...(placement.type === 'deck' ? deckStackMarkup() : []),
				`    ${cardImageMarkup(cardSvg)}`
			]
		: fallbackPlacementMarkup(placement, label, kind);
	const transformX = placement.x - CARD_WIDTH / 2;
	const transformY = placement.y - CARD_HEIGHT / 2;

	return [
		`  <g id="${escapeXml(placement.id)}" ${KIND_ATTR}="placement" ${TYPE_ATTR}="${kind}" ${DECK_ATTR}="${escapeXml(placement.deckName)}"${cardAttrs}${deckAttrs} ${LABEL_ATTR}="${label}" ${RESIZABLE_ATTR}="false" transform="translate(${transformX} ${transformY}) rotate(${placement.rotation} ${CARD_WIDTH / 2} ${CARD_HEIGHT / 2})">`,
		...visual,
		'  </g>'
	].join('\n');
}

function parseGeneratedMarkup(doc: Document, markup: string): Element | null {
	const parsed = new DOMParser().parseFromString(
		`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,
		'image/svg+xml'
	);
	const element = parsed.documentElement.firstElementChild;
	if (!element) return null;
	if (typeof doc.importNode === 'function') return doc.importNode(element, true) as Element;
	return element.cloneNode(true) as Element;
}

function replaceOrAppendGenerated(
	doc: Document,
	parent: Element,
	existing: Element | null,
	markup: string
) {
	const next = parseGeneratedMarkup(doc, markup);
	if (!next) return;
	if (existing?.parentNode) {
		existing.parentNode.replaceChild(next, existing);
		return;
	}
	parent.appendChild(next);
}

function syncGeneratedElements(
	doc: Document,
	root: Element,
	setup: TableSetup,
	assets: TableSetupSvgAssets
) {
	const slotIds = new Set(setup.slots.map((slot) => slot.id));
	const placementIds = new Set(setup.placements.map((placement) => placement.id));
	const existingSlots = elementsByKind(root, 'slot');
	const existingPlacements = elementsByKind(root, 'placement');
	const generatedParent =
		existingSlots[0]?.parentElement ?? existingPlacements[0]?.parentElement ?? root;

	for (const element of existingSlots) {
		const id = element.getAttribute('id');
		if (!id || !slotIds.has(id)) element.parentNode?.removeChild(element);
	}
	for (const element of existingPlacements) {
		const id = element.getAttribute('id');
		if (!id || !placementIds.has(id)) element.parentNode?.removeChild(element);
	}
	for (const slot of setup.slots) {
		replaceOrAppendGenerated(
			doc,
			generatedParent,
			elementsByKind(root, 'slot').find((element) => element.getAttribute('id') === slot.id) ??
				null,
			slotMarkup(slot, assets)
		);
	}
	for (const placement of setup.placements) {
		replaceOrAppendGenerated(
			doc,
			generatedParent,
			elementsByKind(root, 'placement').find(
				(element) => element.getAttribute('id') === placement.id
			) ?? null,
			placementMarkup(placement, assets)
		);
	}
}

export function setupToSvg(setup: TableSetup, assets: TableSetupSvgAssets = {}): string {
	const width = setup.table.width;
	const height = setup.table.height;
	const slotsMarkup = setup.slots.map((item) => slotMarkup(item, assets)).join('\n');
	const placementsMarkup = setup.placements.map((item) => placementMarkup(item, assets)).join('\n');

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Digitable table setup" ${TABLE_ATTR}="true" ${PRESET_ATTR}="${escapeXml(setup.table.presetId)}">`,
		slotsMarkup,
		placementsMarkup,
		'</svg>',
		''
	]
		.filter((line) => line !== '')
		.join('\n');
}
