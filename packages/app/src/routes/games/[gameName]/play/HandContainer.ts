import { LayoutContainer } from '@pixi/layout/components';
import { BoardGameItemNew } from '$lib/pixi/item';

export class HandContainer {
	container: LayoutContainer;
	boardGameItems: Set<BoardGameItemNew>;

	constructor() {
		this.boardGameItems = new Set();
		this.container = new LayoutContainer({
			layout: {
				width: '70%',
				height: '15%',
				justifyContent: 'center',
				flexDirection: 'row',
				alignItems: 'flex-end',
				alignContent: 'center',
				gap: 4,
				backgroundColor: 'red'
			}
		});
		this.container.zIndex = 10;
	}

	// Having to set scale 1 here is a problem. Scale should never have to be set seperately and should always be 1.
	// I have to find a better system for the sizing of the items
	addItem(item: BoardGameItemNew) {
		item.isInHand = true;
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
				aspectRatio: item.width / item.height,
				objectFit: 'contain',
				objectPosition: 'center'
			}
		});
		wrapper.addChild(item);
		this.container.addChild(wrapper);
	}

	async removeItem(item: BoardGameItemNew) {
		this.boardGameItems.delete(item);
		item.isInHand = false;
		const overflowWrapper = item.parent;

		if (overflowWrapper) {
			overflowWrapper.removeChild(item);

			const layoutWrapper = overflowWrapper.parent;

			if (layoutWrapper) {
				const removed = this.container.removeChild(layoutWrapper);

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
		this.container.removeChildren();
	}
}
