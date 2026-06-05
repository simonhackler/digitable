import type { TableSlot, Table } from '../../routes/games/[gameName]/setup/table';

export const TABLE_CARD_WIDTH = 110;
export const TABLE_CARD_HEIGHT = 150;

export type TableItemPose = {
	centerX: number;
	centerY: number;
	rotation: number;
};

export function normalizeTableRotation(value: number) {
	return ((value % 360) + 360) % 360;
}

export function rotatePoint(
	point: { x: number; y: number },
	center: { x: number; y: number },
	rotation: number
): { x: number; y: number } {
	if (!rotation) return point;
	const radians = (rotation * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	const dx = point.x - center.x;
	const dy = point.y - center.y;
	return {
		x: center.x + dx * cos - dy * sin,
		y: center.y + dx * sin + dy * cos
	};
}

export function tableCardAabbSize(rotation: number) {
	const radians = (normalizeTableRotation(rotation) * Math.PI) / 180;
	const cos = Math.abs(Math.cos(radians));
	const sin = Math.abs(Math.sin(radians));
	return {
		width: TABLE_CARD_WIDTH * cos + TABLE_CARD_HEIGHT * sin,
		height: TABLE_CARD_WIDTH * sin + TABLE_CARD_HEIGHT * cos
	};
}

export function canonicalPositionFromTablePose(pose: TableItemPose): { x: number; y: number } {
	return {
		x: pose.centerX - TABLE_CARD_WIDTH / 2,
		y: pose.centerY - TABLE_CARD_HEIGHT / 2
	};
}

export function tableSlotCellPose(slot: TableSlot, index: number): TableItemPose {
	const rotation = normalizeTableRotation(slot.rotation ?? 0);
	if (slot.layout?.mode !== 'horizontal-flex' && slot.layout?.mode !== 'grid') {
		return {
			centerX: slot.x + TABLE_CARD_WIDTH / 2,
			centerY: slot.y + TABLE_CARD_HEIGHT / 2,
			rotation
		};
	}

	const localCell =
		slot.layout.mode === 'grid'
			? {
					x:
						(index % slot.layout.columns) *
						(TABLE_CARD_WIDTH + slot.layout.gapX),
					y:
						Math.floor(index / slot.layout.columns) *
						(TABLE_CARD_HEIGHT + slot.layout.gapY)
				}
			: {
					x: index * (TABLE_CARD_WIDTH + slot.layout.gap),
					y: 0
				};
	const cellCenter = {
		x: slot.x + localCell.x + TABLE_CARD_WIDTH / 2,
		y: slot.y + localCell.y + TABLE_CARD_HEIGHT / 2
	};
	const slotCenter = { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 };
	const rotatedCenter = rotatePoint(cellCenter, slotCenter, rotation);

	return {
		centerX: rotatedCenter.x,
		centerY: rotatedCenter.y,
		rotation
	};
}

export function tableSlotCellCount(slot: TableSlot): number {
	if (slot.layout?.mode === 'horizontal-flex') return slot.layout.visibleCount;
	if (slot.layout?.mode === 'grid') return slot.layout.rows * slot.layout.columns;
	return 0;
}

export function tableSlotCellPosition(slot: TableSlot, index: number): { x: number; y: number } {
	return canonicalPositionFromTablePose(tableSlotCellPose(slot, index));
}

export function tableSlotCellRect(slot: TableSlot, index: number) {
	const pose = tableSlotCellPose(slot, index);
	return {
		...canonicalPositionFromTablePose(pose),
		width: TABLE_CARD_WIDTH,
		height: TABLE_CARD_HEIGHT,
		rotation: pose.rotation
	};
}

export function tableSlotCellIndexAtPoint(
	slot: TableSlot,
	point: { x: number; y: number }
): number | null {
	if (slot.layout?.mode !== 'grid') return null;
	const rotation = normalizeTableRotation(slot.rotation ?? 0);
	const slotCenter = { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 };
	const localPoint = rotatePoint(point, slotCenter, -rotation);
	const x = localPoint.x - slot.x;
	const y = localPoint.y - slot.y;
	if (x < 0 || y < 0 || x > slot.width || y > slot.height) return null;

	for (let row = 0; row < slot.layout.rows; row += 1) {
		const cellY = row * (TABLE_CARD_HEIGHT + slot.layout.gapY);
		if (y < cellY || y > cellY + TABLE_CARD_HEIGHT) continue;
		for (let column = 0; column < slot.layout.columns; column += 1) {
			const cellX = column * (TABLE_CARD_WIDTH + slot.layout.gapX);
			if (x >= cellX && x <= cellX + TABLE_CARD_WIDTH) {
				return row * slot.layout.columns + column;
			}
		}
	}
	return null;
}

function clampCenterAxis(center: number, visualSize: number, tableSize: number) {
	if (tableSize <= visualSize) return tableSize / 2;
	return Math.min(Math.max(visualSize / 2, center), tableSize - visualSize / 2);
}

export function clampTableItemPose(table: Table, pose: TableItemPose): TableItemPose {
	const size = tableCardAabbSize(pose.rotation);
	return {
		centerX: clampCenterAxis(pose.centerX, size.width, table.table.width),
		centerY: clampCenterAxis(pose.centerY, size.height, table.table.height),
		rotation: normalizeTableRotation(pose.rotation)
	};
}
