import { Application, Container, Graphics, Sprite } from 'pixi.js';
import type { BoardGameItemNew } from '$lib/pixi/item';

export class PreviewHelper {
	previewContainer: Container;
	private app: Application;
	private lastPointer: { x: number; y: number } = { x: 0, y: 0 };
	private previewForId: string | null = null;
	private previewSprite: Sprite | null = null;

	constructor(app: Application) {
		this.app = app;
		this.previewContainer = new Container({ zIndex: 10000 });
		this.previewContainer.visible = false;
		this.app.stage.addChild(this.previewContainer);
	}

	updatePointer(x: number, y: number) {
		this.lastPointer.x = x;
		this.lastPointer.y = y;
	}

	private ensureOnScreen(x: number, y: number, w: number, h: number) {
		const pad = 8;
		const nx = Math.min(Math.max(x, pad), this.app.screen.width - w - pad);
		const ny = Math.min(Math.max(y, pad), this.app.screen.height - h - pad);
		return { x: nx, y: ny };
	}

	private updatePreviewPosition() {
		if (!this.previewContainer || !this.previewContainer.visible) return;

		const offset = 24;
		const x = this.lastPointer.x + offset;
		const y = this.lastPointer.y + offset;

		const { x: nx, y: ny } = this.ensureOnScreen(
			x,
			y,
			this.previewContainer.width,
			this.previewContainer.height
		);
		this.previewContainer.position.set(nx, ny);
	}

	hidePreview() {
		this.previewContainer.visible = false;
		this.previewForId = null;
		if (this.previewSprite) {
			this.previewSprite.destroy({ texture: true });
			this.previewSprite = null;
		}
		this.previewContainer.removeChildren();
	}

	showPreview(item: BoardGameItemNew) {
		if (!item || !this.app) return;

		if (this.previewForId === item.id && this.previewContainer.visible) {
			this.updatePreviewPosition();
			return;
		}

		this.hidePreview();
		this.previewForId = item.id;

		const lastChild = item.children[item.children.length - 1];
		// Better selection border system needed
		const hasSelectionBorder = lastChild && lastChild.zIndex === 9999;
		if (hasSelectionBorder) {
			lastChild.visible = false;
		}

		const tex = this.app.renderer.generateTexture({ target: item, resolution: 2 });

		if (hasSelectionBorder) {
			lastChild.visible = true;
		}
		this.previewSprite = new Sprite(tex);

		const maxW = Math.min(this.app.screen.width * 0.45, 600);
		const maxH = Math.min(this.app.screen.height * 0.65, 800);
		const scale = Math.min(maxW / this.previewSprite.width, maxH / this.previewSprite.height);

		this.previewSprite.scale.set(scale);

		const pad = 12;
		const bgW = (this.previewSprite.width | 0) + pad * 2;
		const bgH = (this.previewSprite.height | 0) + pad * 2;

		const bg = new Graphics();
		bg.roundRect(0, 0, bgW, bgH, 14)
			.fill({ color: 0xffffff, alpha: 0.98 })
			.stroke({ width: 2, color: 0x000000, alpha: 0.08 });

		const shadow = new Graphics();
		shadow.roundRect(6, 8, bgW, bgH, 14).fill({ color: 0x000000, alpha: 0.12 });

		this.previewSprite.position.set(pad, pad);

		this.previewContainer.removeChildren();
		this.previewContainer.addChild(shadow, bg, this.previewSprite);
		this.previewContainer.visible = true;

		this.updatePreviewPosition();
	}

	destroy() {
		this.hidePreview();
		this.previewContainer.destroy();
	}
}
