import { LayoutContainer } from '@pixi/layout/components';
import { Container } from 'pixi.js';
import type { BoardGameItemNew } from '$lib/pixi/item';
import type { Table, TableSlot } from '../../routes/games/[gameName]/setup/table';
import {
	normalizeTableRotation,
	tableSlotCellCount,
	tableSlotCellSize,
	tableSlotTargetId
} from './table-geometry';
import {
	configureFixedSlotTableItem,
	configureTableItem,
	setTableItemPose,
	tableItemRotation
} from './table-surface';

type FixedSlotEntry = {
	root: Container;
	layoutRoot: LayoutContainer;
	slot: TableSlot;
};

type FixedSlotTarget = {
	slot: TableSlot;
	container: LayoutContainer;
	layoutRoot: LayoutContainer;
};

function fixedSlotLayout(slot: TableSlot) {
	const cellSize = tableSlotCellSize(slot);
	const base = {
		width: slot.width,
		height: slot.height,
		flexDirection: 'row' as const,
		justifyContent: 'flex-start' as const,
		alignItems: 'flex-start' as const,
		alignContent: 'flex-start' as const,
		overflow: 'visible' as const
	};

	if (slot.layout?.mode === 'horizontal-flex') {
		return {
			root: {
				...base,
				gap: slot.layout.gap
			},
			cell: {
				width: cellSize.width,
				height: cellSize.height
			}
		};
	}

	if (slot.layout?.mode === 'grid') {
		return {
			root: {
				...base,
				flexWrap: 'wrap' as const,
				columnGap: slot.layout.gapX,
				rowGap: slot.layout.gapY
			},
			cell: {
				width: cellSize.width,
				height: cellSize.height
			}
		};
	}

	return null;
}

function createCell(slotId: string, index: number, size: { width: number; height: number }) {
	const cell = new LayoutContainer({
		layout: {
			width: size.width,
			height: size.height,
			flexDirection: 'row',
			justifyContent: 'center',
			alignItems: 'center',
			overflow: 'visible'
		},
		label: `${slotId}-cell-${index}`
	});
	return cell;
}

function forceLayout(container: LayoutContainer) {
	const layout = container.layout;
	if (!layout) return;
	layout.forceUpdate();
	layout.invalidateRoot(container);
}

export class FixedSlotLayout {
	private readonly boardContainer: Container;
	private readonly slots = new Map<string, FixedSlotEntry>();
	private readonly targets = new Map<string, FixedSlotTarget>();
	private readonly itemTargets = new Map<string, FixedSlotTarget>();

	constructor(table: Table, boardContainer: Container) {
		this.boardContainer = boardContainer;
		for (const slot of table.slots) {
			const layout = fixedSlotLayout(slot);
			if (!layout) continue;

			const root = new Container({ label: `${slot.id}-fixed-slot` });
			root.position.set(slot.x + slot.width / 2, slot.y + slot.height / 2);
			root.pivot.set(slot.width / 2, slot.height / 2);
			root.angle = normalizeTableRotation(slot.rotation ?? 0);

			const layoutRoot = new LayoutContainer({
				layout: layout.root,
				label: `${slot.id}-fixed-slot-layout`
			});
			root.addChild(layoutRoot);

			const cells = Array.from({ length: tableSlotCellCount(slot) }, (_unused, index) => {
				const cell = createCell(slot.id, index, layout.cell);
				layoutRoot.addChild(cell);
				this.targets.set(tableSlotTargetId(slot, index), { slot, container: cell, layoutRoot });
				return cell;
			});

			this.boardContainer.addChild(root);
			const entry = { root, layoutRoot, slot };
			this.slots.set(slot.id, entry);
			forceLayout(layoutRoot);
			for (const cell of cells) forceLayout(cell);
		}
	}

	placeItem(targetId: string, item: BoardGameItemNew): boolean {
		const target = this.targets.get(targetId);
		if (!target) return false;

		item.parent?.removeChild(item);
		item.position.set(0, 0);
		configureFixedSlotTableItem(item, target.slot.rotation ?? 0);
		item.visible = true;
		item.renderable = true;
		target.container.addChild(item);
		this.itemTargets.set(item.id, target);
		forceLayout(target.container);
		forceLayout(target.layoutRoot);
		return true;
	}

	detachItemToBoard(item: BoardGameItemNew, rotation = tableItemRotation(item)): boolean {
		const target = this.itemTargets.get(item.id);
		if (!target) return false;

		const bounds = item.contentBoundsIn(this.boardContainer);
		const center = {
			x: bounds.x + bounds.width / 2,
			y: bounds.y + bounds.height / 2
		};
		item.parent?.removeChild(item);
		this.itemTargets.delete(item.id);
		configureTableItem(item);
		this.boardContainer.addChild(item);
		setTableItemPose(item, {
			centerX: center.x,
			centerY: center.y,
			rotation
		});
		forceLayout(target.layoutRoot);
		return true;
	}

	forgetItem(item: BoardGameItemNew) {
		this.itemTargets.delete(item.id);
		item.positionManagedByLayout = false;
	}

	hasTarget(targetId: string) {
		return this.targets.has(targetId);
	}

	destroy() {
		for (const entry of this.slots.values()) {
			entry.root.destroy({ children: true });
		}
		this.slots.clear();
		this.targets.clear();
		this.itemTargets.clear();
	}
}
