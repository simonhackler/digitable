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

        this.onMessage("flip", (client, message) => {
            if (message.cardIndex < 0 || message.cardIndex >= this.state.cards.length) {
                console.error("Invalid card index:", message.cardIndex);
                return;
            }
            const card = this.state.cards[message.cardIndex];
            card.isFaceUp = message.isFaceUp;
            console.log(`Card ${message.cardIndex} flipped to ${message.isFaceUp ? 'face up' : 'face down'}`);
        });

        this.onMessage("move", (client, message) => {
            if (message.cardIndex < 0 || message.cardIndex >= this.state.cards.length) {
                console.error("Invalid card index:", message.cardIndex);
                return;
            }
            const card = this.state.cards[message.cardIndex];
            if (card.owner !== "" && card.owner !== client.sessionId) {
                console.warn(`Card ${message.cardIndex} is currently owned by another player.`);
                return;
            }
            card.x = message.x;
            card.y = message.y;
            card.owner = client.sessionId;
        });

        this.onMessage("moveend", (client, message) => {
            if (message.cardIndex < 0 || message.cardIndex >= this.state.cards.length) {
                console.error("Invalid card index:", message.cardIndex);
                return;
            }
            const card = this.state.cards[message.cardIndex];
            card.x = message.x;
            card.y = message.y;
            card.owner = "";
            console.log(`Card ${message.cardIndex} move ended at (${message.x}, ${message.y})`);
        });
    }

    onJoin(client: Client, options: any) {
        this.state.players.add(client.sessionId);
        console.log(client.sessionId, "joined!");
    }

    onLeave(client: Client, consented: boolean) {
        this.state.players.delete(client.sessionId);
        for (const card of this.state.cards) {
            if (card.owner === client.sessionId) {
                card.owner = "";
            }
        }
        console.log(client.sessionId, "left!");
    }

    onDispose() {
        console.log("room", this.roomId, "disposing...");
    }

}
