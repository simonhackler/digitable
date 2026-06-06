import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { type Table } from '../../routes/games/[gameName]/setup/table';

const GENERATED_PLACEMENT_SELECTOR = '[data-digitable-kind="placement"]';

function stripGeneratedPlacements(svg: string): string {
	const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
	const root = doc.documentElement;
	if (!root || root.tagName.toLowerCase() !== 'svg') return svg;

	root.querySelectorAll(GENERATED_PLACEMENT_SELECTOR).forEach((element) => element.remove());
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

export async function createTableLayer(input: { table: Table; customTableSvg: string | null }) {
	const layer = new Container();
	layer.eventMode = 'none';
	layer.interactiveChildren = false;
	layer.addChild(drawTableBounds(input.table));

	if (input.customTableSvg) {
		try {
			const texture = await svgStringToTexture(stripGeneratedPlacements(input.customTableSvg));
			const sprite = new Sprite(texture);
			sprite.width = input.table.table.width;
			sprite.height = input.table.table.height;
			layer.addChild(sprite);
		} catch (error) {
			console.warn('Failed to render custom table SVG in play mode.', error);
		}
	}

	return layer;
}
