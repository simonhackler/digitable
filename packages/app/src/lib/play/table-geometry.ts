import type { TableSlot, Table } from '../../routes/games/[gameName]/setup/table';

export type TableItemPose = {
	centerX: number;
	centerY: number;
	rotation: number;
};

export type TableItemSize = {
	width: number;
	height: number;
};

function positiveSize(value: number) {
	return Number.isFinite(value) && value > 0 ? value : 1;
}

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

export function tableItemAabbSize(size: TableItemSize, rotation: number) {
	const radians = (normalizeTableRotation(rotation) * Math.PI) / 180;
	const cos = Math.abs(Math.cos(radians));
	const sin = Math.abs(Math.sin(radians));
	const width = positiveSize(size.width);
	const height = positiveSize(size.height);
	return {
		width: width * cos + height * sin,
		height: width * sin + height * cos
	};
}

export function canonicalPositionFromTablePose(
	pose: TableItemPose,
	size: TableItemSize
): { x: number; y: number } {
	return {
		x: pose.centerX - positiveSize(size.width) / 2,
		y: pose.centerY - positiveSize(size.height) / 2
	};
}

export function tableSlotCellSize(slot: TableSlot): TableItemSize {
	if (slot.layout?.mode === 'grid') {
		return {
			width: positiveSize(
				(slot.width - Math.max(0, slot.layout.columns - 1) * slot.layout.gapX) / slot.layout.columns
			),
			height: positiveSize(
				(slot.height - Math.max(0, slot.layout.rows - 1) * slot.layout.gapY) / slot.layout.rows
			)
		};
	}
	if (slot.layout?.mode === 'horizontal-flex') {
		return {
			width: positiveSize(
				(slot.width - Math.max(0, slot.layout.visibleCount - 1) * slot.layout.gap) /
					slot.layout.visibleCount
			),
			height: positiveSize(slot.height)
		};
	}
	return {
		width: positiveSize(slot.width),
		height: positiveSize(slot.height)
	};
}

export function tableSlotCellPose(slot: TableSlot, index: number): TableItemPose {
	const rotation = normalizeTableRotation(slot.rotation ?? 0);
	const cellSize = tableSlotCellSize(slot);
	if (slot.layout?.mode !== 'horizontal-flex' && slot.layout?.mode !== 'grid') {
		return {
			centerX: slot.x + cellSize.width / 2,
			centerY: slot.y + cellSize.height / 2,
			rotation
		};
	}

	const localCell =
		slot.layout.mode === 'grid'
			? {
					x: (index % slot.layout.columns) * (cellSize.width + slot.layout.gapX),
					y: Math.floor(index / slot.layout.columns) * (cellSize.height + slot.layout.gapY)
				}
			: {
					x: index * (cellSize.width + slot.layout.gap),
					y: 0
				};
	const cellCenter = {
		x: slot.x + localCell.x + cellSize.width / 2,
		y: slot.y + localCell.y + cellSize.height / 2
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
	return canonicalPositionFromTablePose(tableSlotCellPose(slot, index), tableSlotCellSize(slot));
}

export function tableSlotCellRect(slot: TableSlot, index: number) {
	const pose = tableSlotCellPose(slot, index);
	const cellSize = tableSlotCellSize(slot);
	return {
		...canonicalPositionFromTablePose(pose, cellSize),
		width: cellSize.width,
		height: cellSize.height,
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
	const cellSize = tableSlotCellSize(slot);

	for (let row = 0; row < slot.layout.rows; row += 1) {
		const cellY = row * (cellSize.height + slot.layout.gapY);
		if (y < cellY || y > cellY + cellSize.height) continue;
		for (let column = 0; column < slot.layout.columns; column += 1) {
			const cellX = column * (cellSize.width + slot.layout.gapX);
			if (x >= cellX && x <= cellX + cellSize.width) {
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

export function clampTableItemPose(
	table: Table,
	pose: TableItemPose,
	itemSize: TableItemSize
): TableItemPose {
	const size = tableItemAabbSize(itemSize, pose.rotation);
	return {
		centerX: clampCenterAxis(pose.centerX, size.width, table.table.width),
		centerY: clampCenterAxis(pose.centerY, size.height, table.table.height),
		rotation: normalizeTableRotation(pose.rotation)
	};
}
