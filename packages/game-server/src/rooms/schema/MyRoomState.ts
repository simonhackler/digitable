import { ArraySchema, MapSchema, Schema, SetSchema, type } from "@colyseus/schema";

export class Card extends Schema {
    @type("number") x: number;
    @type("number") y: number;
    @type("boolean") isFaceUp: boolean;
    @type("string") owner: string = "";
    @type("string") id: string = "";
    @type("number") idx: number;
}

export class Player extends Schema {
    @type("string") id: string
    @type([Card]) hand = new ArraySchema<Card>();
}

export class BoardgameRoomState extends Schema {
    @type({map: Card}) cards = new MapSchema<Card>();
    @type({ map: Player }) players = new MapSchema<Player>();
}
