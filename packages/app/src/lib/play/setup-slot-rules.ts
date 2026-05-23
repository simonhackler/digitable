import type { SetupSlot, TableSetup } from '../../routes/games/[gameName]/setup/table-setup';
import {
	SETUP_PLAY_CARD_HEIGHT,
	SETUP_PLAY_CARD_WIDTH,
	type SetupPlayItem,
	type SetupPlayPlan
} from './setup-play';

export type SetupItemMetadata = Pick<
	SetupPlayItem,
	'id' | 'type' | 'componentIds' | 'deckName'
>;

export type SetupSlotState = {
	slotOccupants: Map<string, string[]>;
	itemSlotIds: Map<string, string>;
};

export function setupItemMetadataById(plan: SetupPlayPlan | null): Map<string, SetupItemMetadata> {
	const metadata = new Map<string, SetupItemMetadata>();
	if (!plan) return metadata;

	for (const item of plan.items) {
		metadata.set(item.id, {
			id: item.id,
			type: item.type,
			componentIds: item.componentIds,
			deckName: item.deckName
		});

		for (const componentId of item.componentIds) {
			if (metadata.has(componentId)) continue;
			metadata.set(componentId, {
				id: componentId,
				type: 'card',
				componentIds: [componentId],
				deckName: item.deckName
			});
		}
	}

	return metadata;
}

export function initialSetupSlotState(plan: SetupPlayPlan | null): SetupSlotState {
	const slotOccupants = new Map<string, string[]>();
	const itemSlotIds = new Map<string, string>();
	if (!plan) return { slotOccupants, itemSlotIds };

	for (const slot of plan.setup.slots) {
		slotOccupants.set(slot.id, []);
	}

	for (const item of plan.items) {
		if (!item.slotId) continue;
		const occupants = slotOccupants.get(item.slotId);
		if (!occupants) continue;
		occupants.push(item.id);
		itemSlotIds.set(item.id, item.slotId);
	}

	return { slotOccupants, itemSlotIds };
}

function acceptedCardMatches(acceptedCardId: string, item: SetupItemMetadata): boolean {
	return item.componentIds.some(
		(componentId) =>
			acceptedCardId === componentId ||
			(item.deckName ? acceptedCardId === `${item.deckName}:${componentId}` : false)
	);
}

export function setupSlotAcceptsItem(slot: SetupSlot, item: SetupItemMetadata): boolean {
	const acceptsAny = slot.acceptedDeckNames.length === 0 && slot.acceptedCardIds.length === 0;
	if (acceptsAny) return true;

	const deckMatches = item.deckName ? slot.acceptedDeckNames.includes(item.deckName) : false;
	if (deckMatches) return true;
	if (item.type === 'stack') return false;

	return slot.acceptedCardIds.some((acceptedCardId) => acceptedCardMatches(acceptedCardId, item));
}

export function setupSlotCapacity(slot: SetupSlot): number {
	if (slot.layout?.mode !== 'horizontal-flex') return Number.POSITIVE_INFINITY;
	return slot.layout.maxItems;
}

export function setupSlotCellPosition(slot: SetupSlot, index: number): { x: number; y: number } {
	if (slot.layout?.mode !== 'horizontal-flex') return { x: slot.x, y: slot.y };
	return {
		x: slot.x + index * (SETUP_PLAY_CARD_WIDTH + slot.layout.gap),
		y: slot.y
	};
}

export function findSetupSlotAtPoint(
	setup: TableSetup,
	point: { x: number; y: number }
): SetupSlot | null {
	return (
		setup.slots.find(
			(slot) =>
				point.x >= slot.x &&
				point.x <= slot.x + slot.width &&
				point.y >= slot.y &&
				point.y <= slot.y + slot.height
		) ?? null
	);
}

export function pointIsInsideSetupTable(
	setup: TableSetup,
	point: { x: number; y: number }
): boolean {
	return (
		point.x >= 0 &&
		point.x <= setup.table.width &&
		point.y >= 0 &&
		point.y <= setup.table.height
	);
}

export function clampSetupItemPosition(
	setup: TableSetup,
	position: { x: number; y: number }
): { x: number; y: number } {
	const maxX = Math.max(0, setup.table.width - SETUP_PLAY_CARD_WIDTH);
	const maxY = Math.max(0, setup.table.height - SETUP_PLAY_CARD_HEIGHT);
	return {
		x: Math.min(Math.max(0, position.x), maxX),
		y: Math.min(Math.max(0, position.y), maxY)
	};
}
