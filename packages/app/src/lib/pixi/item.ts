import { Container } from 'pixi.js';
import type { LayoutStyles } from '@pixi/layout';
import type {
	ClientFlippable,
	ClientPosition,
	ClientStack
} from '../../routes/games/[gameName]/play/frontend-components/position';

export class BoardGameItemNew extends Container {
	public readonly id: string;
	private readonly itemContainer: Container;
	private readonly baseLayoutStyle: LayoutStyles;
	public readonly clientPosition: ClientPosition | null;
	public readonly clientFlippable: ClientFlippable | null;
	public readonly clientStack: ClientStack | null;
	public isInHand = false;

	constructor(
		itemContainer: Container,
		id: string,
		clientPosition: ClientPosition | null = null,
		clientFlippable: ClientFlippable | null = null,
		clientStack: ClientStack | null = null
	) {
		const aspectRatio = itemContainer.width / itemContainer.height;
		super({
			layout: {
				aspectRatio
			}
		});
		this.id = id;
		this.layout = true;
		this.baseLayoutStyle = {
			aspectRatio
		};
		this.itemContainer = itemContainer;
		this.addChild(this.itemContainer);
		this.clientPosition = clientPosition;
		if (clientPosition) {
            // this.position.set(clientPosition.x, clientPosition.y);
			clientPosition.onPositionChanged.subscribe((newPos) => {
				if (this.destroyed) return;
				if (this.isInHand) return;
				const position = this.position;
				if (!position) return;
				this.visible = true;
				position.set(newPos.x, newPos.y);
			});
		}
		this.clientFlippable = clientFlippable;
		this.clientStack = clientStack;
	}

	resetLayoutTransform() {
		const layout = this.layout;
		if (!layout) return;
		layout.setStyle(this.baseLayoutStyle);
		layout.forceUpdate();
		layout.invalidateRoot(this);
	}
}

// This could extend Flippable?
export class CardContainer extends Container {
	constructor(frontContainer: Container, backContainer: Container) {
		super({
			layout: {
				aspectRatio: frontContainer.width / frontContainer.height
			}
		});
		this.layout = true;
		this.addChild(frontContainer);
		this.addChild(backContainer);

		backContainer.visible = false;
	}
}
