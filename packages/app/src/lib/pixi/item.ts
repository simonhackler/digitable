import { Container } from 'pixi.js';
import type {
	ClientFlippable,
	ClientPosition
} from '../../routes/games/[gameName]/play/frontend-components/position';

export class BoardGameItem extends Container {
	public readonly id: string;
	private readonly frontContainer: Container;
	private readonly backContainer: Container;

	constructor(frontContainer: Container, backContainer: Container, id: string) {
		super({
			layout: {
				aspectRatio: frontContainer.width / frontContainer.height
			}
		});
		this.id = id;
		this.layout = true;
		this.frontContainer = frontContainer;
		this.backContainer = backContainer;
		this.addChild(this.frontContainer);
		this.addChild(this.backContainer);

		this.backContainer.visible = false;
	}

	flip() {
		const showsFront = this.frontContainer.visible;
		this.frontContainer.visible = !showsFront;
		this.backContainer.visible = showsFront;
	}

	isFrontShowing() {
		return this.frontContainer.visible;
	}
}

export class BoardGameItemNew extends Container {
	public readonly id: string;
	private readonly itemContainer: Container;
	public readonly clientPosition: ClientPosition | null;
	public readonly clientFlippable: ClientFlippable | null;

	constructor(
		itemContainer: Container,
		id: string,
		clientPosition: ClientPosition | null = null,
		clientFlippable: ClientFlippable | null = null
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
		this.clientFlippable = clientFlippable;
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
