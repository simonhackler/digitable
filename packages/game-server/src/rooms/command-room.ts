import { Client, Room, logger } from 'colyseus';

import {
    BoardGameRoomState,
    Component,
    Flippable,
    Player,
    Stack,
    type InitGamePayload
} from './schema/MyRoomState';
import {
    applyPlacement,
    clearNodeParent,
    createPositionNode,
    initializeGameState,
    isFiniteCoordinate,
    normalizeRotation,
    setNodeParent,
    resolvePlacementParentId,
    targetCanAcceptChild,
    validateGameInitializationPayload
} from './layout-state';
import { Command, Dispatcher } from '../command';
import { randomUUID } from 'crypto';
import { StrokeCreateCommand, StrokeDeleteCommand } from './stroke-commands';

type CommandRoomOptions<Metadata = Record<string, unknown>, Auth = unknown> = {
    state: BoardGameRoomState;
    metadata: Metadata;
    client: Client<{ auth: Auth }>;
};

export class CommandRoom<Metadata = Record<string, unknown>, Auth = unknown> extends Room<
    CommandRoomOptions<Metadata, Auth>
> {
    dispatcher = new Dispatcher<Room<any>>(this);
    roomCommands = new Map<string, new () => Command<CommandRoom, unknown>>([
        ['ready', ReadyCommand],
        ['flip', FlipCommand],
        ['init', InitCommand],
        ['move', MoveCommand],
        ['moveend', MoveEndCommand],
        ['draw', DrawCommand],
        ['play', PlayCommand],
        ['stack', StackCommand],
        ['shuffle', ShuffleCommand],
        ['strokeCreate', StrokeCreateCommand],
        ['strokeDelete', StrokeDeleteCommand]
    ]);

    onCreate(_options?: unknown) {
        logger.info('CommandRoom created');
        this.state = new BoardGameRoomState();
        this.state.phase = 'playing';
        this.onMessage('cmd', (client, message) => {
            logger.info(`Received command: ${message.commandType} from ${client.sessionId}`);
            const CommandClass = this.roomCommands.get(message.commandType);
            if (CommandClass) {
                const command = new CommandClass();
                this.dispatcher.dispatch(command, { ...message.payload, sessionId: client.sessionId });
            }
        });
    }

    onJoin(client: Client, _options: unknown, _auth?: unknown) {
        logger.info('Client joined:', client.sessionId);
        this.dispatcher.dispatch(new OnJoinCommand(), {
            sessionId: client.sessionId,
            name: playerNameFromAuth(client.auth),
            userId: playerUserIdFromAuth(client.auth)
        });
    }

    onLeave(client: Client) {
        this.removePlayer(client.sessionId);
    }

    onDispose() {
        this.dispatcher.stop();
    }

    protected removePlayer(sessionId: string) {
        this.state.players.delete(sessionId);
        void this.onLobbyChanged();
    }

    async onLobbyChanged() { }

    async tryStartGame() {
        if (this.state.phase !== 'lobby') return;

        const players = Array.from(this.state.players.values());
        const hasEnoughPlayers = players.length >= this.state.minPlayers;
        const allReady = players.length > 0 && players.every((player) => player.ready);
        if (!hasEnoughPlayers || !allReady) return;

        this.state.phase = 'playing';
        await this.onLobbyChanged();
    }
}

function playerNameFromAuth(auth: unknown) {
    if (!auth || typeof auth !== 'object' || !('name' in auth)) return 'Player';

    const name = String(auth.name).trim().replace(/\s+/g, ' ').slice(0, 80);
    return name || 'Player';
}

function playerUserIdFromAuth(auth: unknown) {
    if (!auth || typeof auth !== 'object' || !('userId' in auth)) return '';

    return String(auth.userId);
}

function getValidComponent(
    state: BoardGameRoomState,
    componentId: string,
    sessionId: string,
    allowOwned: boolean = true
) {
    const component = state.components.get(componentId);
    if (!component) {
        console.error('Invalid card id:', componentId);
        return null;
    }
    if (!allowOwned && component.owner !== '' && component.owner !== sessionId) {
        console.warn(`Component ${componentId} is currently owned by another player.`);
        return null;
    }
    return component;
}

export class OnJoinCommand extends Command<
    CommandRoom,
    {
        sessionId: string;
        name: string;
        userId: string;
    }
> {
    execute({ sessionId, name, userId } = this.payload) {
        if (this.state.players.has(sessionId)) return;
        const player = new Player(sessionId, name, userId);
        this.state.players.set(sessionId, player);
        void this.room.onLobbyChanged();
    }
}

export class ReadyCommand extends Command<
    CommandRoom,
    {
        sessionId: string;
    }
> {
    execute(payload: this['payload']) {
        const player = this.state.players.get(payload.sessionId);
        if (!player) return;

        player.ready = !player.ready;
        return this.room.tryStartGame();
    }

    validate(payload: this['payload']) {
        if (this.state.phase !== 'lobby') return false;
        return this.state.players.has(payload.sessionId);
    }
}

export class FlipCommand extends Command<
    CommandRoom,
    {
        sessionId: string;
        componentId: string;
        isFaceUp: boolean;
    }
> {
    execute(payload: this['payload']) {
        const component = this.state.flippable.get(payload.componentId);
        component.isFaceUp = payload.isFaceUp;
    }

    validate(payload: this['payload']) {
        const component = getValidComponent(this.state, payload.componentId, payload.sessionId, false);
        if (!component) return false;
        return this.state.flippable.has(component.id);
    }
}

export class InitCommand extends Command<
    CommandRoom,
    {
        sessionId: string;
    } & InitGamePayload
> {
    execute(payload: this['payload']) {
        initializeGameState(this.state, payload, randomUUID);
    }

    validate(_payload: this['payload']) {
        if (this.state.phase !== 'playing') {
            console.warn('Game is still in lobby');
            return false;
        }
        if (this.state.components.size !== 0 || this.state.positions.size !== 0) {
            console.warn('Game already initialized');
            return false;
        }
        return validateGameInitializationPayload(_payload);
    }
}

export class MoveCommand extends Command<
    CommandRoom,
    {
        sessionId: string;
        componentId: string;
        x: number;
        y: number;
        rotation?: number;
        targetNodeId?: string;
    }
> {
    execute(payload: this['payload']) {
        applyPlacement(
            this.state,
            payload.componentId,
            payload.x,
            payload.y,
            payload.targetNodeId,
            false,
            payload.rotation
        );

        const component = this.state.components.get(payload.componentId);
        component.owner = payload.sessionId;
    }

    validate(payload: this['payload']) {
        const component = getValidComponent(this.state, payload.componentId, payload.sessionId, false);
        if (!component) return false;
        if (!isFiniteCoordinate(payload.x) || !isFiniteCoordinate(payload.y)) return false;
        if (payload.rotation !== undefined && !isFiniteCoordinate(payload.rotation)) return false;
        const position = this.state.positions.get(component.id);
        if (!position || position.locked) return false;
        if (payload.targetNodeId === undefined) return true;
        if (typeof payload.targetNodeId !== 'string') return false;
        return targetCanAcceptChild(this.state, component.id, payload.targetNodeId);
    }
}

export class MoveEndCommand extends Command<
    CommandRoom,
    {
        sessionId: string;
        cardId: string;
        x: number;
        y: number;
        rotation?: number;
        targetNodeId?: string;
    }
> {
    execute(payload: this['payload']) {
        applyPlacement(
            this.state,
            payload.cardId,
            payload.x,
            payload.y,
            payload.targetNodeId,
            true,
            payload.rotation
        );
        const component = this.state.components.get(payload.cardId);
        component.owner = '';
        console.log(`Card ${payload.cardId} move ended at (${payload.x}, ${payload.y})`);
    }

    validate(payload: this['payload']) {
        const card = getValidComponent(this.state, payload.cardId, payload.sessionId, true);
        if (!card) return false;
        const position = this.state.positions.get(payload.cardId);
        if (!position || position.locked) return false;
        const pureRotation =
            card.owner === '' &&
            payload.rotation !== undefined &&
            payload.x === position.x &&
            payload.y === position.y;
        if (card.owner !== payload.sessionId && !pureRotation) {
            console.warn(`Card ${payload.cardId} moveend ignored; not owned by player.`);
            return false;
        }
        if (!isFiniteCoordinate(payload.x) || !isFiniteCoordinate(payload.y)) return false;
        if (payload.rotation !== undefined && !isFiniteCoordinate(payload.rotation)) return false;
        if (payload.targetNodeId !== undefined && typeof payload.targetNodeId !== 'string')
            return false;
        const parentId = resolvePlacementParentId(this.state, payload.targetNodeId);
        if (parentId && !targetCanAcceptChild(this.state, payload.cardId, parentId)) return false;
        return true;
    }
}

export class DrawCommand extends Command<
    CommandRoom,
    {
        sessionId: string;
        cardId: string;
    }
> {
    execute(payload: this['payload']) {
        const player = this.state.players.get(payload.sessionId);
        let cardId = payload.cardId;
        const stack = this.state.stacks.get(payload.cardId);
        const stackPosition = this.state.positions.get(payload.cardId);
        if (stack) {
            const stackParentId = stackPosition?.parentId ?? '';
            const flippable = this.state.flippable.get(payload.cardId);
            if (flippable.isFaceUp) {
                cardId = stack.componentIds.splice(0, 1)[0];
            } else {
                cardId = stack.componentIds.splice(stack.componentIds.length - 1, 1)[0];
            }
            if (stack.componentIds.length <= 1) {
                const remainingId = stack.componentIds[0];
                if (remainingId) {
                    const remainingPosition = this.state.positions.get(remainingId);
                    if (remainingPosition && stackPosition) {
                        remainingPosition.x = stackPosition.x;
                        remainingPosition.y = stackPosition.y;
                        remainingPosition.rotation = stackPosition.rotation;
                        remainingPosition.visible = true;
                        setNodeParent(this.state, remainingId, stackParentId);
                    }
                    const stackFlip = this.state.flippable.get(payload.cardId);
                    const remainingFlip = this.state.flippable.get(remainingId);
                    if (stackFlip && remainingFlip) {
                        remainingFlip.isFaceUp = stackFlip.isFaceUp;
                    }
                }
                this.state.stacks.delete(payload.cardId);
                this.state.positions.delete(payload.cardId);
                this.state.flippable.delete(payload.cardId);
                this.state.components.delete(payload.cardId);
            }
        } else {
            clearNodeParent(this.state, cardId);
        }
        const flippable = this.state.flippable.get(cardId);
        flippable.isFaceUp = true;

        player.hand.add(cardId);
        const cardComponent = this.state.components.get(cardId);
        cardComponent.owner = payload.sessionId;
        const drawnCardPosition = this.state.positions.get(cardId);
        if (drawnCardPosition) {
            drawnCardPosition.rotation = 0;
            drawnCardPosition.visible = false;
        }
        clearNodeParent(this.state, cardId);
    }

    validate(payload: this['payload']) {
        const card = getValidComponent(this.state, payload.cardId, payload.sessionId, false);
        if (!card) return false;

        const player = this.state.players.get(payload.sessionId);
        if (!player) {
            console.error('Player not found:', payload.sessionId);
            return false;
        }
        return true;
    }
}

export class PlayCommand extends Command<
    CommandRoom,
    {
        sessionId: string;
        cardId: string;
        x: number;
        y: number;
        rotation?: number;
        targetNodeId?: string;
    }
> {
    execute(payload: this['payload']) {
        const player = this.state.players.get(payload.sessionId);
        player.hand.delete(payload.cardId);

        applyPlacement(
            this.state,
            payload.cardId,
            payload.x,
            payload.y,
            payload.targetNodeId,
            true,
            payload.rotation
        );
        const position = this.state.positions.get(payload.cardId);
        position.visible = true;

        const component = this.state.components.get(payload.cardId);
        component.owner = '';
    }

    validate(payload: this['payload']) {
        const card = getValidComponent(this.state, payload.cardId, payload.sessionId, true);
        if (!card) return false;

        const player = this.state.players.get(payload.sessionId);
        if (!player) {
            console.error('Player not found:', payload.sessionId);
            return false;
        }

        if (!player.hand.has(payload.cardId)) {
            console.warn(`Card ${payload.cardId} is not in player's hand`);
            return false;
        }
        if (!isFiniteCoordinate(payload.x) || !isFiniteCoordinate(payload.y)) return false;
        if (payload.rotation !== undefined && !isFiniteCoordinate(payload.rotation)) return false;
        const position = this.state.positions.get(payload.cardId);
        if (!position || position.locked) return false;
        if (payload.targetNodeId !== undefined && typeof payload.targetNodeId !== 'string')
            return false;
        const parentId = resolvePlacementParentId(this.state, payload.targetNodeId);
        if (parentId && !targetCanAcceptChild(this.state, payload.cardId, parentId)) return false;
        return true;
    }
}

// Stack Command has to be reworked like this:
// - Support dropping a stack onto a stack
// - Support dropping a stack onto a card
// - Support grouping multiple/cards stack into one stack
// This means we take in a list of ids and combine them into one stack, we have to check for exisiting stacks and combine them
// It should be the orientation of the first card/stack
export class StackCommand extends Command<
    CommandRoom,
    {
        sessionId: string;
        ids: string[];
        x: number;
        y: number;
    }
> {
    execute(payload: this['payload']) {
        const ids = payload.ids;
        if (ids.length < 2) return;

        const sourceId = ids[0];
        const sourceComponent = this.state.components.get(sourceId);
        const sourceFlippable = this.state.flippable.get(sourceId);
        const sourceFaceUp = sourceFlippable?.isFaceUp ?? false;
        const sourcePosition = this.state.positions.get(sourceId);
        if (!sourceComponent) return;

        const forStackIds: string[] = [];
        const consumedStackIds: string[] = [];
        const player = this.state.players.get(payload.sessionId);
        if (!player) return;

        for (const id of ids) {
            const targetStack = this.state.stacks.get(id);
            if (targetStack) {
                forStackIds.push(...targetStack.componentIds);
                if (id !== sourceId) consumedStackIds.push(id);
            } else {
                forStackIds.push(id);
            }
        }

        const stackId = this.state.stacks.has(sourceId) ? sourceId : randomUUID();
        const componentName = sourceComponent.componentName;
        const stackComponent =
            this.state.components.get(stackId) ?? new Component(stackId, '', 'stack', componentName);
        const stackPosition = createPositionNode(
            stackId,
            'stack',
            sourcePosition?.x ?? payload.x,
            sourcePosition?.y ?? payload.y,
            true,
            sourcePosition?.parentId ?? ''
        );
        stackPosition.rotation = normalizeRotation(sourcePosition?.rotation ?? 0);
        const stackFlippable = new Flippable(sourceFaceUp);
        const stack = this.state.stacks.get(stackId) ?? new Stack();
        stack.componentIds.splice(0, stack.componentIds.length, ...forStackIds);
        stackComponent.componentName = componentName;

        for (const id of forStackIds) {
            const position = this.state.positions.get(id);
            if (position) {
                position.visible = false;
                clearNodeParent(this.state, id);
            }
            const component = this.state.components.get(id);
            if (component) component.owner = '';
            if (player.hand.has(id)) player.hand.delete(id);
        }

        for (const id of consumedStackIds) {
            this.state.stacks.delete(id);
            this.state.positions.delete(id);
            this.state.flippable.delete(id);
            this.state.components.delete(id);
        }

        this.state.positions.set(stackId, stackPosition);
        this.state.flippable.set(stackId, stackFlippable);
        this.state.stacks.set(stackId, stack);
        this.state.components.set(stackId, stackComponent);
    }

    validate(payload: this['payload']) {
        const player = this.state.players.get(payload.sessionId);
        if (!player) {
            console.error('Player not found:', payload.sessionId);
            return false;
        }

        if (!Array.isArray(payload.ids) || payload.ids.length < 2) return false;
        if (!isFiniteCoordinate(payload.x) || !isFiniteCoordinate(payload.y)) return false;

        const cardIds: string[] = [];
        for (const [index, id] of payload.ids.entries()) {
            if (typeof id !== 'string' || id.trim() === '' || payload.ids.indexOf(id) !== index)
                return false;

            const component = getValidComponent(this.state, id, payload.sessionId, false);
            const position = this.state.positions.get(id);
            if (!component || !position || position.locked) return false;
            if (index === 0 && player.hand.has(id)) return false;

            if (component.type === 'stack') {
                const stack = this.state.stacks.get(id);
                if (!stack || stack.componentIds.length === 0) return false;
                cardIds.push(...stack.componentIds);
            } else {
                cardIds.push(id);
            }
        }

        return cardIds.length >= 2 && new Set(cardIds).size === cardIds.length;
    }
}

export class ShuffleCommand extends Command<
    CommandRoom,
    {
        sessionId: string;
        stackId: string;
    }
> {
    execute(payload: this['payload']) {
        const stack = this.state.stacks.get(payload.stackId);
        if (!stack) return;

        const ids = stack.componentIds;
        for (let i = ids.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = ids[i];
            ids[i] = ids[j];
            ids[j] = temp;
        }
    }

    validate(payload: this['payload']) {
        const component = getValidComponent(this.state, payload.stackId, payload.sessionId, true);
        if (!component) return false;
        if (component.type !== 'stack') return false;

        const stack = this.state.stacks.get(payload.stackId);
        if (!stack) return false;
        if (stack.componentIds.length < 2) return false;
        return true;
    }
}
