import { Container } from 'pixi.js';
import type {
	ClientFlippable,
	ClientPosition,
	ClientStack
} from '../../routes/games/[gameName]/play/frontend-components/position';

// I need to move Container into a property and not have it extend Container
export class BoardGameItemNew {
	public readonly id: string;
	public readonly itemContainer: Container;
	public readonly clientPosition: ClientPosition | null;
	public readonly clientFlippable: ClientFlippable | null;
	public readonly clientStack: ClientStack | null;

	constructor(
		itemContainer: Container,
		id: string,
		clientPosition: ClientPosition | null = null,
		clientFlippable: ClientFlippable | null = null,
		clientStack: ClientStack | null = null
	) {
		super({
			layout: {
				aspectRatio: itemContainer.width / itemContainer.height
			}
		});
		this.id = id;
		this.layout = true;
		this.itemContainer = itemContainer;
		this.addChild(this.itemContainer);
		this.clientPosition = clientPosition;
		// Not sure that I like this. E.g flipping is done outside of this. Probably should choose one method
		// The fix is changing this class that does not extend container and instead having a container property on this class
		// Then the container can be passed from the outside and subscribed to on the outside. This is probably the best way to do this.
		if (clientPosition) {
			clientPosition.onPositionChanged.subscribe((newPos) => {
				if (this.destroyed) return;
				const position = this.position;
				if (!position) return;
				position.set(newPos.x, newPos.y);
			});
		}
		this.clientFlippable = clientFlippable;
		this.clientStack = clientStack;
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
