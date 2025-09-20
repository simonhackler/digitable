import { ArraySchema, Schema, SetSchema, type } from "@colyseus/schema";

export class Card extends Schema {
    @type("number") x: number;
    @type("number") y: number;
    @type("boolean") isFaceUp: boolean;
    @type("string") owner: string = "";
}


export class BoardgameRoomState extends Schema {
    @type([Card]) cards = new ArraySchema<Card>();
    @type({ set: "string" }) players = new SetSchema<string>();
}
