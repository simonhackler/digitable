import { Room, Client } from "@colyseus/core";
import { Card, BoardgameRoomState, Player } from "./schema/MyRoomState";

export class MyRoom extends Room<BoardgameRoomState> {
    maxClients = 4;
    state = new BoardgameRoomState();

    onCreate(options: any) {
        this.onMessage("init", (client, message: { length: number }) => {
            if (this.state.cards.size !== 0) {
                return;
            }

            for (let i = 0; i < length; i++) {
                const cardId = crypto.randomUUID()
                const card = new Card();
                card.x = 50 + (i * 220);
                card.y = 50;
                card.isFaceUp = true;
                this.state.cards.set(cardId, card);
            };

            console.log("Game initialized with", cardIds.length, "cards.");
        });

        this.onMessage("flip", (client, message: { cardId: string; isFaceUp: boolean }) => {
            const card = this.state.cards.get(message.cardId);
            if (!card) {
                console.error("Invalid card id:", message.cardId);
                return;
            }
            if (card.owner !== "" && card.owner !== client.sessionId) {
                console.warn(`Card ${message.cardId} is currently owned by another player.`);
                return;
            }
            card.isFaceUp = message.isFaceUp;
            console.log(`Card ${message.cardId} flipped to ${message.isFaceUp ? 'face up' : 'face down'}`);
        });

        this.onMessage("move", (client, message: { cardId: string; x: number; y: number }) => {
            const card = this.state.cards.get(message.cardId);
            if (!card) {
                console.error("Invalid card id:", message.cardId);
                return;
            }
            if (card.owner !== "" && card.owner !== client.sessionId) {
                console.warn(`Card ${message.cardId} is currently owned by another player.`);
                return;
            }
            card.x = message.x;
            card.y = message.y;
            card.owner = client.sessionId;
        });

        this.onMessage("moveend", (client, message: { cardId: string; x: number; y: number }) => {
            const card = this.state.cards.get(message.cardId);
            if (!card) {
                console.error("Invalid card id:", message.cardId);
                return;
            }
            if (card.owner !== client.sessionId) {
                console.warn(`Card ${message.cardId} moveend ignored; not owned by player.`);
                return;
            }
            card.x = message.x;
            card.y = message.y;
            card.owner = "";
            console.log(`Card ${message.cardId} move ended at (${message.x}, ${message.y})`);
        });

        this.onMessage("draw", (client, message: { cardId: string }) => {
            const card = this.state.cards.get(message.cardId);
            if (!card) {
                console.error("Invalid card id:", message.cardId);
                return;
            }
            if (card.owner !== "" && card.owner !== client.sessionId) {
                console.warn(`Card ${message.cardId} is already owned by another player.`);
                return;
            }
        });
    }

    onJoin(client: Client, options: any) {
        const player = new Player();
        player.id = client.sessionId;
        this.state.players.set(client.sessionId, player);
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
