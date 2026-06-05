import {
    BoardGameRoomState,
    Component,
    Deck,
    Flippable,
    Item,
    Layout,
    LayoutNode,
    Stack,
    type InitLayoutNodePayload,
    type InitLayoutPayload,
    type InitGamePayload,
    type InitTableItemPayload,
    type LayoutMode,
    type LayoutNodeKind
} from './schema/MyRoomState';

const layoutNodeKinds = new Set<LayoutNodeKind>(['table', 'slot', 'hand', 'component', 'stack', 'group']);
const layoutModes = new Set<LayoutMode>(['free', 'horizontal-flex', 'grid', 'stack', 'hand']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim() !== '';
}

function isLayoutNodeKind(value: unknown): value is LayoutNodeKind {
    return typeof value === 'string' && layoutNodeKinds.has(value as LayoutNodeKind);
}

function isLayoutMode(value: unknown): value is LayoutMode {
    return typeof value === 'string' && layoutModes.has(value as LayoutMode);
}

function uniqueStrings(values: string[]): string[] {
    return [...new Set(values)];
}

function stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return uniqueStrings(value.filter((item): item is string => typeof item === 'string' && item.trim() !== ''));
}

function optionalString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function optionalBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function optionalNumber(value: unknown, fallback: number): number {
    return isFiniteCoordinate(value) ? value : fallback;
}

export function normalizeRotation(value: number): number {
    return ((value % 360) + 360) % 360;
}

function optionalNonNegativeInteger(value: unknown, fallback = 0): number {
    if (!isFiniteCoordinate(value)) return fallback;
    return Math.max(0, Math.floor(value));
}

function setStringArrayValues(
    target: { length: number; splice(start: number, deleteCount?: number): unknown; push(...items: string[]): number },
    values: string[]
) {
    target.splice(0, target.length);
    target.push(...uniqueStrings(values));
}

function createLayout(layout: InitLayoutPayload): Layout {
    const layoutState = new Layout(layout.mode ?? 'free');
    layoutState.maxChildren = optionalNonNegativeInteger(layout.maxChildren);
    setStringArrayValues(layoutState.acceptedDeckNames, stringArray(layout.acceptedDeckNames));
    setStringArrayValues(layoutState.acceptedCardIds, stringArray(layout.acceptedCardIds));
    return layoutState;
}

function createLayoutNode(node: InitLayoutNodePayload): LayoutNode {
    const layoutNode = new LayoutNode(
        node.id,
        node.kind,
        node.x,
        node.y,
        optionalBoolean(node.visible, true)
    );
    layoutNode.parentId = optionalString(node.parentId);
    layoutNode.componentId = optionalString(node.componentId);
    layoutNode.width = optionalNumber(node.width, 0);
    layoutNode.height = optionalNumber(node.height, 0);
    layoutNode.rotation = normalizeRotation(optionalNumber(node.rotation, 0));
    layoutNode.locked = optionalBoolean(node.locked, false);
    if (node.layout) {
        layoutNode.layout = createLayout(node.layout);
    }
    return layoutNode;
}

export function createPositionNode(
    componentId: string,
    kind: LayoutNodeKind,
    x: number,
    y: number,
    visible: boolean,
    parentId = ''
) {
    const node = new LayoutNode(componentId, kind, x, y, visible);
    node.componentId = componentId;
    node.parentId = parentId;
    return node;
}

function getOrCreateComponentPosition(
    state: BoardGameRoomState,
    componentId: string,
    kind: LayoutNodeKind,
    x: number,
    y: number,
    visible: boolean,
    parentId = ''
) {
    const position = state.positions.get(componentId) ?? createPositionNode(componentId, kind, x, y, visible, parentId);
    position.id = componentId;
    position.kind = kind;
    position.componentId = componentId;
    position.x = x;
    position.y = y;
    position.visible = visible;
    if (parentId || !position.parentId) {
        position.parentId = parentId;
    }
    state.positions.set(componentId, position);
    return position;
}

function createCardState(
    state: BoardGameRoomState,
    cardId: string,
    x: number,
    y: number,
    visible: boolean,
    isFaceUp = false,
    componentName = '',
    parentId = ''
) {
    const cardComponent = new Component(cardId, '', 'card', componentName);
    const cardPosition = getOrCreateComponentPosition(state, cardId, 'component', x, y, visible, parentId);
    const cardFlip = new Flippable(isFaceUp);
    const _card = new Item(cardComponent, cardPosition, cardFlip);

    state.flippable.set(cardId, cardFlip);
    state.components.set(cardId, cardComponent);
}

function createStackState(
    state: BoardGameRoomState,
    stackId: string,
    componentIds: string[],
    x: number,
    y: number,
    componentName = '',
    parentId = ''
) {
    const deckComponent = new Component(stackId, '', 'stack', componentName);
    const deckPosition = getOrCreateComponentPosition(state, stackId, 'stack', x, y, true, parentId);
    const deckFlip = new Flippable(false);
    const deckStack = new Stack(componentIds);
    const _deck = new Deck(deckComponent, deckPosition, deckFlip, deckStack);

    state.flippable.set(stackId, deckFlip);
    state.components.set(stackId, deckComponent);
    state.stacks.set(stackId, deckStack);
}

export function initializeGameState(
    state: BoardGameRoomState,
    payload: InitGamePayload,
    createStackId: () => string
) {
    for (const node of payload.layoutNodes ?? []) {
        state.positions.set(node.id, createLayoutNode(node));
    }

    if (payload.tableItems) {
        for (const item of payload.tableItems) {
            const parentId = item.parentId ?? state.positions.get(item.id)?.parentId ?? '';
            const componentName = item.componentName ?? '';
            if (item.type === 'card') {
                createCardState(state, item.componentIds[0], item.x, item.y, true, true, componentName, parentId);
                continue;
            }

            for (const cardId of item.componentIds) {
                createCardState(state, cardId, item.x, item.y, false, false, componentName);
            }
            createStackState(state, item.id, item.componentIds, item.x, item.y, componentName, parentId);
        }
        return;
    }

    for (const stack of payload.stacks ?? []) {
        for (let i = 0; i < stack.componentIds.length; i++) {
            const cardId = stack.componentIds[i];
            createCardState(state, cardId, 10 + i * 220, 50 + i * 320, false);
        }

        if (stack.componentIds.length === 1) {
            const position = state.positions.get(stack.componentIds[0]);
            if (position) {
                position.visible = true;
            }
        } else if (stack.componentIds.length > 1) {
            createStackState(state, createStackId(), stack.componentIds, 400, 400);
        }
    }
}

export function isFiniteCoordinate(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function findTableNodeId(state: BoardGameRoomState): string {
    for (const node of state.positions.values()) {
        if (node.kind === 'table') return node.id;
    }
    return '';
}

export function setNodeParent(state: BoardGameRoomState, childId: string, parentId: string) {
    const child = state.positions.get(childId);
    if (child) {
        child.parentId = parentId;
    }
}

export function clearNodeParent(state: BoardGameRoomState, childId: string) {
    setNodeParent(state, childId, '');
}

function acceptedCardMatches(acceptedCardId: string, componentId: string, componentName: string) {
    return acceptedCardId === componentId || (componentName ? acceptedCardId === `${componentName}:${componentId}` : false);
}

function layoutAcceptsComponent(target: LayoutNode, component: Component) {
    const layout = target.layout;
    if (!layout) return false;
    const acceptsAny = layout.acceptedDeckNames.length === 0 && layout.acceptedCardIds.length === 0;
    if (acceptsAny) return true;
    if (component.componentName && layout.acceptedDeckNames.includes(component.componentName)) return true;
    if (component.type === 'stack') return false;
    return Array.from(layout.acceptedCardIds).some((acceptedCardId) =>
        acceptedCardMatches(acceptedCardId, component.id, component.componentName)
    );
}

export function targetCanAcceptChild(state: BoardGameRoomState, childId: string, parentId: string) {
    if (!parentId) return true;
    const target = state.positions.get(parentId);
    const component = state.components.get(childId);
    if (!target?.layout || !component) return false;
    if (target.kind === 'slot' && !layoutAcceptsComponent(target, component)) return false;
    const child = state.positions.get(childId);
    if (child?.parentId === parentId) return true;
    if (target.layout.maxChildren <= 0) return true;

    let childCount = 0;
    for (const node of state.positions.values()) {
        if (node.parentId === parentId) {
            childCount += 1;
        }
    }
    return childCount < target.layout.maxChildren;
}

export function resolvePlacementParentId(state: BoardGameRoomState, targetNodeId?: string) {
    return targetNodeId ?? findTableNodeId(state);
}

export function applyPlacement(
    state: BoardGameRoomState,
    componentId: string,
    x: number,
    y: number,
    targetNodeId?: string,
    defaultToTable = true,
    rotation?: number
) {
    const position = state.positions.get(componentId);
    if (!position) return;
    position.x = x;
    position.y = y;
    const parentId =
        !defaultToTable && targetNodeId === undefined
            ? position.parentId
            : defaultToTable
                ? resolvePlacementParentId(state, targetNodeId)
                : targetNodeId ?? '';
    if (rotation !== undefined) {
        position.rotation = normalizeRotation(rotation);
    }
    if (!defaultToTable && targetNodeId === undefined) return;
    setNodeParent(state, componentId, parentId);
}

function validateInitLayoutNodes(layoutNodes: unknown): layoutNodes is InitLayoutNodePayload[] | undefined {
    if (layoutNodes === undefined) return true;
    if (!Array.isArray(layoutNodes)) return false;

    const layoutNodeIds = new Set<string>();
    for (const node of layoutNodes) {
        if (!isRecord(node)) return false;
        if (!isNonEmptyString(node.id) || layoutNodeIds.has(node.id)) return false;
        if (!isLayoutNodeKind(node.kind)) return false;
        if (!isFiniteCoordinate(node.x) || !isFiniteCoordinate(node.y)) return false;
        if (node.parentId !== undefined && typeof node.parentId !== 'string') return false;
        if (node.componentId !== undefined && typeof node.componentId !== 'string') return false;
        if (node.width !== undefined && !isFiniteCoordinate(node.width)) return false;
        if (node.height !== undefined && !isFiniteCoordinate(node.height)) return false;
        if (node.rotation !== undefined && !isFiniteCoordinate(node.rotation)) return false;
        if (node.visible !== undefined && typeof node.visible !== 'boolean') return false;
        if (node.locked !== undefined && typeof node.locked !== 'boolean') return false;
        if (node.layout !== undefined) {
            if (!isRecord(node.layout)) return false;
            if (node.layout.mode !== undefined && !isLayoutMode(node.layout.mode)) return false;
            if (node.layout.maxChildren !== undefined && !isFiniteCoordinate(node.layout.maxChildren)) return false;
            if (node.layout.acceptedDeckNames !== undefined && !Array.isArray(node.layout.acceptedDeckNames)) return false;
            if (node.layout.acceptedCardIds !== undefined && !Array.isArray(node.layout.acceptedCardIds)) return false;
        }
        layoutNodeIds.add(node.id);
    }

    for (const node of layoutNodes) {
        if (!isRecord(node)) return false;
        const parentId = node.parentId;
        if (typeof parentId === 'string' && parentId !== '' && !layoutNodeIds.has(parentId)) return false;
    }

    return true;
}

function validateInitTableItems(
    tableItems: unknown,
    layoutNodes: InitLayoutNodePayload[] | undefined
): tableItems is InitTableItemPayload[] | undefined {
    if (tableItems === undefined) return true;
    if (!Array.isArray(tableItems)) return false;

    const componentIds = new Set<string>();
    const stackIds = new Set<string>();
    const layoutNodeIds = new Set((layoutNodes ?? []).map((node) => node.id));
    for (const item of tableItems) {
        if (!isRecord(item)) return false;
        if (item.type !== 'card' && item.type !== 'stack') return false;
        if (typeof item.id !== 'string' || item.id.trim() === '') return false;
        if (stackIds.has(item.id)) return false;
        stackIds.add(item.id);
        if (!isFiniteCoordinate(item.x) || !isFiniteCoordinate(item.y)) return false;
        if (item.parentId !== undefined && (typeof item.parentId !== 'string' || !layoutNodeIds.has(item.parentId))) {
            return false;
        }
        if (item.componentName !== undefined && typeof item.componentName !== 'string') return false;
        if (!Array.isArray(item.componentIds) || item.componentIds.length === 0) return false;
        if (item.type === 'card' && item.componentIds.length !== 1) return false;
        for (const componentId of item.componentIds) {
            if (typeof componentId !== 'string' || componentId.trim() === '') return false;
            if (componentIds.has(componentId)) return false;
            componentIds.add(componentId);
        }
    }

    return true;
}

export function validateGameInitializationPayload(payload: unknown): payload is InitGamePayload {
    if (!isRecord(payload)) return false;
    const layoutNodes = payload.layoutNodes;
    if (!validateInitLayoutNodes(layoutNodes)) return false;
    if (!validateInitTableItems(payload.tableItems, layoutNodes)) return false;
    if (payload.stacks !== undefined && !Array.isArray(payload.stacks)) return false;
    return true;
}
