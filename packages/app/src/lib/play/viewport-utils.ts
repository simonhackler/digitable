import { Application } from 'pixi.js';
import { Viewport } from 'pixi-viewport';

export type CreateViewportOptions = {
	worldWidth?: number;
	worldHeight?: number;
	minScale?: number;
	maxScale?: number;
	wheelZoomPercent?: number;
};

const DEFAULT_WHEEL_ZOOM_PERCENT = 0.04;

export function createViewport(app: Application, options: CreateViewportOptions = {}): Viewport {
	const worldWidth = options.worldWidth ?? 6000;
	const worldHeight = options.worldHeight ?? 3500;
	const viewport = new Viewport({
		screenWidth: app.screen.width,
		screenHeight: app.screen.height,
		worldWidth,
		worldHeight,
		events: app.renderer.events,
		disableOnContextMenu: true
	});
	viewport.pinch().wheel({
		percent: options.wheelZoomPercent ?? DEFAULT_WHEEL_ZOOM_PERCENT
	});
	viewport.drag({
		mouseButtons: 'right'
	});
	// viewport.moveCenter(viewport.worldWidth / 2, viewport.worldHeight / 2);
	viewport.clamp({
		left: 0,
		right: viewport.worldWidth,
		top: 0,
		bottom: viewport.worldHeight,
		direction: 'all',
		underflow: 'center'
	});
	viewport.clampZoom({ minScale: options.minScale ?? 0.3, maxScale: options.maxScale ?? 5 });
	app.stage.addChild(viewport);
	return viewport;
}
