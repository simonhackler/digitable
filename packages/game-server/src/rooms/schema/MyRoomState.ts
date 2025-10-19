import { ArraySchema, MapSchema, Schema, SetSchema, type } from "@colyseus/schema";


// export class BoardItem extends Schema {
//     @type("number") x: number;
//     @type("number") y: number;
//     @type("boolean") isFaceUp: boolean;
//     @type("string") owner: string = "";
//     @type("string") id: string = "";
//     @type("number") idx: number;
//     @type("boolean") visible: boolean;
// }
//

export interface InitGamePayload {
    stacks: { id: string; componentIds: string[] }[];
}
// Board, Tokens, Tiles, Figures, Cards, Dice
export class Positionable extends Schema {
    @type("number") x: number;
    @type("number") y: number;
    @type("boolean") visible: boolean;
}

export class Flippable extends Schema {
    @type("boolean") isFaceUp: boolean = true;
}

export class Component extends Schema {
    @type("string") id: string;
    @type("string") owner: string = "";
    @type("string") type: 'card' | 'stack';
}

export class Item extends Schema {
    @type(Component) component = new Component();
    @type(Positionable) position = new Positionable();
    @type(Flippable) flip = new Flippable();
}

export class Stack extends Schema {
    @type([ "string" ]) componentIds = new ArraySchema<string>();
}

export class Deck extends Schema {
    @type(Component) component = new Component();
    @type(Positionable) position = new Positionable();
    @type(Flippable) flip = new Flippable();
    @type(Stack) stack = new Stack();
}

export class Player extends Schema {
    @type("string") id: string = "";
    @type({ set: String }) hand = new SetSchema<string>();
}

// export class BoardgameRoomStateOld extends Schema {
//     @type({map: BoardItem}) cards = new MapSchema<BoardItem>();
//     @type({ map: Player }) players = new MapSchema<Player>();
// }

export class BoardGameRoomState extends Schema {
    @type({ map: Component }) components = new MapSchema<Component>();
    @type({ map: Positionable }) positions = new MapSchema<Positionable>();
    @type({ map: Flippable }) flippable = new MapSchema<Flippable>();
    @type({ map: Stack }) stacks = new MapSchema<Stack>();
    @type({ map: Player }) players = new MapSchema<Player>();
}
