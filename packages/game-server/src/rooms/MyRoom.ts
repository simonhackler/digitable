import { Room, Client } from "@colyseus/core";
import { Card, BoardgameRoomState } from "./schema/MyRoomState";

export class MyRoom extends Room<BoardgameRoomState> {
    maxClients = 4;
    state = new BoardgameRoomState();

    onCreate(options: any) {
        this.onMessage("initializeGame", (client, message) => {
            if (this.state.cards.length === 0) {
                for (let i = 0; i < message.cardCount; i++) {
                    const card = new Card();
                    card.x = 50 + (i * 220);
                    card.y = 50;
                    card.isFaceUp = true;
                    this.state.cards.push(card);
                }
                console.log("Game initialized with", message.cardCount, "cards.");
            }
        });

        this.onMessage("updateCard", (client, message) => {
            if (message.cardIndex < 0 || message.cardIndex >= this.state.cards.length) {
                console.error("Invalid card index:", message.cardIndex);
                return;
            }
            const card = this.state.cards[message.cardIndex];
            card.x = message.x;
            card.y = message.y;
            card.isFaceUp = message.isFaceUp;
        });
    }

    onJoin(client: Client, options: any) {
        console.log(client.sessionId, "joined!");
    }

    onLeave(client: Client, consented: boolean) {
        console.log(client.sessionId, "left!");
    }

    onDispose() {
        console.log("room", this.roomId, "disposing...");
    }

}
