import { Graphics } from 'pixi.js';
import { BoardGameItemNew } from '$lib/pixi/item';

export function createSelectionBorder(item: BoardGameItemNew) {
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

export function selectItem(item: BoardGameItemNew, selItems: Set<BoardGameItemNew>) {
	if (selItems.has(item)) return;
	selItems.add(item);
	createSelectionBorder(item);
}

export function deselectItem(item: BoardGameItemNew, selItems: Set<BoardGameItemNew>) {
	if (!selItems.has(item)) return;
	console.log('Deselecting item', item.id);
	selItems.delete(item);
	item.removeChildren(2);
}

export function selectOnlyItem(item: BoardGameItemNew, selItems: Set<BoardGameItemNew>) {
	selItems.forEach((it) => deselectItem(it, selItems));
	selectItem(item, selItems);
}
