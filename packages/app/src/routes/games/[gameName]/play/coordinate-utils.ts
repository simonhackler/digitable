import { Application } from 'pixi.js';

export function pixiToCSSCoordinates(app: Application, pixiX: number, pixiY: number) {
	if (!app) return { x: pixiX, y: pixiY };

	const canvas = app.canvas;
	const canvasRect = canvas.getBoundingClientRect();

	const internalW = app.renderer.width;
	const internalH = app.renderer.height;

	const sx = canvasRect.width / internalW;
	const sy = canvasRect.height / internalH;

	const cssX = pixiX * sx;
	const cssY = pixiY * sy;

	return { x: cssX, y: cssY };
}
