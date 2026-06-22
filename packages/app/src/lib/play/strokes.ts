import type { SchemaCallbackProxy } from '@colyseus/schema';
import { Graphics, Point } from 'pixi.js';
import type { BoardGameRoomState } from 'boardgame-server/src/rooms/schema/MyRoomState';
import type {
	Stroke as StrokeState,
	StrokeFace
} from 'boardgame-server/src/rooms/schema/stroke-schema';
import { BoardGameItemNew } from '$lib/pixi/item';
import type { HandContainer } from './HandContainer';
import type { PlayRoom } from './room-types';

export type PlayTool = 'select' | 'pen';

export type StrokePointDraft = { x: number; y: number };

export type StrokeStyleDraft = {
	color: number;
	width: number;
	alpha: number;
	cap: 'round' | 'butt' | 'square';
	join: 'round' | 'bevel' | 'miter';
};

export type StrokeTarget = {
	item: BoardGameItemNew;
	componentId: string;
	face: StrokeFace;
};

export const currentStrokeStyle: StrokeStyleDraft = {
	color: 0x111111,
	width: 8,
	alpha: 1,
	cap: 'round',
	join: 'round'
};

function drawPolyline(g: Graphics, points: StrokePointDraft[], style: StrokeStyleDraft) {
	g.clear();
	if (points.length < 2) return;

	g.moveTo(points[0].x, points[0].y);
	for (let i = 1; i < points.length; i += 1) {
		g.lineTo(points[i].x, points[i].y);
	}

	g.stroke({
		width: style.width,
		color: style.color,
		alpha: style.alpha,
		cap: style.cap,
		join: style.join
	});
}

function distSq(a: StrokePointDraft, b: StrokePointDraft) {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return dx * dx + dy * dy;
}

function roundPoint(point: StrokePointDraft): StrokePointDraft {
	return {
		x: Math.round(point.x * 100) / 100,
		y: Math.round(point.y * 100) / 100
	};
}

function distanceToSegmentSq(p: Point, a: StrokePointDraft, b: StrokePointDraft) {
	const dx = b.x - a.x;
	const dy = b.y - a.y;

	if (dx === 0 && dy === 0) {
		return distSq(p, a);
	}

	const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
	const x = a.x + t * dx;
	const y = a.y + t * dy;
	const px = p.x - x;
	const py = p.y - y;
	return px * px + py * py;
}

function minPolylineDistanceSq(point: Point, points: StrokePointDraft[]) {
	let min = Number.POSITIVE_INFINITY;
	for (let i = 1; i < points.length; i += 1) {
		min = Math.min(min, distanceToSegmentSq(point, points[i - 1], points[i]));
	}
	return min;
}

function itemFace(item: BoardGameItemNew): StrokeFace {
	return item.clientFlippable?.clientFlippableState.isFaceUp === false ? 'back' : 'front';
}

function stackTopCardId(item: BoardGameItemNew) {
	const stack = item.clientStack?.clientStackState;
	if (!stack || stack.componentIds.length === 0) return null;
	const isFaceUp = item.clientFlippable?.clientFlippableState.isFaceUp ?? true;
	return isFaceUp ? stack.componentIds[0] : stack.componentIds[stack.componentIds.length - 1];
}

export class StrokeView extends Graphics {
	readonly strokeId: string;
	readonly state: StrokeState;

	constructor(stroke: StrokeState) {
		super();
		this.state = stroke;
		this.strokeId = stroke.id;
		this.eventMode = 'none';
		this.redraw();
	}

	get points() {
		return Array.from(this.state.points, (p) => ({ x: p.x, y: p.y }));
	}

	redraw() {
		drawPolyline(this, this.points, {
			color: this.state.style.color,
			width: this.state.style.width,
			alpha: this.state.style.alpha,
			cap: this.state.style.cap,
			join: this.state.style.join
		});
	}

	hitTest(global: Point) {
		if (!this.visible || !this.parent) return false;
		const local = this.parent.toLocal(global);
		const tolerance = Math.max(10, this.state.style.width / 2 + 6);
		return minPolylineDistanceSq(local, this.points) <= tolerance * tolerance;
	}
}

export class StrokeLayer {
	private draft = new Graphics();
	private draftItem: BoardGameItemNew | null = null;
	private draftTarget: StrokeTarget | null = null;
	private draftPoints: StrokePointDraft[] = [];
	private draftStyle = currentStrokeStyle;
	private views = new Map<string, StrokeView>();
	private selected: StrokeView | null = null;
	private selection = new Graphics();

	isDrawing = false;

	constructor(
		private boardGameItems: Map<string, BoardGameItemNew>,
		private handContainer: HandContainer
	) {
		this.draft.eventMode = 'none';
		this.selection.eventMode = 'none';
		this.selection.zIndex = 10000;
	}

	connect(room: PlayRoom, s: SchemaCallbackProxy<BoardGameRoomState>) {
		s(room.state).strokes.onAdd((stroke) => {
			const view = new StrokeView(stroke);
			this.views.set(stroke.id, view);
			this.attach(view);

			s(stroke).onChange(() => {
				view.redraw();
				this.attach(view);
			});
			s(stroke.style).onChange(() => view.redraw());
			s(stroke.points).onAdd(() => view.redraw());
			s(stroke.points).onRemove(() => view.redraw());
			s(stroke.points).onChange(() => view.redraw());
		});

		s(room.state).strokes.onRemove((_stroke, id) => {
			const view = this.views.get(id);
			if (!view) return;
			if (this.selected === view) this.select(null);
			view.parent?.removeChild(view);
			view.destroy();
			this.views.delete(id);
		});

		s(room.state).flippable.onAdd((flippable) => {
			s(flippable).onChange(() => this.refreshAll());
		});
		s(room.state).stacks.onAdd((stack) => {
			s(stack.componentIds).onAdd(() => this.refreshAll());
			s(stack.componentIds).onRemove(() => this.refreshAll());
			s(stack.componentIds).onChange(() => this.refreshAll());
		});
	}

	resolveTarget(item: BoardGameItemNew): StrokeTarget | null {
		const componentId = item.clientStack ? stackTopCardId(item) : item.id;
		if (!componentId) return null;
		return {
			item,
			componentId,
			face: itemFace(item)
		};
	}

	beginDraft(target: StrokeTarget, global: Point, style = currentStrokeStyle) {
		this.cancelDraft();
		this.isDrawing = true;
		this.draftTarget = target;
		this.draftItem = target.item;
		this.draftStyle = style;
		this.draftPoints = [roundPoint(target.item.toLocal(global))];
		target.item.addChild(this.draft);
		this.draft.zIndex = 9998;
	}

	addDraftPoint(global: Point) {
		if (!this.isDrawing || !this.draftItem) return;

		const next = roundPoint(this.draftItem.toLocal(global));
		const last = this.draftPoints[this.draftPoints.length - 1];
		if (last && distSq(last, next) < 4) return;

		this.draftPoints.push(next);
		drawPolyline(this.draft, this.draftPoints, this.draftStyle);
	}

	finishDraft() {
		if (!this.isDrawing || !this.draftTarget) return null;

		const target = this.draftTarget;
		const points = this.draftPoints;
		this.cancelDraft();
		if (points.length < 2) return null;

		return {
			componentId: target.componentId,
			face: target.face,
			points,
			style: this.draftStyle
		};
	}

	cancelDraft() {
		this.isDrawing = false;
		this.draftItem = null;
		this.draftTarget = null;
		this.draftPoints = [];
		this.draft.clear();
		this.draft.parent?.removeChild(this.draft);
	}

	hitTest(global: Point) {
		const views = [...this.views.values()].reverse();
		return views.find((view) => view.hitTest(global)) ?? null;
	}

	select(view: StrokeView | null) {
		this.selection.parent?.removeChild(this.selection);
		this.selection.clear();
		this.selected = view;

		if (!view || !view.parent) return;

		const b = view.getLocalBounds();
		const pad = Math.max(8, view.state.style.width);
		this.selection
			.roundRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, 8)
			.stroke({ width: 2, color: 0x3b82f6, alpha: 1 });
		view.parent.addChild(this.selection);
	}

	get selectedId() {
		return this.selected?.strokeId ?? null;
	}

	refreshAll() {
		for (const view of this.views.values()) {
			this.attach(view);
		}
		if (this.selected) this.select(this.selected);
	}

	strokeSnapshots() {
		const snapshots: {
			id: string;
			componentId: string;
			face: StrokeFace;
			visible: boolean;
			parentId: string | null;
			points: number;
		}[] = [];

		for (const view of this.views.values()) {
			const item = view.parent instanceof BoardGameItemNew ? view.parent : null;
			snapshots.push({
				id: view.strokeId,
				componentId: view.state.componentId,
				face: view.state.face,
				visible: view.visible && Boolean(view.parent),
				parentId: item && 'id' in item && typeof item.id === 'string' ? item.id : null,
				points: view.state.points.length
			});
		}
		return snapshots;
	}

	private attach(view: StrokeView) {
		const target = this.findVisibleAttachment(view.state);
		if (!target) {
			view.parent?.removeChild(view);
			return;
		}

		if (view.parent !== target) {
			view.parent?.removeChild(view);
			target.addChild(view);
		}
		view.visible = view.state.face === itemFace(target);
	}

	private findVisibleAttachment(stroke: StrokeState) {
		const item = this.boardGameItems.get(stroke.componentId);
		if (item && (item.visible || this.handContainer.hasItem(item))) {
			return item;
		}

		for (const candidate of this.boardGameItems.values()) {
			if (!candidate.clientStack || !candidate.visible || !candidate.renderable) continue;
			if (stackTopCardId(candidate) === stroke.componentId) return candidate;
		}

		return null;
	}
}
