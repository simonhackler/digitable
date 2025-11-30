import { Graphics } from 'pixi.js';
import { BoardGameItem } from '$lib/pixi/item';

export class SelectionManager {
	private selectedItems = new Set<BoardGameItem>();

	select(item: BoardGameItem) {
		if (this.selectedItems.has(item)) return;
		this.selectedItems.add(item);
		this.createSelectionBorder(item);
	}

	deselect(item: BoardGameItem) {
		if (!this.selectedItems.has(item)) return;
		this.selectedItems.delete(item);
		item.removeChildren(2);
	}

	selectOnly(item: BoardGameItem) {
		this.clear();
		this.select(item);
	}

	clear() {
		this.selectedItems.forEach((item) => this.deselect(item));
	}

	has(item: BoardGameItem): boolean {
		return this.selectedItems.has(item);
	}

	forEach(callback: (item: BoardGameItem) => void) {
		this.selectedItems.forEach(callback);
	}

	values(): IterableIterator<BoardGameItem> {
		return this.selectedItems.values();
	}

	get size(): number {
		return this.selectedItems.size;
	}

	private createSelectionBorder(item: BoardGameItem) {
		const b = item.getLocalBounds();
		const pad = Math.min(Math.max(Math.min(b.width, b.height) * 0.02, 2), 8); // 2–8px padding
		const radius = Math.min(Math.max(Math.min(b.width, b.height) * 0.06, 6), 20); // rounded corners

		const g = new Graphics();
		g.eventMode = 'none';
		g.zIndex = 9999;
		// Outer blue ring
		g.roundRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, radius).stroke({
			width: 16,
			color: 0x3b82f6,
			alpha: 1
		});
		// Subtle inner hairline for a "crisp" look
		g.roundRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, radius).stroke({
			width: 4,
			color: 0xffffff,
			alpha: 0.9
		});

		item.addChild(g);
	}
}
