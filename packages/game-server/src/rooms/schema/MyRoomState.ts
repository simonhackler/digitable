import { ArraySchema, MapSchema, Schema, SetSchema, type } from '@colyseus/schema';
import { Stroke } from './stroke-schema';

export type LayoutNodeKind = 'table' | 'slot' | 'hand' | 'component' | 'stack' | 'group';
export type LayoutMode = 'free' | 'horizontal-flex' | 'grid' | 'stack' | 'hand';

export interface InitStackPayload {
	componentIds: string[];
}

export interface InitLayoutPayload {
	mode?: LayoutMode;
	maxChildren?: number;
	acceptedDeckNames?: string[];
	acceptedCardIds?: string[];
}

export interface InitLayoutNodePayload {
	id: string;
	kind: LayoutNodeKind;
	parentId?: string;
	componentId?: string;
	x: number;
	y: number;
	width?: number;
	height?: number;
	rotation?: number;
	visible?: boolean;
	locked?: boolean;
	layout?: InitLayoutPayload;
}

export interface InitTableItemPayload {
	id: string;
	type: 'card' | 'stack';
	componentIds: string[];
	x: number;
	y: number;
	parentId?: string;
	componentName?: string;
}

export interface InitGamePayload {
	stacks?: InitStackPayload[];
	tableItems?: InitTableItemPayload[];
	layoutNodes?: InitLayoutNodePayload[];
}

// Should support different types of positions. For example a position might have differen
// so for example there might be a board that is a grid (Summonners War), a board that is a freeform x, y (Warhammer) board or
// a graph based board. So a position has to know for what board type it is and would probably even need a reference to the board itself?
// Also a horizontal/vertical flex layout

export class HandPosition extends Schema {
	@type('number') positionInHand: number;
	@type('number') playerId: string;

	constructor(positionInHand: number, playerId: string) {
		super();
		this.positionInHand = positionInHand;
		this.playerId = playerId;
	}
}

export class Layout extends Schema {
	@type('string') mode: LayoutMode;
	@type('number') maxChildren: number;
	@type(['string']) acceptedDeckNames: ArraySchema<string>;
	@type(['string']) acceptedCardIds: ArraySchema<string>;

	constructor(mode: LayoutMode = 'free') {
		super();
		this.mode = mode;
		this.maxChildren = 0;
		this.acceptedDeckNames = new ArraySchema<string>();
		this.acceptedCardIds = new ArraySchema<string>();
	}
}

export class LayoutNode extends Schema {
	@type('string') id: string;
	@type('string') kind: LayoutNodeKind;
	@type('string') parentId: string;
	@type('string') componentId: string;
	@type('number') x: number;
	@type('number') y: number;
	@type('number') width: number;
	@type('number') height: number;
	@type('number') rotation: number;
	@type('boolean') visible: boolean;
	@type('boolean') locked: boolean;
	@type(Layout) layout?: Layout;

	constructor(id = '', kind: LayoutNodeKind = 'group', x = 0, y = 0, visible = true) {
		super();
		this.id = id;
		this.kind = kind;
		this.parentId = '';
		this.componentId = '';
		this.x = x;
		this.y = y;
		this.width = 0;
		this.height = 0;
		this.rotation = 0;
		this.visible = visible;
		this.locked = false;
	}
}

export class Flippable extends Schema {
	@type('boolean') isFaceUp: boolean;

	constructor(isFaceUp: boolean) {
		super();
		this.isFaceUp = isFaceUp;
	}
}

export class Component extends Schema {
	@type('string') id: string;
	@type('string') owner: string;
	@type('string') type: 'card' | 'stack';
	@type('string') componentName: string;

	constructor(id: string, owner: string, type: 'card' | 'stack', componentName = '') {
		super();
		this.id = id;
		this.owner = owner;
		this.type = type;
		this.componentName = componentName;
	}
}

export class Item extends Schema {
	@type(Component) component: Component;
	@type(LayoutNode) position: LayoutNode;
	@type(Flippable) flip: Flippable;

	constructor(component: Component, position: LayoutNode, flip: Flippable) {
		super();
		this.component = component;
		this.position = position;
		this.flip = flip;
	}
}

export interface FaceState<T> {
	currentIndex: number;
	possibleValues: T[];
}

// export class FaceStateImpl extends Schema implements FaceState<'up' | 'down'> {
// 	@type('number') currentIndex: number;
// 	@type(['string']) possibleValues: ArraySchema<'up' | 'down'> = new ArraySchema<'up' | 'down'>([
// 		'up',
// 		'down'
// 	]);
//
// 	constructor(startIndex: number) {
// 		super();
// 		this.currentIndex = startIndex;
// 	}
// }
//
export class Stack extends Schema {
	@type(['string']) componentIds: ArraySchema<string>;

	constructor(componentIds?: string[]) {
		super();
		this.componentIds = new ArraySchema<string>();
		if (componentIds) {
			this.componentIds.push(...componentIds);
		}
	}
}

export class Deck extends Schema {
	@type(Component) component: Component;
	@type(LayoutNode) position: LayoutNode;
	@type(Flippable) flip: Flippable;
	@type(Stack) stack: Stack;

	constructor(component: Component, position: LayoutNode, flip: Flippable, stack: Stack) {
		super();
		this.component = component;
		this.position = position;
		this.flip = flip;
		this.stack = stack;
	}
}

export class Player extends Schema {
	@type('string') id: string;
	@type({ set: 'string' }) hand: SetSchema<string>;

	constructor(id: string) {
		super();
		this.id = id;
		this.hand = new SetSchema<string>();
	}
}

export class BoardGameRoomState extends Schema {
	@type({ map: Component }) components: MapSchema<Component>;
	@type({ map: LayoutNode }) positions: MapSchema<LayoutNode>;
	@type({ map: Flippable }) flippable: MapSchema<Flippable>;
	@type({ map: Stack }) stacks: MapSchema<Stack>;
	@type({ map: Player }) players: MapSchema<Player>;
	@type({ map: Stroke }) strokes: MapSchema<Stroke>;

	constructor() {
		super();
		this.components = new MapSchema<Component>();
		this.positions = new MapSchema<LayoutNode>();
		this.flippable = new MapSchema<Flippable>();
		this.stacks = new MapSchema<Stack>();
		this.players = new MapSchema<Player>();
		this.strokes = new MapSchema<Stroke>();
	}
}
