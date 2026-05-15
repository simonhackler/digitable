import { ArraySchema, Schema, type } from '@colyseus/schema';

export type StrokeCap = 'round' | 'butt' | 'square';
export type StrokeJoin = 'round' | 'bevel' | 'miter';
export type StrokeFace = 'front' | 'back';

export interface StrokeStylePayload {
	color?: number;
	width?: number;
	alpha?: number;
	cap?: StrokeCap;
	join?: StrokeJoin;
}

export class StrokePoint extends Schema {
	@type('number') x: number;
	@type('number') y: number;

	constructor(x = 0, y = 0) {
		super();
		this.x = x;
		this.y = y;
	}
}

export class StrokeStyle extends Schema {
	@type('number') color: number;
	@type('number') width: number;
	@type('number') alpha: number;
	@type('string') cap: StrokeCap;
	@type('string') join: StrokeJoin;

	constructor(style: StrokeStylePayload = {}) {
		super();
		this.color = style.color ?? 0x111111;
		this.width = style.width ?? 8;
		this.alpha = style.alpha ?? 1;
		this.cap = style.cap ?? 'round';
		this.join = style.join ?? 'round';
	}
}

export class Stroke extends Schema {
	@type('string') id: string;
	@type('string') componentId: string;
	@type('string') face: StrokeFace;
	@type([StrokePoint]) points: ArraySchema<StrokePoint>;
	@type(StrokeStyle) style: StrokeStyle;

	constructor(
		id = '',
		componentId = '',
		face: StrokeFace = 'front',
		points: StrokePoint[] = [],
		style: StrokeStyle = new StrokeStyle()
	) {
		super();
		this.id = id;
		this.componentId = componentId;
		this.face = face;
		this.points = new ArraySchema<StrokePoint>();
		this.points.push(...points);
		this.style = style;
	}
}
