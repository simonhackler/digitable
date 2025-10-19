import {
    BoardGameRoomState,
    Positionable,
    Component
} from 'boardgame-server/src/rooms/schema/MyRoomState';
import { type SchemaCallbackProxy } from '@colyseus/schema';
import { Room } from 'colyseus.js';
import { Container } from 'pixi.js';

export class Position {

    container: Container;
    component: Component;
    room: Room<BoardGameRoomState>;
    sessionId: string;

    constructor(room: Room<BoardGameRoomState>, sessionId: string, component: Component, container: Container, position: Positionable, s: SchemaCallbackProxy<BoardGameRoomState>) {
        // This will be the same on every single one of these classes.
        this.room = room;
        this.sessionId = sessionId;
        this.container = container;
        this.component = component;


        container.x = position.x;
        container.y = position.y;

        s(position).onChange(() => {
            container.x = position.x;
            container.y = position.y;
        });
    }

    // IDEA: Refactor these functions into the commands itself. A command should then handle execution on the server and the client
    // Or I will need a frontend command or something like that?
    // I somehow want to tightly couple server and frontend commands
    moveTo(x: number, y: number) {
        if (this.component.owner !== this.sessionId && this.component.owner !== '') {
            console.warn(`Component ${this.component.id} is currently owned by another player.`);
            return;
        }
        this.container.x = x;
        this.container.y = y;
        this.room.send('cmd', {
            commandType: 'move',
            payload: {
                componentId: this.component.id,
                x: this.container.x,
                y: this.container.y
            }
        });
    }

    moveEnd(x: number, y: number) {
        this.container.x = y;
        this.container.y = y
        this.room.send('cmd', {
            commandType: 'moveend',
            payload: {
                cardId: this.component.id,
                x: this.component.x,
                y: this.component.y
            }
        });
    }

}
