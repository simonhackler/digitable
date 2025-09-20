import { Container } from 'pixi.js';

export class BoardGameItem extends Container {
	private readonly frontContainer: Container;
	private readonly backContainer: Container;

	constructor(frontContainer: Container, backContainer: Container) {
		super();
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
