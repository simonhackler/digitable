import type { InitGamePayload } from 'boardgame-server/src/rooms/schema/MyRoomState';
import type {
	SetupPlacement,
	SetupSlot,
	SetupSlotContent,
	TableSetup
} from '../../routes/games/[gameName]/setup/table-setup';
import type { ParsedSvg } from './initComponent';
import {
	canonicalPositionFromSetupPose,
	SETUP_PLAY_CARD_HEIGHT,
	SETUP_PLAY_CARD_WIDTH,
	setupSlotCellPosition
} from './setup-geometry';

export { SETUP_PLAY_CARD_HEIGHT, SETUP_PLAY_CARD_WIDTH };
export const SETUP_TABLE_NODE_ID = 'setup-table';

export type LoadedDeck = {
	deckName: string;
	cards: ParsedSvg[];
};

export type SetupPlayItem = {
	id: string;
	type: 'card' | 'stack';
	componentIds: string[];
	x: number;
	y: number;
	rotation: number;
	deckName?: string;
	slotId?: string;
	slotCellIndex?: number;
};

export type SetupPlayPlan = {
	setup: TableSetup;
	items: SetupPlayItem[];
};

export function setupReferencedDeckNames(setup: TableSetup): Set<string> {
	const deckNames = new Set<string>();

	for (const placement of setup.placements) {
		deckNames.add(placement.deckName);
	}
	for (const slot of setup.slots) {
		for (const content of slot.contents ?? []) {
			deckNames.add(content.deckName);
		}
	}

	return deckNames;
}

function runtimeCardId(deckName: string, setupCardId: string): string {
	const prefix = `${deckName}:`;
	return setupCardId.startsWith(prefix) ? setupCardId.slice(prefix.length) : setupCardId;
}

function buildDeckLookup(loadedDecks: LoadedDeck[]) {
	const deckCards = new Map<string, string[]>();
	const knownCards = new Map<string, Set<string>>();

	for (const deck of loadedDecks) {
		const ids = deck.cards.map((card) => card.id);
		deckCards.set(deck.deckName, ids);
		knownCards.set(deck.deckName, new Set(ids));
	}

	return { deckCards, knownCards };
}

function boardTopLeft(x: number, y: number) {
	return canonicalPositionFromSetupPose({ centerX: x, centerY: y, rotation: 0 });
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

	for (const setupCardId of sourceIds) {
		const cardId = runtimeCardId(input.deckName, setupCardId);
		if (!knownDeckCards.has(cardId)) {
			warn(`Skipping unknown setup card "${setupCardId}" in ${input.context}.`);
			continue;
		}
		if (input.usedCardIds.has(cardId)) {
			if (input.silentDuplicateCardIds?.has(cardId)) continue;
			warn(`Skipping duplicate setup card "${setupCardId}" in ${input.context}.`);
			continue;
		}
		input.usedCardIds.add(cardId);
		resolved.push(cardId);
	}

	return resolved;
}

function placementToItem(
	placement: SetupPlacement,
	deckCards: Map<string, string[]>,
	knownCards: Map<string, Set<string>>,
	usedCardIds: Set<string>,
	warn: (message: string) => void,
	silentDuplicateCardIds?: Set<string>
): SetupPlayItem[] {
	const topLeft = boardTopLeft(placement.x, placement.y);
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
					...topLeft
				}
			]
		: [];
}

function slotContentToItem(
	slot: SetupSlot,
	content: SetupSlotContent,
	index: number,
	deckCards: Map<string, string[]>,
	knownCards: Map<string, Set<string>>,
	usedCardIds: Set<string>,
	warn: (message: string) => void
): SetupPlayItem[] {
	const cellIndex = slot.layout?.mode === 'grid' ? (content.cellIndex ?? index) : index;
	const { x, y } = setupSlotCellPosition(slot, cellIndex);

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
						rotation: slot.rotation ?? 0,
						deckName: content.deckName,
						slotId: slot.id,
						slotCellIndex: slot.layout?.mode === 'grid' ? cellIndex : undefined
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
					rotation: slot.rotation ?? 0,
					deckName: content.deckName,
					slotId: slot.id,
					slotCellIndex: slot.layout?.mode === 'grid' ? cellIndex : undefined
				}
			]
		: [];
}

export function buildSetupPlayPlan(
	setup: TableSetup,
	loadedDecks: LoadedDeck[],
	warn: (message: string) => void = (message) => console.warn(message)
): SetupPlayPlan {
	const { deckCards, knownCards } = buildDeckLookup(loadedDecks);
	const usedCardIds = new Set<string>();
	const placementItemsById = new Map<string, SetupPlayItem[]>();

	for (const placement of setup.placements) {
		if (placement.type !== 'card') continue;
		placementItemsById.set(
			placement.id,
			placementToItem(placement, deckCards, knownCards, usedCardIds, warn)
		);
	}

	const slotItems = setup.slots.flatMap((slot) =>
		(slot.contents ?? []).flatMap((content, index) =>
			slotContentToItem(slot, content, index, deckCards, knownCards, usedCardIds, warn)
		)
	);
	for (const placement of setup.placements) {
		if (placement.type !== 'deck') continue;
		placementItemsById.set(
			placement.id,
			placementToItem(
				placement,
				deckCards,
				knownCards,
				usedCardIds,
				warn,
				new Set(usedCardIds)
			)
		);
	}

	const placementItems = setup.placements.flatMap(
		(placement) => placementItemsById.get(placement.id) ?? []
	);

	return {
		setup,
		items: [...placementItems, ...slotItems]
	};
}

export function buildSetupInitPayload(plan: SetupPlayPlan): InitGamePayload {
	return {
		layoutNodes: [
			{
				id: SETUP_TABLE_NODE_ID,
				kind: 'table' as const,
				x: 0,
				y: 0,
				width: plan.setup.table.width,
				height: plan.setup.table.height,
				visible: true,
				locked: true,
				layout: {
					mode: 'free'
				}
			},
			...plan.setup.slots.map((slot) => ({
				id: slot.id,
				kind: 'slot' as const,
				parentId: SETUP_TABLE_NODE_ID,
				x: slot.x,
				y: slot.y,
				width: slot.width,
				height: slot.height,
				rotation: slot.rotation ?? 0,
				visible: true,
				locked: true,
				layout: {
					mode: slot.layout?.mode ?? 'free',
					maxChildren:
						slot.layout?.mode === 'horizontal-flex'
							? slot.layout.visibleCount
							: slot.layout?.mode === 'grid'
								? slot.layout.rows * slot.layout.columns
								: 0,
					acceptedDeckNames: slot.acceptedDeckNames,
					acceptedCardIds: slot.acceptedCardIds
				}
			})),
			...plan.items.map((item) => ({
				id: item.id,
				kind: item.type === 'stack' ? ('stack' as const) : ('component' as const),
				parentId: item.slotId ?? SETUP_TABLE_NODE_ID,
				componentId: item.id,
				x: item.x,
				y: item.y,
				width: SETUP_PLAY_CARD_WIDTH,
				height: SETUP_PLAY_CARD_HEIGHT,
				rotation: item.rotation,
				visible: true,
				locked: false
			}))
		],
		setupItems: plan.items.map((item) => ({
			id: item.id,
			type: item.type,
			componentIds: item.componentIds,
			x: item.x,
			y: item.y,
			parentId: item.slotId ?? SETUP_TABLE_NODE_ID,
			componentName: item.deckName ?? ''
		}))
	};
}
