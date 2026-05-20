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

export type SetupSlot = {
	id: string;
	label: string;
	x: number;
	y: number;
	width: number;
	height: number;
	acceptedDeckNames: string[];
	acceptedCardIds: string[];
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
};

export type SetupSvgJson =
	| string
	| {
			element: string;
			attr?: Record<string, string | number>;
			children?: SetupSvgJson[];
	  };

export type SetupSvgElementJson = Exclude<SetupSvgJson, string>;

export const SETUP_JSON_PATH = 'setup/table.json';
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
const DECK_STACK_ATTR = 'data-deck-stack';
const LOCKED_ATTRS = `${RESIZABLE_ATTR}="false" data-locked="true"`;
const CARD_WIDTH = 110;
const CARD_HEIGHT = 150;
const LEGACY_TABLE_BACKGROUND_FILL = '#166534';
const LEGACY_TABLE_BORDER_STROKE = '#bbf7d0';

const nonResizableAttrs = () => ({ [RESIZABLE_ATTR]: 'false' });
const lockedAttrs = () => ({ ...nonResizableAttrs(), 'data-locked': 'true' });

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

function stringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === 'string');
}

function presetId(value: unknown): TablePresetId {
	if (typeof value !== 'string') return defaultPreset.id;
	const preset = tablePresets.find((candidate) => candidate.id === value);
	return preset?.id ?? defaultPreset.id;
}

function placement(value: unknown): SetupPlacement | null {
	if (!value || typeof value !== 'object') return null;
	const input = value as Record<string, unknown>;
	const id = typeof input.id === 'string' ? input.id : '';
	const deckName = typeof input.deckName === 'string' ? input.deckName : '';
	const label = typeof input.label === 'string' ? input.label : deckName;
	const type = input.type;
	if (!id || !deckName) return null;
	const base = {
		id,
		deckName,
		x: finiteNumber(input.x, 0),
		y: finiteNumber(input.y, 0),
		rotation: finiteNumber(input.rotation, 0),
		label
	};
	if (type === 'deck') {
		return {
			...base,
			type,
			cardIds: stringArray(input.cardIds)
		};
	}
	if (type === 'card') {
		const cardId = typeof input.cardId === 'string' ? input.cardId : '';
		if (!cardId) return null;
		return {
			...base,
			type,
			cardId
		};
	}
	return null;
}

function slot(value: unknown): SetupSlot | null {
	if (!value || typeof value !== 'object') return null;
	const input = value as Record<string, unknown>;
	const id = typeof input.id === 'string' ? input.id : '';
	const label = typeof input.label === 'string' ? input.label : 'Slot';
	if (!id) return null;
	return {
		id,
		label,
		x: finiteNumber(input.x, 0),
		y: finiteNumber(input.y, 0),
		width: positiveNumber(input.width, 160),
		height: positiveNumber(input.height, 220),
		acceptedDeckNames: stringArray(input.acceptedDeckNames),
		acceptedCardIds: stringArray(input.acceptedCardIds)
	};
}

export function parseTableSetup(value: unknown): TableSetup {
	if (!value || typeof value !== 'object') return createDefaultTableSetup();
	const input = value as Record<string, unknown>;
	const table = input.table && typeof input.table === 'object' ? input.table : {};
	const tableInput = table as Record<string, unknown>;
	const fallback = createDefaultTableSetup();
	const parsedPresetId = presetId(tableInput.presetId);
	const preset = tablePresets.find((candidate) => candidate.id === parsedPresetId) ?? defaultPreset;
	return {
		version: 1,
		table: {
			presetId: parsedPresetId,
			width: positiveNumber(tableInput.width, preset.width),
			height: positiveNumber(tableInput.height, preset.height)
		},
		placements: Array.isArray(input.placements)
			? input.placements.flatMap((item) => {
					const parsed = placement(item);
					return parsed ? [parsed] : [];
				})
			: fallback.placements,
		slots: Array.isArray(input.slots)
			? input.slots.flatMap((item) => {
					const parsed = slot(item);
					return parsed ? [parsed] : [];
				})
			: fallback.slots
	};
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

function parseNumberAttribute(element: Element | null, name: string, fallback: number): number {
	if (!element) return fallback;
	const value = Number.parseFloat(element.getAttribute(name) ?? '');
	if (!Number.isFinite(value)) return fallback;
	return value;
}

function normalizeEditorDimension(value: number, fallback: number): number {
	if (!Number.isFinite(value) || value <= 0) return fallback;
	if (fallback > 0 && Math.abs(value / fallback - 10) < 0.001) return fallback;
	return value;
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
					: 0
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

export function svgToTableSetup(svg: string, fallback = createDefaultTableSetup()): TableSetup {
	const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
	const root = doc.documentElement;
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
		const cardIds = sortedStrings(parseJsonStringArray(group.getAttribute(CARD_IDS_ATTR)));
		const transform = transformParts(group.getAttribute('transform'));
		if (!deckName) return [];
		const origin = visualBoundsOrigin(group);
		const topLeftGeometry = origin.hasGraphics && origin.x >= 0 && origin.y >= 0;
		const base = {
			id,
			deckName,
			x: topLeftGeometry ? transform.x + origin.x * transform.scaleX + CARD_WIDTH / 2 : transform.x,
			y: topLeftGeometry ? transform.y + origin.y * transform.scaleY + CARD_HEIGHT / 2 : transform.y,
			rotation: transform.rotation,
			label: textLabel(group, deckName)
		};
		if (type === 'deck') return [{ ...base, type, cardIds }];
		if (type === 'card') {
			const cardId = group.getAttribute(CARD_ATTR) ?? '';
			if (!cardId) return [];
			return [{ ...base, type, cardId }];
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
		return [
			{
				id,
				label: textLabel(group, 'Slot'),
				x: transform.x + rectX * transform.scaleX,
				y: transform.y + rectY * transform.scaleY,
				width: positiveNumber(rectWidth * transform.scaleX, 240),
				height: positiveNumber(rectHeight * transform.scaleY, 320),
				acceptedDeckNames: sortedStrings(
					parseJsonStringArray(group.getAttribute(ACCEPTED_DECKS_ATTR))
				),
				acceptedCardIds: sortedStrings(
					parseJsonStringArray(group.getAttribute(ACCEPTED_CARDS_ATTR))
				)
			}
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

export function serializeTableSetup(setup: TableSetup): string {
	const normalized: TableSetup = {
		version: 1,
		table: {
			presetId: setup.table.presetId,
			width: setup.table.width,
			height: setup.table.height
		},
		placements: setup.placements.map((item) =>
			item.type === 'deck' ? { ...item, cardIds: sortedStrings(item.cardIds) } : { ...item }
		),
		slots: setup.slots.map((item) => ({
			...item,
			acceptedDeckNames: sortedStrings(item.acceptedDeckNames),
			acceptedCardIds: sortedStrings(item.acceptedCardIds)
		}))
	};
	return `${JSON.stringify(normalized, null, 2)}\n`;
}

function isReadonlyMap(
	value: TableSetupSvgAssets['placementCardSvgs']
): value is ReadonlyMap<string, string> {
	return typeof (value as { get?: unknown } | undefined)?.get === 'function';
}

function placementCardSvg(assets: TableSetupSvgAssets, placementId: string): string | null {
	const source = assets.placementCardSvgs;
	if (!source) return null;
	if (isReadonlyMap(source)) return source.get(placementId) ?? null;
	return source[placementId] ?? null;
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

function cardImageMarkup(cardSvg: string): string {
	const href = cardImageHref(cardSvg);
	return `<image x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" preserveAspectRatio="xMidYMid meet" href="${escapeXml(href)}" ${LOCKED_ATTRS}/>`;
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
				...lockedAttrs()
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
				...lockedAttrs()
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
		`    <text x="${CARD_WIDTH / 2}" y="${CARD_HEIGHT / 2 - 6}" text-anchor="middle" fill="#111827" font-family="system-ui, sans-serif" font-size="20" font-weight="700" ${LOCKED_ATTRS}>${label}</text>`,
		`    <text x="${CARD_WIDTH / 2}" y="${CARD_HEIGHT / 2 + 24}" text-anchor="middle" fill="#4b5563" font-family="system-ui, sans-serif" font-size="16" ${LOCKED_ATTRS}>${kind}</text>`
	];
}

export function slotToSvgElementJson(item: SetupSlot): SetupSvgElementJson {
	return {
		element: 'g',
		attr: {
			id: item.id,
			[KIND_ATTR]: 'slot',
			[LABEL_ATTR]: item.label,
			[ACCEPTED_DECKS_ATTR]: JSON.stringify(sortedStrings(item.acceptedDeckNames)),
			[ACCEPTED_CARDS_ATTR]: JSON.stringify(sortedStrings(item.acceptedCardIds))
		},
		children: [
			{
				element: 'rect',
				attr: {
					x: item.x,
					y: item.y,
					width: item.width,
					height: item.height,
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
					x: item.x + 16,
					y: item.y + 32,
					fill: '#1e3a8a',
					'font-family': 'system-ui, sans-serif',
					'font-size': 28,
					'font-weight': 700,
					...lockedAttrs()
				},
				children: [item.label]
			}
		]
	};
}

export function placementToSvgElementJson(
	item: SetupPlacement,
	assets: TableSetupSvgAssets = {}
): SetupSvgElementJson {
	const kind = item.type;
	const cardSvg = placementCardSvg(assets, item.id);
	const attr: Record<string, string | number> = {
		id: item.id,
		[KIND_ATTR]: 'placement',
		[TYPE_ATTR]: kind,
		[DECK_ATTR]: item.deckName,
		[LABEL_ATTR]: item.label,
		[RESIZABLE_ATTR]: 'false'
	};
	if (item.type === 'card') {
		attr[CARD_ATTR] = item.cardId;
	}
	if (item.type === 'deck') {
		attr[CARD_IDS_ATTR] = JSON.stringify(sortedStrings(item.cardIds));
	}
	const visualX = item.x - CARD_WIDTH / 2;
	const visualY = item.y - CARD_HEIGHT / 2;
	const visual = cardSvg
		? [
				...(item.type === 'deck' ? deckStackElementsJson(visualX, visualY) : []),
				cardImageElementJson(cardSvg, visualX, visualY)
			]
		: fallbackPlacementElementsJson(item, item.label, kind, visualX, visualY);
	if (item.rotation) {
		attr.transform = `rotate(${item.rotation} ${item.x} ${item.y})`;
	}

	return {
		element: 'g',
		attr,
		children: visual
	};
}

function slotMarkup(item: SetupSlot): string {
	const label = escapeXml(item.label);
	return [
		`  <g id="${escapeXml(item.id)}" ${KIND_ATTR}="slot" ${LABEL_ATTR}="${label}" ${ACCEPTED_DECKS_ATTR}="${escapeXml(JSON.stringify(sortedStrings(item.acceptedDeckNames)))}" ${ACCEPTED_CARDS_ATTR}="${escapeXml(JSON.stringify(sortedStrings(item.acceptedCardIds)))}" transform="translate(${item.x} ${item.y})">`,
		`    <rect x="0" y="0" width="${item.width}" height="${item.height}" rx="14" fill="#dbeafe" fill-opacity="0.32" stroke="#2563eb" stroke-width="4" stroke-dasharray="14 10"/>`,
		`    <text x="16" y="32" fill="#1e3a8a" font-family="system-ui, sans-serif" font-size="28" font-weight="700" ${LOCKED_ATTRS}>${label}</text>`,
		'  </g>'
	].join('\n');
}

function placementMarkup(item: SetupPlacement, assets: TableSetupSvgAssets): string {
	const label = escapeXml(item.label);
	const kind = escapeXml(item.type);
	const cardAttrs = item.type === 'card' ? ` ${CARD_ATTR}="${escapeXml(item.cardId)}"` : '';
	const deckAttrs =
		item.type === 'deck'
			? ` ${CARD_IDS_ATTR}="${escapeXml(JSON.stringify(sortedStrings(item.cardIds)))}"`
			: '';
	const cardSvg = placementCardSvg(assets, item.id);
	const visual = cardSvg
		? [...(item.type === 'deck' ? deckStackMarkup() : []), `    ${cardImageMarkup(cardSvg)}`]
		: fallbackPlacementMarkup(item, label, kind);
	const transformX = item.x - CARD_WIDTH / 2;
	const transformY = item.y - CARD_HEIGHT / 2;

	return [
		`  <g id="${escapeXml(item.id)}" ${KIND_ATTR}="placement" ${TYPE_ATTR}="${kind}" ${DECK_ATTR}="${escapeXml(item.deckName)}"${cardAttrs}${deckAttrs} ${LABEL_ATTR}="${label}" ${RESIZABLE_ATTR}="false" transform="translate(${transformX} ${transformY}) rotate(${item.rotation} ${CARD_WIDTH / 2} ${CARD_HEIGHT / 2})">`,
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
			slotMarkup(slot)
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
	const slotsMarkup = setup.slots.map((item) => slotMarkup(item)).join('\n');
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
