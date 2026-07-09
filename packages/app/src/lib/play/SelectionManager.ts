import { Graphics } from 'pixi.js';
import { BoardGameItemNew } from '$lib/pixi/item';

type BorderStyle = {
	alpha: number;
	color: number;
	width: number;
	zIndex: number;
};

const hoverBorderStyle: BorderStyle = {
	alpha: 0.72,
	color: 0xd97706,
	width: 1,
	zIndex: 9998
};

const selectionBorderStyle: BorderStyle = {
	alpha: 1,
	color: 0x3b82f6,
	width: 3,
	zIndex: 9999
};

export class SelectionManager {
	private selectedItems = new Set<BoardGameItemNew>();
	private selectionBorders = new Map<BoardGameItemNew, Graphics>();
	private hoveredItem: BoardGameItemNew | null = null;
	private hoverBorder: Graphics | null = null;

	select(item: BoardGameItemNew) {
		if (this.selectedItems.has(item)) return;
		this.selectedItems.add(item);
		this.syncHoverBorder();
		this.selectionBorders.set(item, this.createBorder(item, selectionBorderStyle));
	}

	deselect(item: BoardGameItemNew) {
		if (!this.selectedItems.has(item)) return;
		this.selectedItems.delete(item);
		const border = this.selectionBorders.get(item);
		this.destroyBorder(border);
		this.selectionBorders.delete(item);
		this.syncHoverBorder();
	}

	selectOnly(item: BoardGameItemNew) {
		this.clear();
		this.select(item);
	}

	clear() {
		this.selectedItems.forEach((item) => this.deselect(item));
	}

	has(item: BoardGameItemNew): boolean {
		return this.selectedItems.has(item);
	}

	forEach(callback: (item: BoardGameItemNew) => void) {
		this.selectedItems.forEach(callback);
	}

	values(): IterableIterator<BoardGameItemNew> {
		return this.selectedItems.values();
	}

	get size(): number {
		return this.selectedItems.size;
	}

	setHover(item: BoardGameItemNew | null) {
		if (this.hoveredItem === item) return;

		this.destroyHoverBorder();
		this.hoveredItem = item;
		this.syncHoverBorder();
	}

	private syncHoverBorder() {
		const item = this.hoveredItem;
		if (!item || item.destroyed || this.selectedItems.has(item)) {
			this.destroyHoverBorder();
			return;
		}

		if (this.hoverBorder) return;
		this.hoverBorder = this.createBorder(item, hoverBorderStyle);
	}

	private destroyHoverBorder() {
		this.destroyBorder(this.hoverBorder);
		this.hoverBorder = null;
	}

	private createBorder(item: BoardGameItemNew, style: BorderStyle) {
		const b = item.contentLocalBounds();
		const edge = Math.min(b.width, b.height);
		const pad = Math.min(Math.max(edge * 0.015, 1.5), 4);
		const radius = Math.min(Math.max(edge * 0.05, 4), 12);

		const g = new Graphics();
		g.eventMode = 'none';
		g.zIndex = style.zIndex;
		g.roundRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, radius).stroke({
			width: style.width,
			color: style.color,
			alpha: style.alpha
		});

		item.itemContainer.addChild(g);
		return g;
	}

	private destroyBorder(border: Graphics | null | undefined) {
		border?.parent?.removeChild(border);
		border?.destroy();
	}
}
