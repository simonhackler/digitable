import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import {
	svgHasCustomTableContent,
	type SetupSlot,
	type TableSetup
} from '../../routes/games/[gameName]/setup/table-setup';
import { SETUP_PLAY_CARD_HEIGHT, SETUP_PLAY_CARD_WIDTH } from './setup-geometry';

const GENERATED_SETUP_SELECTOR = '[data-digitable-kind]';

function stripGeneratedSetupElements(svg: string): string {
	const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
	const root = doc.documentElement;
	if (!root || root.tagName.toLowerCase() !== 'svg') return svg;

	root.querySelectorAll(GENERATED_SETUP_SELECTOR).forEach((element) => element.remove());
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

function drawTableBounds(setup: TableSetup) {
	return new Graphics()
		.rect(0, 0, setup.table.width, setup.table.height)
		.fill({ color: 0xf8fafc })
		.stroke({ color: 0x475569, width: 2, alpha: 0.65 });
}

function drawFreeSlot(graphics: Graphics, slot: SetupSlot) {
	graphics
		.roundRect(0, 0, slot.width, slot.height, 8)
		.fill({ color: 0x2563eb, alpha: 0.08 })
		.stroke({ color: 0x2563eb, width: 2, alpha: 0.65 });
}

function drawHorizontalFlexSlot(graphics: Graphics, slot: SetupSlot) {
	graphics
		.roundRect(0, 0, slot.width, slot.height, 8)
		.fill({ color: 0x16a34a, alpha: 0.08 })
		.stroke({ color: 0x16a34a, width: 2, alpha: 0.6 });
}

function drawGridSlot(graphics: Graphics, slot: SetupSlot) {
	graphics
		.roundRect(0, 0, slot.width, slot.height, 8)
		.fill({ color: 0x16a34a, alpha: 0.08 })
		.stroke({ color: 0x16a34a, width: 2, alpha: 0.6 });
	if (slot.layout?.mode !== 'grid') return;
	for (let row = 0; row < slot.layout.rows; row += 1) {
		for (let column = 0; column < slot.layout.columns; column += 1) {
			graphics
				.roundRect(
					column * (SETUP_PLAY_CARD_WIDTH + slot.layout.gapX),
					row * (SETUP_PLAY_CARD_HEIGHT + slot.layout.gapY),
					SETUP_PLAY_CARD_WIDTH,
					SETUP_PLAY_CARD_HEIGHT,
					8
				)
				.stroke({ color: 0x16a34a, width: 1, alpha: 0.42 });
		}
	}
}

function drawSlots(slots: SetupSlot[]) {
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

export async function createSetupTableLayer(input: {
	setup: TableSetup;
	customTableSvg: string | null;
}) {
	const layer = new Container();
	layer.eventMode = 'none';
	layer.interactiveChildren = false;
	layer.addChild(drawTableBounds(input.setup));

	if (input.customTableSvg && svgHasCustomTableContent(input.customTableSvg)) {
		try {
			const texture = await svgStringToTexture(stripGeneratedSetupElements(input.customTableSvg));
			const sprite = new Sprite(texture);
			sprite.width = input.setup.table.width;
			sprite.height = input.setup.table.height;
			layer.addChild(sprite);
		} catch (error) {
			console.warn('Failed to render custom table SVG in play mode.', error);
		}
	}

	layer.addChild(drawSlots(input.setup.slots));
	return layer;
}
