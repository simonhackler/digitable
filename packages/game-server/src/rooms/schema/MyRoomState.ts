import { ArraySchema, MapSchema, Schema, SetSchema, type } from "@colyseus/schema";

export interface InitGamePayload {
    stacks: { componentIds: string[] }[];
}

// Board, Tokens, Tiles, Figures, Cards, Dice
export class Positionable extends Schema {
    @type("number") x: number;
    @type("number") y: number;
    @type("boolean") visible: boolean;

    constructor(x: number, y: number, visible: boolean) {
        super();
        this.x = x;
        this.y = y;
        this.visible = visible;
    }
}

export class Flippable extends Schema {
    @type("boolean") isFaceUp: boolean;

    constructor(isFaceUp: boolean) {
        super();
        this.isFaceUp = isFaceUp;
    }
}

export class Component extends Schema {
    @type("string") id: string;
    @type("string") owner: string;
    @type("string") type: 'card' | 'stack';

    constructor(id: string, owner: string, type: 'card' | 'stack') {
        super();
        this.id = id;
        this.owner = owner;
        this.type = type;
    }
}

export class Item extends Schema {
    @type(Component) component: Component;
    @type(Positionable) position: Positionable;
    @type(Flippable) flip: Flippable;

    constructor(component: Component, position: Positionable, flip: Flippable) {
        super();
        this.component = component;
        this.position = position;
        this.flip = flip;
    }
}

export class Stack extends Schema {
    @type([ "string" ]) componentIds: ArraySchema<string>;

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
    @type(Positionable) position: Positionable;
    @type(Flippable) flip: Flippable;
    @type(Stack) stack: Stack;

    constructor(component: Component, position: Positionable, flip: Flippable, stack: Stack) {
        super();
        this.component = component;
        this.position = position;
        this.flip = flip;
        this.stack = stack;
    }
}

export class Player extends Schema {
    @type("string") id: string;
    @type({ set: String }) hand: SetSchema<string>;

    constructor(id: string) {
        super();
        this.id = id;
        this.hand = new SetSchema<string>();
    }
}

// export class BoardgameRoomStateOld extends Schema {
//     @type({map: BoardItem}) cards = new MapSchema<BoardItem>();
//     @type({ map: Player }) players = new MapSchema<Player>();
// }

export class BoardGameRoomState extends Schema {
    @type({ map: Component }) components: MapSchema<Component>;
    @type({ map: Positionable }) positions: MapSchema<Positionable>;
    @type({ map: Flippable }) flippable: MapSchema<Flippable>;
    @type({ map: Stack }) stacks: MapSchema<Stack>;
    @type({ map: Player }) players: MapSchema<Player>;

    constructor() {
        super();
        this.components = new MapSchema<Component>();
        this.positions = new MapSchema<Positionable>();
        this.flippable = new MapSchema<Flippable>();
        this.stacks = new MapSchema<Stack>();
        this.players = new MapSchema<Player>();
    }
}
