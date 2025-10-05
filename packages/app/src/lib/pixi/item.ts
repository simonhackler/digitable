import { Container } from 'pixi.js';

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
