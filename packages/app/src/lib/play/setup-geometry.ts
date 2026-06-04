import type { SetupSlot, TableSetup } from '../../routes/games/[gameName]/setup/table-setup';

export const SETUP_PLAY_CARD_WIDTH = 110;
export const SETUP_PLAY_CARD_HEIGHT = 150;

export type SetupItemPose = {
	centerX: number;
	centerY: number;
	rotation: number;
};

export function normalizeSetupRotation(value: number) {
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

export function setupCardAabbSize(rotation: number) {
	const radians = (normalizeSetupRotation(rotation) * Math.PI) / 180;
	const cos = Math.abs(Math.cos(radians));
	const sin = Math.abs(Math.sin(radians));
	return {
		width: SETUP_PLAY_CARD_WIDTH * cos + SETUP_PLAY_CARD_HEIGHT * sin,
		height: SETUP_PLAY_CARD_WIDTH * sin + SETUP_PLAY_CARD_HEIGHT * cos
	};
}

export function canonicalPositionFromSetupPose(pose: SetupItemPose): { x: number; y: number } {
	return {
		x: pose.centerX - SETUP_PLAY_CARD_WIDTH / 2,
		y: pose.centerY - SETUP_PLAY_CARD_HEIGHT / 2
	};
}

export function setupPoseFromCanonicalPosition(
	position: { x: number; y: number },
	rotation: number
): SetupItemPose {
	return {
		centerX: position.x + SETUP_PLAY_CARD_WIDTH / 2,
		centerY: position.y + SETUP_PLAY_CARD_HEIGHT / 2,
		rotation: normalizeSetupRotation(rotation)
	};
}

export function setupSlotCellPose(slot: SetupSlot, index: number): SetupItemPose {
	const rotation = normalizeSetupRotation(slot.rotation ?? 0);
	if (slot.layout?.mode !== 'horizontal-flex' && slot.layout?.mode !== 'grid') {
		return {
			centerX: slot.x + SETUP_PLAY_CARD_WIDTH / 2,
			centerY: slot.y + SETUP_PLAY_CARD_HEIGHT / 2,
			rotation
		};
	}

	const localCell =
		slot.layout.mode === 'grid'
			? {
					x:
						(index % slot.layout.columns) *
						(SETUP_PLAY_CARD_WIDTH + slot.layout.gapX),
					y:
						Math.floor(index / slot.layout.columns) *
						(SETUP_PLAY_CARD_HEIGHT + slot.layout.gapY)
				}
			: {
					x: index * (SETUP_PLAY_CARD_WIDTH + slot.layout.gap),
					y: 0
				};
	const cellCenter = {
		x: slot.x + localCell.x + SETUP_PLAY_CARD_WIDTH / 2,
		y: slot.y + localCell.y + SETUP_PLAY_CARD_HEIGHT / 2
	};
	const slotCenter = { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 };
	const rotatedCenter = rotatePoint(cellCenter, slotCenter, rotation);

	return {
		centerX: rotatedCenter.x,
		centerY: rotatedCenter.y,
		rotation
	};
}

export function setupSlotCellCount(slot: SetupSlot): number {
	if (slot.layout?.mode === 'horizontal-flex') return slot.layout.visibleCount;
	if (slot.layout?.mode === 'grid') return slot.layout.rows * slot.layout.columns;
	return 0;
}

export function setupSlotCellPosition(slot: SetupSlot, index: number): { x: number; y: number } {
	return canonicalPositionFromSetupPose(setupSlotCellPose(slot, index));
}

export function setupSlotCellRect(slot: SetupSlot, index: number) {
	const pose = setupSlotCellPose(slot, index);
	return {
		...canonicalPositionFromSetupPose(pose),
		width: SETUP_PLAY_CARD_WIDTH,
		height: SETUP_PLAY_CARD_HEIGHT,
		rotation: pose.rotation
	};
}

export function setupSlotCellIndexAtPoint(
	slot: SetupSlot,
	point: { x: number; y: number }
): number | null {
	if (slot.layout?.mode !== 'grid') return null;
	const rotation = normalizeSetupRotation(slot.rotation ?? 0);
	const slotCenter = { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 };
	const localPoint = rotatePoint(point, slotCenter, -rotation);
	const x = localPoint.x - slot.x;
	const y = localPoint.y - slot.y;
	if (x < 0 || y < 0 || x > slot.width || y > slot.height) return null;

	for (let row = 0; row < slot.layout.rows; row += 1) {
		const cellY = row * (SETUP_PLAY_CARD_HEIGHT + slot.layout.gapY);
		if (y < cellY || y > cellY + SETUP_PLAY_CARD_HEIGHT) continue;
		for (let column = 0; column < slot.layout.columns; column += 1) {
			const cellX = column * (SETUP_PLAY_CARD_WIDTH + slot.layout.gapX);
			if (x >= cellX && x <= cellX + SETUP_PLAY_CARD_WIDTH) {
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

export function clampSetupItemPoseToTable(setup: TableSetup, pose: SetupItemPose): SetupItemPose {
	const size = setupCardAabbSize(pose.rotation);
	return {
		centerX: clampCenterAxis(pose.centerX, size.width, setup.table.width),
		centerY: clampCenterAxis(pose.centerY, size.height, setup.table.height),
		rotation: normalizeSetupRotation(pose.rotation)
	};
}
