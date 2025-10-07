import { ArraySchema, MapSchema, Schema, SetSchema, type } from "@colyseus/schema";

export class BoardItem extends Schema {
    @type("number") x: number;
    @type("number") y: number;
    @type("boolean") isFaceUp: boolean;
    @type("string") owner: string = "";
    @type("string") id: string = "";
    @type("number") idx: number;
    @type("boolean") visible: boolean;
}

export class Player extends Schema {
    @type("string") id: string
    @type({map: BoardItem}) hand = new MapSchema<BoardItem>();
}

export class BoardgameRoomState extends Schema {
    @type({map: BoardItem}) cards = new MapSchema<BoardItem>();
    @type({ map: Player }) players = new MapSchema<Player>();
}
