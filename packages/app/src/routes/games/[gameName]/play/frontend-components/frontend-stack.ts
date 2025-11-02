import {
    BoardGameRoomState,
    Component,
    Stack
} from 'boardgame-server/src/rooms/schema/MyRoomState';
import { type SchemaCallbackProxy } from '@colyseus/schema';
import { Room } from 'colyseus.js';
import { Container } from 'pixi.js';

export class FrontendStack {

    component: Component;
    room: Room<BoardGameRoomState>;
    sessionId: string;
    stack: Stack;

    constructor(room: Room<BoardGameRoomState>, component: Component, stacks: Container, stack: Stack, s: SchemaCallbackProxy<BoardGameRoomState>) {
        // This will be the same on every single one of these classes.
        this.room = room;
        this.sessionId = room.sessionId;
        this.component = component;
        this.stack = stack;

        // s(stack).onChange(() => {
        // });
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
