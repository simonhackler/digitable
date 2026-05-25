import { Container } from 'pixi.js';
import type { LayoutStyles } from '@pixi/layout';
import type {
	ClientFlippable,
	ClientPosition,
	ClientStack
} from '$lib/play/frontend-components/position';

export class BoardGameItemNew extends Container {
	public readonly id: string;
	public readonly itemContainer: Container;
	public readonly baseAspectRatio: number;
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
		this.baseAspectRatio = aspectRatio;
		this.baseLayoutStyle = {
			aspectRatio
		};
		this.itemContainer = itemContainer;
		this.addChild(this.itemContainer);
		this.clientPosition = clientPosition;
		if (clientPosition) {
			this.position.set(clientPosition.clientPositionState.x, clientPosition.clientPositionState.y);
			this.visible = clientPosition.clientPositionState.visible;
			this.renderable = clientPosition.clientPositionState.visible;
			clientPosition.onPositionChanged.subscribe((newPos) => {
				if (this.destroyed) return;
				if (this.isInHand) return;
				const position = this.position;
				if (!position) return;
				this.visible = newPos.visible;
				this.renderable = newPos.visible;
				position.set(newPos.x, newPos.y);
			});
		}
		this.clientFlippable = clientFlippable;
		this.clientStack = clientStack;
	}

	resetLayoutTransform() {
		this.layout = this.baseLayoutStyle;
		const layout = this.layout;
		if (!layout) return;
		layout.setStyle(this.baseLayoutStyle);
		layout.forceUpdate();
		layout.invalidateRoot(this);
	}

	disableLayoutTransform() {
		this.layout = null;
	}
}

// This could extend Flippable?
export class CardContainer extends Container {
	public readonly frontSprite: Container;
	public readonly backSprite: Container;

	constructor(frontSprite: Container, backSprite: Container) {
		const aspectRatio = frontSprite.width / frontSprite.height;
		super({
			layout: {
				width: frontSprite.width,
				height: frontSprite.height,
				aspectRatio
			}
		});
		this.layout = true;
		this.frontSprite = frontSprite;
		this.backSprite = backSprite;
		this.stackFace(frontSprite, aspectRatio);
		this.stackFace(backSprite, aspectRatio);
		this.addChild(frontSprite);
		this.addChild(backSprite);

		this.showFace(true);
	}

	private stackFace(face: Container, aspectRatio: number) {
		face.position.set(0, 0);
		face.layout = {
			...(face.layout?.style ?? {}),
			position: 'absolute',
			left: 0,
			top: 0,
			width: '100%',
			height: '100%',
			aspectRatio,
			objectFit: 'contain',
			objectPosition: 'center'
		};
	}

	showFace(isFaceUp: boolean) {
		this.frontSprite.visible = true;
		this.backSprite.visible = true;
		this.frontSprite.renderable = isFaceUp;
		this.backSprite.renderable = !isFaceUp;
	}
}
