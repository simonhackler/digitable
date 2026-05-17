import { ImageEditor } from './decks/[deckName]/data/custom-image';
import { applyPretextSvgText, getTextFontSize } from './pretext-svg-text';
import type { ColumnWithData } from './types';

const XLINK_NS = 'http://www.w3.org/1999/xlink';

const getDirectTspans = (text: SVGTextElement) =>
	Array.from(text.childNodes).filter(
		(child): child is SVGTSpanElement =>
			child.nodeType === 1 && (child as Element).tagName.toLowerCase() === 'tspan'
	);

const getTspanValue = (tspan: SVGTSpanElement) => {
	if (tspan.getAttribute('data-svgedit-empty-line') === 'true') {
		return '';
	}
	return tspan.textContent ?? '';
};

export const getTextColumnValue = (text: SVGTextElement) => {
	const rawText = text.getAttribute('data-svgedit-raw-text');
	if (text.hasAttribute('data-svgedit-raw-text')) return rawText ?? '';

	const tspans = getDirectTspans(text);
	if (tspans.length > 0) {
		return tspans.map(getTspanValue).join('\n');
	}

	return text.textContent ?? '';
};

const getShapeInsideRef = (text: SVGTextElement) => {
	const explicit = text.getAttribute('data-svgedit-shape-inside-ref');
	if (explicit) {
		const normalized = explicit.trim();
		if (normalized.startsWith('#')) return normalized.slice(1);
		const explicitMatch = /url\(\s*#([^)]+)\)/i.exec(normalized);
		if (explicitMatch) return explicitMatch[1];
		return normalized;
	}

	const styleAttr = text.getAttribute('style') ?? '';
	const styleMatch = /shape-inside\s*:\s*url\(\s*#([^)]+)\)/i.exec(styleAttr);
	return styleMatch?.[1] ?? null;
};

export const getTextFrameBounds = (svg: SVGSVGElement, text: SVGTextElement) => {
	const shapeId = getShapeInsideRef(text);
	const x = text.getAttribute('x');
	const wrapWidth = text.getAttribute('data-svgedit-wrap-width');
	const wrapHeight = text.getAttribute('data-svgedit-wrap-height');
	const rawY = text.getAttribute('y');
	const hasWrapBox = x && rawY && wrapWidth && wrapHeight;
	if (hasWrapBox) {
		const fontSize = getTextFontSize(text);
		const y =
			Number.isFinite(fontSize) && fontSize > 0 ? String(Number.parseFloat(rawY) - fontSize) : rawY;
		return {
			x,
			y,
			width: wrapWidth,
			height: wrapHeight,
			shapeId
		};
	}

	if (shapeId) {
		const shapeEl = svg.getElementById(shapeId) as SVGGraphicsElement | null;
		if (shapeEl) {
			const x = shapeEl.getAttribute('x');
			const y = shapeEl.getAttribute('y');
			const width = shapeEl.getAttribute('width');
			const height = shapeEl.getAttribute('height');
			if (x && y && width && height) {
				return { x, y, width, height, shapeId };
			}
		} else {
			console.warn(`shape-inside target #${shapeId} not found; falling back to text metadata`);
		}
	}

	return null;
};

const toNumber = (value: string | null | undefined) => {
	const parsed = Number.parseFloat(value ?? '');
	return Number.isFinite(parsed) ? parsed : null;
};

const stringifyNumber = (value: number) => Number.parseFloat(value.toFixed(6)).toString();

const getHighlightBounds = (svg: SVGSVGElement, el: SVGGraphicsElement) => {
	if (el.tagName.toLowerCase() === 'text') {
		const frameBounds = getTextFrameBounds(svg, el as SVGTextElement);
		const x = toNumber(frameBounds?.x);
		const y = toNumber(frameBounds?.y);
		const width = toNumber(frameBounds?.width);
		const height = toNumber(frameBounds?.height);
		if (x !== null && y !== null && width !== null && height !== null) {
			return { x, y, width, height };
		}
	}

	const bb = el.getBBox();
	return {
		x: bb.x,
		y: bb.y,
		width: bb.width,
		height: bb.height
	};
};

function applySvgTextData(svg: SVGSVGElement, text: SVGTextElement, data: string) {
	const frameBounds = getTextFrameBounds(svg, text);
	const fontSize = getTextFontSize(text);

	if (frameBounds) {
		text.setAttribute('x', frameBounds.x);
		text.setAttribute('y', stringifyNumber((toNumber(frameBounds.y) ?? 0) + fontSize));
		text.setAttribute('data-svgedit-wrap-width', frameBounds.width);
		text.setAttribute('data-svgedit-wrap-height', frameBounds.height);
		if (frameBounds.shapeId) {
			text.setAttribute('data-svgedit-shape-inside-ref', `#${frameBounds.shapeId}`);
		}
	} else if (!text.getAttribute('x') || !text.getAttribute('y')) {
		throw new Error(`Element ${text.id} is missing x or y attributes`);
	}

	applyPretextSvgText(text, data);
}

export function loadSvgTemplate(svgText: string) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(svgText, 'image/svg+xml');
	return doc.documentElement as unknown as SVGSVGElement;
}

export function parseSvg(svg: SVGSVGElement, prefix = ''): ColumnWithData[] {
	const doc = svg;
	const texts = Array.from(doc.querySelectorAll('text'));
	const images = Array.from(doc.querySelectorAll('image'));
	// Probably easiest to directly modify the ids instead of always parsing with prefix.
	// If this leads to issues, I can change it later.
	for (const el of texts) {
		const currentId = el.getAttribute('id') ?? el.id;
		if (currentId) {
			el.id = `${prefix}${currentId}`;
		} else {
			el.id = `${prefix}${el.textContent?.replace(/\s+/g, '_') || 'text'}`;
		}
	}
	for (const el of images) {
		const currentId = el.getAttribute('id') ?? el.id;
		if (currentId) el.id = `${prefix}${currentId}`;
	}
	const textColumns = texts.map((t) => {
		return {
			title: t.id,
			type: 'text',
			data: [getTextColumnValue(t)]
		} as ColumnWithData;
	});
	const imageColumns = images.map((im) => {
		return {
			title: im.id,
			type: ImageEditor,
			data: [im.getAttribute('href') || im.getAttribute('xlink:href') || '']
		} as ColumnWithData;
	});
	return textColumns.concat(imageColumns);
}

export type SvgDataSide = {
	template: SVGSVGElement;
	columnPrefix?: string;
};

export function getSvgDataMapForSides(sides: SvgDataSide[]): Map<string, ColumnWithData> {
	const dataMap = new Map<string, ColumnWithData>();
	for (const side of sides) {
		parseSvg(side.template.cloneNode(true) as SVGSVGElement, side.columnPrefix).forEach((col) => {
			dataMap.set(col.title, col);
		});
	}
	return dataMap;
}

export function getSvgDataMap(
	frontSvg: SVGSVGElement,
	backSvg: SVGSVGElement
): Map<string, ColumnWithData> {
	return getSvgDataMapForSides([
		{ template: frontSvg },
		{ template: backSvg, columnPrefix: 'back_' }
	]);
}

export function generateSvg(
	svgTemplate: SVGSVGElement,
	headers: string[],
	row: string[],
	imagePaths: Map<string, string>,
	options: { columnPrefix?: string } = {}
): SVGSVGElement {
	const svg = svgTemplate.cloneNode(true) as SVGSVGElement;
	// add a random id after date
	svg.id = `generated-svg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	svg.style.contain = 'layout style paint';
	headers.forEach((col, idx) => {
		if (options.columnPrefix && !col.startsWith(options.columnPrefix)) return;
		const elementId = options.columnPrefix ? col.slice(options.columnPrefix.length) : col;
		const data = row[idx] || '';
		initialSetupForSvgItem(svg, elementId, data, imagePaths);
	});
	return svg;
}

export function initialSetupForSvgItem(
	svg: SVGSVGElement,
	elementId: string,
	data: string,
	imagePaths: Map<string, string>
): SVGTextElement | null {
	const el = svg.getElementById(elementId) as SVGGraphicsElement | null;
	if (!el) {
		return null;
	} else if (el.tagName === 'image') {
		const path = imagePaths.get(data) || '';
		updateSvgImageLink(el, path);
	}
	if (el.tagName !== 'text') return null;

	const text = el as SVGTextElement;
	applySvgTextData(svg, text, data);
	return text;
}

export async function updateSvg(
	svg: SVGSVGElement,
	textId: string,
	newText: string,
	imagePaths: Map<string, string>
): Promise<void> {
	const el = svg.getElementById(textId) as SVGGraphicsElement | null;
	if (!el) {
		return;
	}
	if (el.tagName == 'foreignObject') {
		const div = el.querySelector('div');
		if (!div) {
			throw new Error('div not found');
		}
		div.textContent = newText;
	} else if (el.tagName === 'text') {
		applySvgTextData(svg, el as SVGTextElement, newText);
	} else if (el.tagName == 'image') {
		const path = imagePaths.get(newText) || '';
		updateSvgImageLink(el, path);
	}
}

function updateSvgImageLink(el: SVGGraphicsElement, url: string) {
	const svgRoot =
		el.ownerSVGElement ?? (el.ownerDocument.documentElement as unknown as SVGSVGElement | null);
	el.setAttribute('href', url);
	if (svgRoot && !svgRoot.hasAttribute('xmlns:xlink')) {
		svgRoot.setAttribute('xmlns:xlink', XLINK_NS);
	}
	el.setAttributeNS(XLINK_NS, 'xlink:href', url);
}

export function createHighlightRect(
	el: SVGGraphicsElement,
	svg: SVGSVGElement,
	scale = 1,
	pad = 4
): SVGRectElement | null {
	const rootToScreen = svg.getScreenCTM();
	const elemToScreen = el.getScreenCTM();
	if (!rootToScreen || !elemToScreen) return null;

	const screenToRoot = rootToScreen.inverse();

	// element's bbox in its own coord-sys
	const bb = getHighlightBounds(svg, el);
	const p1 = svg.createSVGPoint();
	const p2 = svg.createSVGPoint();
	p1.x = bb.x - pad; // top-left (with padding)
	p1.y = bb.y - pad;
	p2.x = bb.x + bb.width + pad; // bottom-right
	p2.y = bb.y + bb.height + pad;

	// -> screen space -> root space
	const r1 = p1.matrixTransform(elemToScreen).matrixTransform(screenToRoot);
	const r2 = p2.matrixTransform(elemToScreen).matrixTransform(screenToRoot);

	const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
	rect.setAttribute('x', String(r1.x));
	rect.setAttribute('y', String(r1.y));
	rect.setAttribute('width', String(r2.x - r1.x));
	rect.setAttribute('height', String(r2.y - r1.y));
	rect.setAttribute('rx', '4');
	rect.setAttribute('ry', '4');
	rect.style.fill = 'none';
	rect.style.stroke = 'dodgerblue';
	const strokeWidth = 4 * scale; // Adjust stroke width based on scale
	rect.style.strokeWidth = strokeWidth.toString();

	return rect;
}

export function appendHighlightToSvg(rect: SVGRectElement, svg: SVGSVGElement): void {
	let layer = svg.querySelector<SVGGElement>('g.cell-highlight-layer');
	if (!layer) {
		layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		layer.classList.add('cell-highlight-layer');
		layer.style.pointerEvents = 'none';
		svg.append(layer); // on top
	}
	layer.append(rect);
}
