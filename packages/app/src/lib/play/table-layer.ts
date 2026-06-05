import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import {
	svgHasCustomTableContent,
	type TableSlot,
	type Table
} from '../../routes/games/[gameName]/setup/table';
import { TABLE_CARD_HEIGHT, TABLE_CARD_WIDTH } from './table-geometry';

const GENERATED_TABLE_SELECTOR = '[data-digitable-kind]';

function stripGeneratedTableElements(svg: string): string {
	const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
	const root = doc.documentElement;
	if (!root || root.tagName.toLowerCase() !== 'svg') return svg;

	root.querySelectorAll(GENERATED_TABLE_SELECTOR).forEach((element) => element.remove());
	return new XMLSerializer().serializeToString(root);
}

async function svgStringToTexture(svg: string): Promise<Texture> {
	const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
	try {
		return (await Assets.load({
			src: objectUrl,
			format: 'svg',
			parser: 'svg',
			resolution: 1
		})) as Texture;
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

function drawTableBounds(table: Table) {
	return new Graphics()
		.rect(0, 0, table.table.width, table.table.height)
		.fill({ color: 0xf8fafc })
		.stroke({ color: 0x475569, width: 2, alpha: 0.65 });
}

function drawFreeSlot(graphics: Graphics, slot: TableSlot) {
	graphics
		.roundRect(0, 0, slot.width, slot.height, 8)
		.fill({ color: 0x2563eb, alpha: 0.08 })
		.stroke({ color: 0x2563eb, width: 2, alpha: 0.65 });
}

function drawHorizontalFlexSlot(graphics: Graphics, slot: TableSlot) {
	graphics
		.roundRect(0, 0, slot.width, slot.height, 8)
		.fill({ color: 0x16a34a, alpha: 0.08 })
		.stroke({ color: 0x16a34a, width: 2, alpha: 0.6 });
}

function drawGridSlot(graphics: Graphics, slot: TableSlot) {
	graphics
		.roundRect(0, 0, slot.width, slot.height, 8)
		.fill({ color: 0x16a34a, alpha: 0.08 })
		.stroke({ color: 0x16a34a, width: 2, alpha: 0.6 });
	if (slot.layout?.mode !== 'grid') return;
	for (let row = 0; row < slot.layout.rows; row += 1) {
		for (let column = 0; column < slot.layout.columns; column += 1) {
			graphics
				.roundRect(
					column * (TABLE_CARD_WIDTH + slot.layout.gapX),
					row * (TABLE_CARD_HEIGHT + slot.layout.gapY),
					TABLE_CARD_WIDTH,
					TABLE_CARD_HEIGHT,
					8
				)
				.stroke({ color: 0x16a34a, width: 1, alpha: 0.42 });
		}
	}
}

function drawSlots(slots: TableSlot[]) {
	const layer = new Container();
	for (const slot of slots) {
		const graphics = new Graphics();
		if (slot.layout?.mode === 'horizontal-flex') {
			drawHorizontalFlexSlot(graphics, slot);
		} else if (slot.layout?.mode === 'grid') {
			drawGridSlot(graphics, slot);
		} else {
			drawFreeSlot(graphics, slot);
		}
		graphics.position.set(slot.x, slot.y);
		graphics.pivot.set(slot.width / 2, slot.height / 2);
		graphics.position.set(slot.x + slot.width / 2, slot.y + slot.height / 2);
		graphics.angle = slot.rotation ?? 0;
		layer.addChild(graphics);
	}
	return layer;
}

export async function createTableLayer(input: {
	table: Table;
	customTableSvg: string | null;
}) {
	const layer = new Container();
	layer.eventMode = 'none';
	layer.interactiveChildren = false;
	layer.addChild(drawTableBounds(input.table));

	if (input.customTableSvg && svgHasCustomTableContent(input.customTableSvg)) {
		try {
			const texture = await svgStringToTexture(stripGeneratedTableElements(input.customTableSvg));
			const sprite = new Sprite(texture);
			sprite.width = input.table.table.width;
			sprite.height = input.table.table.height;
			layer.addChild(sprite);
		} catch (error) {
			console.warn('Failed to render custom table SVG in play mode.', error);
		}
	}

	layer.addChild(drawSlots(input.table.slots));
	return layer;
}
