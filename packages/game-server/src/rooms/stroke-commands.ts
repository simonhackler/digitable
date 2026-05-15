import { randomUUID } from 'crypto';

import { Command } from '../command';
import {
	Stroke,
	StrokePoint,
	StrokeStyle,
	type StrokeCap,
	type StrokeFace,
	type StrokeJoin
} from './schema/MyRoomState';
import type { CommandRoom } from './command-room';

type StrokePointPayload = { x: number; y: number };

type StrokeStylePayload = {
	color?: number;
	width?: number;
	alpha?: number;
	cap?: StrokeCap;
	join?: StrokeJoin;
};

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function validPoint(point: StrokePointPayload) {
	if (typeof point !== 'object' || point === null) return false;
	return isFiniteNumber(point.x) && isFiniteNumber(point.y);
}

function validStrokeFace(face: unknown): face is StrokeFace {
	return face === 'front' || face === 'back';
}

function validStrokeCap(cap: unknown): cap is StrokeCap {
	return cap === 'round' || cap === 'butt' || cap === 'square';
}

function validStrokeJoin(join: unknown): join is StrokeJoin {
	return join === 'round' || join === 'bevel' || join === 'miter';
}

function validStrokeStyle(style: StrokeStylePayload | undefined) {
	if (!style) return true;
	if (style.color !== undefined && !isFiniteNumber(style.color)) return false;
	if (style.width !== undefined) {
		if (!isFiniteNumber(style.width)) return false;
		if (style.width <= 0 || style.width > 200) return false;
	}
	if (style.alpha !== undefined) {
		if (!isFiniteNumber(style.alpha)) return false;
		if (style.alpha < 0 || style.alpha > 1) return false;
	}
	if (style.cap !== undefined && !validStrokeCap(style.cap)) return false;
	if (style.join !== undefined && !validStrokeJoin(style.join)) return false;
	return true;
}

export class StrokeCreateCommand extends Command<
	CommandRoom,
	{
		sessionId: string;
		id?: string;
		componentId: string;
		face: StrokeFace;
		points: StrokePointPayload[];
		style?: StrokeStylePayload;
	}
> {
	execute(payload: this['payload']) {
		const id = payload.id || randomUUID();
		const stroke = new Stroke(
			id,
			payload.componentId,
			payload.face,
			payload.points.map((p) => new StrokePoint(p.x, p.y)),
			new StrokeStyle(payload.style)
		);

		this.state.strokes.set(id, stroke);
	}

	validate(payload: this['payload']) {
		if (payload.id !== undefined && typeof payload.id !== 'string') return false;
		if (payload.id && this.state.strokes.has(payload.id)) return false;
		if (typeof payload.componentId !== 'string') return false;
		const component = this.state.components.get(payload.componentId);
		if (!component) {
			console.error('Invalid card id:', payload.componentId);
			return false;
		}
		if (component.type !== 'card') return false;
		if (!validStrokeFace(payload.face)) return false;
		if (!Array.isArray(payload.points)) return false;
		if (payload.points.length < 2 || payload.points.length > 2000) return false;
		if (!payload.points.every(validPoint)) return false;
		return validStrokeStyle(payload.style);
	}
}

export class StrokeDeleteCommand extends Command<
	CommandRoom,
	{
		sessionId: string;
		strokeId: string;
	}
> {
	execute(payload: this['payload']) {
		this.state.strokes.delete(payload.strokeId);
	}

	validate(payload: this['payload']) {
		if (typeof payload.strokeId !== 'string') return false;
		return this.state.strokes.has(payload.strokeId);
	}
}
