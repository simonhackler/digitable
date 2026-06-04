import type { SetupSlot, TableSetup } from '../../routes/games/[gameName]/setup/table-setup';
import { rotatePoint, setupSlotCellCount } from './setup-geometry';
import type { SetupPlayItem, SetupPlayPlan } from './setup-play';

export type SetupItemMetadata = Pick<
	SetupPlayItem,
	'id' | 'type' | 'componentIds' | 'deckName'
>;

export type SetupSlotState = {
	slotOccupants: Map<string, string[]>;
	gridCellOccupants: Map<string, Map<number, string>>;
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
	const gridCellOccupants = new Map<string, Map<number, string>>();
	const itemSlotIds = new Map<string, string>();
	if (!plan) return { slotOccupants, gridCellOccupants, itemSlotIds };

	const slotsById = new Map(plan.setup.slots.map((slot) => [slot.id, slot]));

	for (const slot of plan.setup.slots) {
		slotOccupants.set(slot.id, []);
		if (slot.layout?.mode === 'grid') gridCellOccupants.set(slot.id, new Map());
	}

	for (const item of plan.items) {
		if (!item.slotId) continue;
		const slot = slotsById.get(item.slotId);
		if (slot?.layout?.mode === 'grid') {
			const cellIndex =
				item.slotCellIndex !== undefined && item.slotCellIndex >= 0
					? Math.min(item.slotCellIndex, setupSlotCellCount(slot) - 1)
					: 0;
			gridCellOccupants.get(item.slotId)?.set(cellIndex, item.id);
			itemSlotIds.set(item.id, item.slotId);
			continue;
		}
		const occupants = slotOccupants.get(item.slotId);
		if (!occupants) continue;
		occupants.push(item.id);
		itemSlotIds.set(item.id, item.slotId);
	}

	return { slotOccupants, gridCellOccupants, itemSlotIds };
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
	const fixedCapacity = setupSlotCellCount(slot);
	return fixedCapacity > 0 ? fixedCapacity : Number.POSITIVE_INFINITY;
}

export function setupSlotIsFixedLayout(slot: SetupSlot): boolean {
	return slot.layout?.mode === 'horizontal-flex' || slot.layout?.mode === 'grid';
}

function pointInSlot(slot: SetupSlot, point: { x: number; y: number }): boolean {
	const rotation = slot.rotation ?? 0;
	const slotCenter = { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 };
	const localPoint = rotatePoint(point, slotCenter, -rotation);
	return (
		localPoint.x >= slot.x &&
		localPoint.x <= slot.x + slot.width &&
		localPoint.y >= slot.y &&
		localPoint.y <= slot.y + slot.height
	);
}

export function findSetupSlotAtPoint(
	setup: TableSetup,
	point: { x: number; y: number }
): SetupSlot | null {
	return setup.slots.find((slot) => pointInSlot(slot, point)) ?? null;
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
