import { Application } from 'pixi.js';
import { Viewport } from 'pixi-viewport';

export function createViewport(app: Application): Viewport {
	const viewport = new Viewport({
		screenWidth: window.innerWidth,
		screenHeight: window.innerHeight,
		worldWidth: 6000,
		worldHeight: 3500,
		events: app.renderer.events,
		disableOnContextMenu: true
	});
	viewport.pinch().wheel();
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
	viewport.clampZoom({ minScale: 0.3, maxScale: 5 });
	app.stage.addChild(viewport);
	return viewport;
}
