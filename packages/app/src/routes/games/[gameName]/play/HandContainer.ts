import { LayoutContainer } from '@pixi/layout/components';
import { BoardGameItem } from '$lib/pixi/item';

export class HandContainer {
    container: LayoutContainer;
    boardGameItems: Set<BoardGameItem>;

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

    addItem(item: BoardGameItem) {
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

    removeItem(item: BoardGameItem) {
        this.boardGameItems.delete(item);
        const wrapper = item.parent;
        if (wrapper && wrapper.parent === this.container) {
            this.container.removeChild(wrapper);
        }
    }

    hasItem(item: BoardGameItem): boolean {
        return this.boardGameItems.has(item);
    }

    clear() {
        this.boardGameItems.clear();
        this.container.removeChildren();
    }
}
