import { ArraySchema, Schema, type } from "@colyseus/schema";

export class Card extends Schema {
    @type("number") x: number;
    @type("number") y: number;
    @type("boolean") isFaceUp: boolean;
}

export class BoardgameRoomState extends Schema {
    @type([Card]) cards = new ArraySchema<Card>();
}
