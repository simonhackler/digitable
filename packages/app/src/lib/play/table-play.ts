import type {
	InitGamePayload,
	InitLayoutNodePayload
} from 'boardgame-server/src/rooms/schema/MyRoomState';
import type {
	TablePlacement,
	TableSlot,
	TableSlotContent,
	Table
} from '../../routes/games/[gameName]/setup/table';
import type { ParsedSvg } from './initComponent';
import {
	canonicalPositionFromTablePose,
	tableSlotCellCount,
	tableSlotCellPose,
	tableSlotCellRect,
	tableSlotTargetId,
	type TableItemSize
} from './table-geometry';

export const TABLE_NODE_ID = 'table';

export type LoadedDeck = {
	deckName: string;
	cards: ParsedSvg[];
};

export type TablePlayItem = {
	id: string;
	type: 'card' | 'stack';
	componentIds: string[];
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	deckName?: string;
	parentId?: string;
};

export type TablePlayPlan = {
	table: Table;
	items: TablePlayItem[];
};

export function tableReferencedDeckNames(table: Table): Set<string> {
	const deckNames = new Set<string>();

	for (const placement of table.placements) {
		deckNames.add(placement.deckName);
	}
	for (const slot of table.slots) {
		for (const content of slot.contents ?? []) {
			deckNames.add(content.deckName);
		}
	}

	return deckNames;
}

function runtimeCardId(deckName: string, tableCardId: string): string {
	const prefix = `${deckName}:`;
	return tableCardId.startsWith(prefix) ? tableCardId.slice(prefix.length) : tableCardId;
}

function buildDeckLookup(loadedDecks: LoadedDeck[]) {
	const deckCards = new Map<string, string[]>();
	const knownCards = new Map<string, Set<string>>();
	const deckCardSizes = new Map<string, TableItemSize>();

	for (const deck of loadedDecks) {
		const ids = deck.cards.map((card) => card.id);
		deckCards.set(deck.deckName, ids);
		knownCards.set(deck.deckName, new Set(ids));
		deckCardSizes.set(deck.deckName, parsedCardSize(deck.cards[0]));
	}

	return { deckCards, knownCards, deckCardSizes };
}

function positiveSize(value: number) {
	return Number.isFinite(value) && value > 0 ? value : 1;
}

function parsedCardSize(card: ParsedSvg | undefined): TableItemSize {
	if (!card) return { width: 1, height: 1 };
	return {
		width: positiveSize(card.width),
		height: positiveSize(card.height)
	};
}

function deckCardSize(deckName: string, deckCardSizes: Map<string, TableItemSize>): TableItemSize {
	return deckCardSizes.get(deckName) ?? { width: 1, height: 1 };
}

function boardTopLeft(x: number, y: number, size: TableItemSize) {
	return canonicalPositionFromTablePose({ centerX: x, centerY: y, rotation: 0 }, size);
}

function resolveCardIds(
	input: {
		deckName: string;
		cardIds: string[];
		fallbackToDeck: boolean;
		knownCards: Map<string, Set<string>>;
		deckCards: Map<string, string[]>;
		usedCardIds: Set<string>;
		silentDuplicateCardIds?: Set<string>;
		context: string;
	},
	warn: (message: string) => void
) {
	const deckCardIds = input.deckCards.get(input.deckName) ?? [];
	const sourceIds = input.cardIds.length > 0 || !input.fallbackToDeck ? input.cardIds : deckCardIds;
	const knownDeckCards = input.knownCards.get(input.deckName) ?? new Set<string>();
	const resolved: string[] = [];

	for (const tableCardId of sourceIds) {
		const cardId = runtimeCardId(input.deckName, tableCardId);
		if (!knownDeckCards.has(cardId)) {
			warn(`Skipping unknown table card "${tableCardId}" in ${input.context}.`);
			continue;
		}
		if (input.usedCardIds.has(cardId)) {
			if (input.silentDuplicateCardIds?.has(cardId)) continue;
			warn(`Skipping duplicate table card "${tableCardId}" in ${input.context}.`);
			continue;
		}
		input.usedCardIds.add(cardId);
		resolved.push(cardId);
	}

	return resolved;
}

function placementToItem(
	placement: TablePlacement,
	deckCards: Map<string, string[]>,
	knownCards: Map<string, Set<string>>,
	deckCardSizes: Map<string, TableItemSize>,
	usedCardIds: Set<string>,
	warn: (message: string) => void,
	silentDuplicateCardIds?: Set<string>
): TablePlayItem[] {
	const size = deckCardSize(placement.deckName, deckCardSizes);
	const topLeft = boardTopLeft(placement.x, placement.y, size);
	if (placement.type === 'card') {
		const componentIds = resolveCardIds(
			{
				deckName: placement.deckName,
				cardIds: [placement.cardId],
				fallbackToDeck: false,
				knownCards,
				deckCards,
				usedCardIds,
				context: `placement "${placement.label}"`
			},
			warn
		);
		return componentIds.length > 0
			? [
					{
						id: componentIds[0],
						type: 'card',
						componentIds,
						deckName: placement.deckName,
						rotation: placement.rotation,
						width: size.width,
						height: size.height,
						...topLeft
					}
				]
			: [];
	}

	const componentIds = resolveCardIds(
		{
			deckName: placement.deckName,
			cardIds: placement.cardIds,
			fallbackToDeck: true,
			knownCards,
			deckCards,
			usedCardIds,
			silentDuplicateCardIds,
			context: `placement "${placement.label}"`
		},
		warn
	);
	return componentIds.length > 0
		? [
				{
					id: placement.id,
					type: 'stack',
					componentIds,
					deckName: placement.deckName,
					rotation: placement.rotation,
					width: size.width,
					height: size.height,
					...topLeft
				}
			]
		: [];
}

function slotContentToItem(
	slot: TableSlot,
	content: TableSlotContent,
	index: number,
	deckCards: Map<string, string[]>,
	knownCards: Map<string, Set<string>>,
	deckCardSizes: Map<string, TableItemSize>,
	usedCardIds: Set<string>,
	warn: (message: string) => void
): TablePlayItem[] {
	const cellCount = tableSlotCellCount(slot);
	const cellIndex = cellCount > 0 ? (content.cellIndex ?? index) : index;
	const size = deckCardSize(content.deckName, deckCardSizes);
	const { x, y } = canonicalPositionFromTablePose(tableSlotCellPose(slot, cellIndex), size);
	const parentId = cellCount > 0 ? tableSlotTargetId(slot, cellIndex) : slot.id;

	if (content.type === 'card') {
		const componentIds = resolveCardIds(
			{
				deckName: content.deckName,
				cardIds: [content.cardId],
				fallbackToDeck: false,
				knownCards,
				deckCards,
				usedCardIds,
				context: `slot "${slot.label}"`
			},
			warn
		);
		return componentIds.length > 0
			? [
					{
						id: componentIds[0],
						type: 'card',
						componentIds,
						x,
						y,
						width: size.width,
						height: size.height,
						rotation: slot.rotation ?? 0,
						deckName: content.deckName,
						parentId
					}
				]
			: [];
	}

	const componentIds = resolveCardIds(
		{
			deckName: content.deckName,
			cardIds: [],
			fallbackToDeck: true,
			knownCards,
			deckCards,
			usedCardIds,
			context: `slot "${slot.label}"`
		},
		warn
	);
	return componentIds.length > 0
		? [
				{
					id: `${slot.id}:${index}:${content.deckName}`,
					type: 'stack',
					componentIds,
					x,
					y,
					width: size.width,
					height: size.height,
					rotation: slot.rotation ?? 0,
					deckName: content.deckName,
					parentId
				}
			]
		: [];
}

function slotLayoutNodes(slot: TableSlot): InitLayoutNodePayload[] {
	const cellCount = tableSlotCellCount(slot);
	if (cellCount <= 0) {
		return [
			{
				id: slot.id,
				kind: 'slot' as const,
				parentId: TABLE_NODE_ID,
				x: slot.x,
				y: slot.y,
				width: slot.width,
				height: slot.height,
				rotation: slot.rotation ?? 0,
				visible: true,
				locked: true,
				layout: {
					mode: slot.layout?.mode ?? 'free',
					maxChildren: 0,
					acceptedDeckNames: slot.acceptedDeckNames,
					acceptedCardIds: slot.acceptedCardIds
				}
			}
		];
	}

	const groupNode = {
		id: slot.id,
		kind: 'group' as const,
		parentId: TABLE_NODE_ID,
		x: slot.x,
		y: slot.y,
		width: slot.width,
		height: slot.height,
		rotation: slot.rotation ?? 0,
		visible: true,
		locked: true
	};

	const cellNodes = Array.from({ length: cellCount }, (_unused, index) => {
		const rect = tableSlotCellRect(slot, index);
		return {
			id: tableSlotTargetId(slot, index),
			kind: 'slot' as const,
			parentId: slot.id,
			x: rect.x,
			y: rect.y,
			width: rect.width,
			height: rect.height,
			rotation: rect.rotation,
			visible: true,
			locked: true,
			layout: {
				mode: 'free' as const,
				maxChildren: 1,
				acceptedDeckNames: slot.acceptedDeckNames,
				acceptedCardIds: slot.acceptedCardIds
			}
		};
	});

	return [groupNode, ...cellNodes];
}

export function buildTablePlayPlan(
	table: Table,
	loadedDecks: LoadedDeck[],
	warn: (message: string) => void = (message) => console.warn(message)
): TablePlayPlan {
	const { deckCards, knownCards, deckCardSizes } = buildDeckLookup(loadedDecks);
	const usedCardIds = new Set<string>();
	const placementItemsById = new Map<string, TablePlayItem[]>();

	for (const placement of table.placements) {
		if (placement.type !== 'card') continue;
		placementItemsById.set(
			placement.id,
			placementToItem(placement, deckCards, knownCards, deckCardSizes, usedCardIds, warn)
		);
	}

	const slotItems = table.slots.flatMap((slot) =>
		(slot.contents ?? []).flatMap((content, index) =>
			slotContentToItem(
				slot,
				content,
				index,
				deckCards,
				knownCards,
				deckCardSizes,
				usedCardIds,
				warn
			)
		)
	);
	for (const placement of table.placements) {
		if (placement.type !== 'deck') continue;
		placementItemsById.set(
			placement.id,
			placementToItem(
				placement,
				deckCards,
				knownCards,
				deckCardSizes,
				usedCardIds,
				warn,
				new Set(usedCardIds)
			)
		);
	}

	const placementItems = table.placements.flatMap(
		(placement) => placementItemsById.get(placement.id) ?? []
	);

	return {
		table,
		items: [...placementItems, ...slotItems]
	};
}

export function buildTableInitPayload(plan: TablePlayPlan): InitGamePayload {
	return {
		layoutNodes: [
			{
				id: TABLE_NODE_ID,
				kind: 'table' as const,
				x: 0,
				y: 0,
				width: plan.table.table.width,
				height: plan.table.table.height,
				visible: true,
				locked: true,
				layout: {
					mode: 'free'
				}
			},
			...plan.table.slots.flatMap((slot) => slotLayoutNodes(slot)),
			...plan.items.map((item) => ({
				id: item.id,
				kind: item.type === 'stack' ? ('stack' as const) : ('component' as const),
				parentId: item.parentId ?? TABLE_NODE_ID,
				componentId: item.id,
				x: item.x,
				y: item.y,
				width: item.width,
				height: item.height,
				rotation: item.rotation,
				visible: true,
				locked: false
			}))
		],
		tableItems: plan.items.map((item) => ({
			id: item.id,
			type: item.type,
			componentIds: item.componentIds,
			x: item.x,
			y: item.y,
			parentId: item.parentId ?? TABLE_NODE_ID,
			componentName: item.deckName ?? ''
		}))
	};
}
