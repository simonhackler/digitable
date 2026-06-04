import { Container } from 'pixi.js';
import type { LayoutStyles } from '@pixi/layout';
import type {
	ClientFlippable,
	ClientPosition,
	ClientStack
} from '$lib/play/frontend-components/position';

export type VisualRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

function rectFromBounds(bounds: ReturnType<Container['getLocalBounds']>): VisualRect {
	const rect = 'rectangle' in bounds ? bounds.rectangle : bounds;
	return {
		x: rect.x,
		y: rect.y,
		width: rect.width,
		height: rect.height
	};
}

export class BoardGameItemNew extends Container {
	public readonly id: string;
	public readonly itemContainer: Container;
	public readonly baseAspectRatio: number;
	private readonly contentRect: VisualRect;
	private readonly baseLayoutStyle: LayoutStyles;
	public readonly clientPosition: ClientPosition | null;
	public readonly clientFlippable: ClientFlippable | null;
	public readonly clientStack: ClientStack | null;
	public isInHand = false;
	private displayedRotation = 0;

	constructor(
		itemContainer: Container,
		id: string,
		clientPosition: ClientPosition | null = null,
		clientFlippable: ClientFlippable | null = null,
		clientStack: ClientStack | null = null
	) {
		const aspectRatio = itemContainer.width / itemContainer.height;
		const contentRect = rectFromBounds(itemContainer.getLocalBounds());
		super({
			layout: {
				aspectRatio
			}
		});
		this.id = id;
		this.layout = true;
		this.baseAspectRatio = aspectRatio;
		this.contentRect = contentRect;
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
			this.refreshVisualRotation();
			clientPosition.onPositionChanged.subscribe((newPos) => {
				if (this.destroyed) return;
				if (this.isInHand) return;
				const position = this.position;
				if (!position) return;
				this.visible = newPos.visible;
				this.renderable = newPos.visible;
				position.set(newPos.x, newPos.y);
				this.refreshVisualRotation();
			});
		}
		this.clientFlippable = clientFlippable;
		this.clientStack = clientStack;
		this.refreshVisualRotation();
	}

	get visualRotationDegrees() {
		return this.displayedRotation;
	}

	setDisplayedRotation(value: number) {
		const rotation = ((value % 360) + 360) % 360;
		const previousBounds = this.parent ? this.contentWorldBounds() : null;
		const previousCenter = previousBounds
			? {
					x: previousBounds.x + previousBounds.width / 2,
					y: previousBounds.y + previousBounds.height / 2
				}
			: null;

		this.displayedRotation = rotation;
		this.itemContainer.angle = 0;
		if (rotation === 0) {
			this.itemContainer.pivot.set(0, 0);
			this.itemContainer.position.set(0, 0);
		} else {
			const centerX = this.contentRect.x + this.contentRect.width / 2;
			const centerY = this.contentRect.y + this.contentRect.height / 2;
			this.itemContainer.pivot.set(centerX, centerY);
			this.itemContainer.position.set(centerX, centerY);
			this.itemContainer.angle = rotation;
		}

		if (!this.parent || !previousCenter) return;
		const nextBounds = this.contentWorldBounds();
		const nextCenter = {
			x: nextBounds.x + nextBounds.width / 2,
			y: nextBounds.y + nextBounds.height / 2
		};
		const currentGlobal = this.parent.toGlobal(this.position);
		const targetLocal = this.parent.toLocal({
			x: currentGlobal.x + previousCenter.x - nextCenter.x,
			y: currentGlobal.y + previousCenter.y - nextCenter.y
		});
		this.position.set(targetLocal.x, targetLocal.y);
	}

	refreshVisualRotation() {
		this.setDisplayedRotation(this.clientPosition?.clientPositionState.rotation ?? 0);
	}

	contentLocalBounds(): VisualRect {
		return { ...this.contentRect };
	}

	contentWorldBounds(): VisualRect {
		const { x, y, width, height } = this.contentRect;
		const points = [
			this.itemContainer.toGlobal({ x, y }),
			this.itemContainer.toGlobal({ x: x + width, y }),
			this.itemContainer.toGlobal({ x: x + width, y: y + height }),
			this.itemContainer.toGlobal({ x, y: y + height })
		];
		const xs = points.map((point) => point.x);
		const ys = points.map((point) => point.y);
		const minX = Math.min(...xs);
		const maxX = Math.max(...xs);
		const minY = Math.min(...ys);
		const maxY = Math.max(...ys);
		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY
		};
	}

	contentBoundsIn(container: Container): VisualRect {
		const { x, y, width, height } = this.contentRect;
		const points = [
			container.toLocal(this.itemContainer.toGlobal({ x, y })),
			container.toLocal(this.itemContainer.toGlobal({ x: x + width, y })),
			container.toLocal(this.itemContainer.toGlobal({ x: x + width, y: y + height })),
			container.toLocal(this.itemContainer.toGlobal({ x, y: y + height }))
		];
		const xs = points.map((point) => point.x);
		const ys = points.map((point) => point.y);
		const minX = Math.min(...xs);
		const maxX = Math.max(...xs);
		const minY = Math.min(...ys);
		const maxY = Math.max(...ys);
		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY
		};
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
