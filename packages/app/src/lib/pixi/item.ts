import { Container } from 'pixi.js';

export class BoardGameItem extends Container {
	private readonly frontContainer: Container;
	private readonly backContainer: Container;

	constructor(frontContainer: Container, backContainer: Container) {
		super({layout: {
            aspectRatio: frontContainer.width / frontContainer.height,
        }});
        console.log('Front Container size:', frontContainer.width, frontContainer.height);
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
