import type { TableSlot, Table } from '../../routes/games/[gameName]/setup/table';
import { rotatePoint } from './table-geometry';
import type { TablePlayItem, TablePlayPlan } from './table-play';

export type TableItemMetadata = Pick<TablePlayItem, 'id' | 'type' | 'componentIds' | 'deckName'>;

export function tableItemMetadataById(plan: TablePlayPlan | null): Map<string, TableItemMetadata> {
	const metadata = new Map<string, TableItemMetadata>();
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

function acceptedCardMatches(acceptedCardId: string, item: TableItemMetadata): boolean {
	return item.componentIds.some(
		(componentId) =>
			acceptedCardId === componentId ||
			(item.deckName ? acceptedCardId === `${item.deckName}:${componentId}` : false)
	);
}

export function tableSlotAcceptsItem(slot: TableSlot, item: TableItemMetadata): boolean {
	const acceptsAny = slot.acceptedDeckNames.length === 0 && slot.acceptedCardIds.length === 0;
	if (acceptsAny) return true;

	const deckMatches = item.deckName ? slot.acceptedDeckNames.includes(item.deckName) : false;
	if (deckMatches) return true;
	if (item.type === 'stack') return false;

	return slot.acceptedCardIds.some((acceptedCardId) => acceptedCardMatches(acceptedCardId, item));
}

export function tableSlotIsFixedLayout(slot: TableSlot): boolean {
	return slot.layout?.mode === 'horizontal-flex' || slot.layout?.mode === 'grid';
}

function pointInSlot(slot: TableSlot, point: { x: number; y: number }): boolean {
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

export function findTableSlotAtPoint(
	table: Table,
	point: { x: number; y: number }
): TableSlot | null {
	return table.slots.find((slot) => pointInSlot(slot, point)) ?? null;
}

export function pointIsInsideTable(table: Table, point: { x: number; y: number }): boolean {
	return (
		point.x >= 0 && point.x <= table.table.width && point.y >= 0 && point.y <= table.table.height
	);
}
