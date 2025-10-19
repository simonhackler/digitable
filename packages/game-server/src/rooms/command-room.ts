import { Client, Room } from "colyseus";

import { BoardGameRoomState as BoardGameRoomState, Deck, Item, Player, InitGamePayload } from "./schema/MyRoomState";
import { Command, Dispatcher } from "../command";

export class CommandRoom extends Room<BoardGameRoomState> {
    dispatcher = new Dispatcher(this);
    roomCommands = new Map<string, new () => Command<CommandRoom, any>>([
        ["flip", FlipCommand],
        ["init", InitCommand],
        ["move", MoveCommand],
        ["moveend", MoveEndCommand],
        ["draw", DrawCommand],
        ["play", PlayCommand]
    ]);

    onCreate() {
        this.setState(new BoardGameRoomState());
        this.onMessage("cmd", (client, message) => {
            const CommandClass = this.roomCommands.get(message.commandType);
            if (CommandClass) {
                const command = new CommandClass();
                this.dispatcher.dispatch(command, { ...message.payload, sessionId: client.sessionId });
            }
        });
    }

    onJoin(client: Client, options: any) {
        this.dispatcher.dispatch(new OnJoinCommand(), {
            sessionId: client.sessionId
        });
    }

    onDispose() {
        this.dispatcher.stop();
    }
}

function getValidComponent(state: BoardGameRoomState, componentId: string, sessionId: string, allowOwned: boolean = true) {
    const component = state.components.get(componentId);
    if (!component) {
        console.error("Invalid card id:", componentId);
        return null;
    }
    if (!allowOwned && component.owner !== "" && component.owner !== sessionId) {
        console.warn(`Component ${componentId} is currently owned by another player.`);
        return null;
    }
    return component;
}


export class OnJoinCommand extends Command<CommandRoom, {
    sessionId: string
}> {
    execute({ sessionId } = this.payload) {
        const player = new Player();
        player.id = sessionId;
        this.state.players.set(sessionId, player);
    }
}

export class FlipCommand extends Command<CommandRoom, {
    sessionId: string, componentId: string, isFaceUp: boolean
}> {
    execute(payload: this["payload"]) {
        const component = this.state.flippable.get(payload.componentId);
        component.isFaceUp = payload.isFaceUp;
    }

    validate(payload: this["payload"]) {
        const component = getValidComponent(this.state, payload.componentId, payload.sessionId, false);
        return this.state.flippable.has(component.id);
    }
}

export class InitCommand extends Command<CommandRoom, {
    sessionId: string
} & InitGamePayload> {
    execute(payload: this["payload"]) {
        for (const stack of payload.stacks) {
            // create deck
            const deck = new Deck();
            deck.component.id = stack.id;
            deck.component.type = "stack";
            deck.position.x = 50;
            deck.position.y = 50;
            deck.position.visible = true;
            deck.flip.isFaceUp = false;
            for (const cardId of stack.componentIds) {
                deck.stack.componentIds.push(cardId);
            }
            this.state.positions.set(deck.component.id, deck.position);
            this.state.flippable.set(deck.component.id, deck.flip);
            this.state.components.set(deck.component.id, deck.component);
            this.state.stacks.set(deck.component.id, deck.stack);

            // create cards
            for (let i = 0; i < stack.componentIds.length; i++) {
                const cardId = stack.componentIds[i];
                const card = new Item(); // Still necessary? Maybe nice helper
                card.flip.isFaceUp = true;
                card.position.x = 10 + i * 220;
                card.position.y = 50 + i * 320;
                card.component.id = cardId;
                card.position.visible = true;
                this.state.positions.set(cardId, card.position);
                this.state.flippable.set(cardId, card.flip);
                this.state.components.set(cardId, card.component);
            }
        }
        console.log("Game initialized with");
    }

    validate(payload: this["payload"]) {
        if (this.state.components.values().toArray().length !== 0) {
            console.warn("Game already initialized");
            return false;
        }
        return true;
    }
}

export class MoveCommand extends Command<CommandRoom, {
    sessionId: string, componentId: string, x: number, y: number
}> {
    execute(payload: this["payload"]) {
        const position = this.state.positions.get(payload.componentId);
        position.x = payload.x;
        position.y = payload.y;

        const component = this.state.components.get(payload.componentId);
        component.owner = payload.sessionId;
    }

    validate(payload: this["payload"]) {
        const component = getValidComponent(this.state, payload.componentId, payload.sessionId, false);
        return this.state.positions.has(component.id);
    }
}

export class MoveEndCommand extends Command<CommandRoom, {
    sessionId: string, cardId: string, x: number, y: number
}> {
    execute(payload: this["payload"]) {
        const card = this.state.cards.get(payload.cardId);
        card.x = payload.x;
        card.y = payload.y;
        card.owner = "";
        console.log(`Card ${payload.cardId} move ended at (${payload.x}, ${payload.y})`);
    }

    validate(payload: this["payload"]) {
        const card = getValidComponent(this.state, payload.cardId, payload.sessionId, true);
        if (!card) return false;
        if (card.owner !== payload.sessionId) {
            console.warn(`Card ${payload.cardId} moveend ignored; not owned by player.`);
            return false;
        }
        return true;
    }
}

export class DrawCommand extends Command<CommandRoom, {
    sessionId: string, cardId: string
}> {
    execute(payload: this["payload"]) {
        const card = this.state.cards.get(payload.cardId);
        const player = this.state.players.get(payload.sessionId);
        player.hand.set(payload.cardId, card);
        card.owner = payload.sessionId;
        card.visible = false;
    }

    validate(payload: this["payload"]) {
        const card = getValidComponent(this.state, payload.cardId, payload.sessionId, false);
        if (!card) return false;

        const player = this.state.players.get(payload.sessionId);
        if (!player) {
            console.error("Player not found:", payload.sessionId);
            return false;
        }
        return true;
    }
}

export class PlayCommand extends Command<CommandRoom, {
    sessionId: string, cardId: string, x: number, y: number
}> {
    execute(payload: this["payload"]) {
        const card = this.state.cards.get(payload.cardId);
        const player = this.state.players.get(payload.sessionId);
        player.hand.delete(payload.cardId);
        card.x = payload.x;
        card.y = payload.y;
        card.owner = "";
        card.visible = true;
    }

    validate(payload: this["payload"]) {
        const card = getValidComponent(this.state, payload.cardId, payload.sessionId, true);
        if (!card) return false;

        const player = this.state.players.get(payload.sessionId);
        if (!player) {
            console.error("Player not found:", payload.sessionId);
            return false;
        }

        if (!player.hand.has(payload.cardId)) {
            console.warn(`Card ${payload.cardId} is not in player's hand`);
            return false;
        }
        return true;
    }
}
