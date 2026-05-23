import { LayoutContainer } from '@pixi/layout/components';
import { Application, Container, Graphics, type Renderer } from 'pixi.js';
import { BoardGameItemNew } from '$lib/pixi/item';

export class HandContainer {
	container: LayoutContainer;
	private app: Application<Renderer>;
	private handTrayChrome: Container;
	private handTrayShadow: Graphics | null = null;
	private handTrayBody: Graphics | null = null;
	private handTrayInner: Graphics | null = null;
	private handTrayTopLine: Graphics | null = null;
	private cardsContainer: LayoutContainer;
	boardGameItems: Set<BoardGameItemNew>;

	constructor(app: Application<Renderer>) {
		this.app = app;
		this.boardGameItems = new Set();
		this.container = new LayoutContainer({ layout: {} });
		this.container.zIndex = 10;
		this.container.sortableChildren = true;

		this.handTrayChrome = new Container();
		this.handTrayChrome.eventMode = 'none';
		this.handTrayChrome.zIndex = 0;
		this.container.addChild(this.handTrayChrome);

		this.cardsContainer = new LayoutContainer({
			layout: {
				justifyContent: 'center',
				flexDirection: 'row',
				alignItems: 'flex-end',
				alignContent: 'center',
				gap: 4
			}
		});
		this.cardsContainer.zIndex = 1;
		this.container.addChild(this.cardsContainer);

		this.drawHandTrayChrome();

		this.app.renderer.on('resize', () => {
			this.drawHandTrayChrome();
		});
	}

	// Having to set scale 1 here is a problem. Scale should never have to be set seperately and should always be 1.
	// I have to find a better system for the sizing of the items
	addItem(item: BoardGameItemNew) {
		item.isInHand = true;
		item.resetLayoutTransform();
		item.scale.set(1);
		item.rotation = 0;
		item.pivot.set(0, 0);
		item.x = 0;
		item.y = 0;
		item.alpha = 1.0;
		this.boardGameItems.add(item);
		const wrapper = new LayoutContainer({
			layout: {
				height: '100%',
				aspectRatio: item.baseAspectRatio,
				objectFit: 'contain',
				objectPosition: 'center'
			}
		});
		wrapper.zIndex = 1;
		wrapper.addChild(item);
		this.cardsContainer.addChild(wrapper);
	}

	async removeItem(item: BoardGameItemNew) {
		this.boardGameItems.delete(item);
		item.isInHand = false;
		const overflowWrapper = item.parent;

		if (overflowWrapper) {
			overflowWrapper.removeChild(item);

			const layoutWrapper = overflowWrapper.parent;

			if (layoutWrapper) {
				const removed = this.cardsContainer.removeChild(layoutWrapper);

				setTimeout(() => {
					removed.destroy();
				}, 1);
			}
		}
		// if (wrapper && wrapper.parent === this.container) {
		// 	this.container.removeChild(wrapper);
		// }
	}

	hasItem(item: BoardGameItemNew): boolean {
		return this.boardGameItems.has(item);
	}

	clear() {
		this.boardGameItems.clear();
		this.cardsContainer.removeChildren();
	}

	private drawHandTrayChrome() {
		const sw = this.app.screen.width;
		const sh = this.app.screen.height;

		this.handTrayChrome.removeChildren();

		const trayW = Math.max(420, Math.min(980, sw * 0.74));
		const trayH = Math.max(120, Math.min(190, sh * 0.18));
		const r = 18;

		this.container.layout = {
			width: trayW,
			height: trayH,
			marginBottom: 12,
			justifyContent: 'center',
			flexDirection: 'row',
			alignItems: 'flex-end',
			alignContent: 'center'
		};

		this.cardsContainer.layout = {
			width: trayW,
			height: trayH,
			justifyContent: 'center',
			flexDirection: 'row',
			alignItems: 'flex-end',
			alignContent: 'center',
			gap: 4
		};

		const x = 0;
		const y = 0;

		this.handTrayShadow = new Graphics();
		this.handTrayShadow
			.roundRect(x, y - 10, trayW, trayH + 22, r + 4)
			.fill({ color: 0x000000, alpha: 0.18 });
		this.handTrayChrome.addChild(this.handTrayShadow);

		this.handTrayBody = new Graphics();
		this.handTrayBody.roundRect(x, y, trayW, trayH, r).fill(0x4b2414);
		this.handTrayBody
			.roundRect(x + 0.5, y + 0.5, trayW - 1, trayH - 1, r)
			.stroke({ color: 0xd9b06f, alpha: 0.26, width: 1 });
		this.handTrayChrome.addChild(this.handTrayBody);

		this.handTrayInner = new Graphics();
		this.handTrayInner
			.roundRect(x + 2, y + 2, trayW - 4, Math.max(18, trayH * 0.35), r - 2)
			.fill({ color: 0x8b4a2a, alpha: 0.1 });
		this.handTrayInner
			.roundRect(x + 2, y + trayH * 0.5, trayW - 4, trayH * 0.48 - 2, r - 2)
			.fill({ color: 0x000000, alpha: 0.12 });
		this.handTrayChrome.addChild(this.handTrayInner);

		this.handTrayTopLine = new Graphics();
		this.handTrayTopLine
			.roundRect(x + 12, y + 2, trayW - 24, 2, 2)
			.fill({ color: 0xffdfaa, alpha: 0.35 });
		this.handTrayChrome.addChild(this.handTrayTopLine);

		const lipShadow = new Graphics();
		lipShadow.rect(x + 8, y - 6, trayW - 16, 8).fill({ color: 0x000000, alpha: 0.1 });
		this.handTrayChrome.addChild(lipShadow);
	}
}
