import {
	Application,
	Container,
	Graphics,
	Sprite,
	Texture,
	TilingSprite,
	type Renderer
} from 'pixi.js';

type BoardChrome = {
	container: Container;
	draw: () => void;
	destroy: () => void;
};

function makeCanvasTexture(
	draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
	w: number,
	h: number
) {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('2D context not available');
	draw(ctx, w, h);
	return Texture.from(canvas);
}

function makeNoiseTexture(size = 128) {
	return makeCanvasTexture(
		(ctx, w, h) => {
			const img = ctx.createImageData(w, h);
			for (let i = 0; i < img.data.length; i += 4) {
				const v = 200 + Math.floor(Math.random() * 56);
				const a = Math.floor(Math.random() * 22);
				img.data[i] = v;
				img.data[i + 1] = v;
				img.data[i + 2] = v;
				img.data[i + 3] = a;
			}
			ctx.putImageData(img, 0, 0);
		},
		size,
		size
	);
}

function makeRadialVignetteTexture(w: number, h: number) {
	return makeCanvasTexture(
		(ctx, cw, ch) => {
			const cx = cw / 2;
			const cy = ch * 0.42;
			const r = Math.max(cw, ch) * 0.75;
			const g = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
			g.addColorStop(0, 'rgba(255, 235, 190, 0.16)');
			g.addColorStop(0.45, 'rgba(255, 220, 160, 0.05)');
			g.addColorStop(0.75, 'rgba(0, 0, 0, 0.00)');
			g.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, cw, ch);
		},
		w,
		h
	);
}

export function createBoardChrome(app: Application<Renderer>): BoardChrome {
	const container = new Container();
	container.eventMode = 'none';

	let noiseTex: Texture | null = null;
	let boardBgBase: Graphics | null = null;
	let boardVignette: Sprite | null = null;
	let boardGrain: TilingSprite | null = null;

	function cleanup() {
		if (boardVignette?.texture) boardVignette.texture.destroy(true);
		boardBgBase?.destroy();
		boardVignette?.destroy();
		boardGrain?.destroy();
		boardBgBase = null;
		boardVignette = null;
		boardGrain = null;
	}

	function draw() {
		const w = app.screen.width;
		const h = app.screen.height;

		container.removeChildren();
		cleanup();

		if (!noiseTex) noiseTex = makeNoiseTexture(128);

		boardBgBase = new Graphics();
		boardBgBase.rect(0, 0, w, h).fill(0xc98a24);
		boardBgBase.rect(0, 0, w, h * 0.55).fill({ color: 0xe0a53a, alpha: 0.18 });
		boardBgBase.rect(0, h * 0.45, w, h * 0.55).fill({ color: 0x8a5413, alpha: 0.12 });
		container.addChild(boardBgBase);

		boardVignette = new Sprite(makeRadialVignetteTexture(w, h));
		boardVignette.position.set(0, 0);
		container.addChild(boardVignette);

		boardGrain = new TilingSprite({
			texture: noiseTex,
			width: w,
			height: h
		});
		boardGrain.alpha = 0.08;
		boardGrain.tileScale.set(1.5);
		container.addChild(boardGrain);
	}

	function destroy() {
		cleanup();
		noiseTex?.destroy(true);
		container.destroy({ children: true });
	}

	return { container, draw, destroy };
}
