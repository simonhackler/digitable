import { ImageEditor } from './decks/[deckName]/data/custom-image';
import type { ColumnWithData } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const SVG_TEXT_STYLE_ATTRS = [
	'font-family',
	'font-size',
	'font-weight',
	'font-style',
	'text-anchor',
	'text-align',
	'text-decoration',
	'letter-spacing',
	'line-height',
	'text-transform',
	'fill'
] as const;

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

const normalizeCssLength = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return '';
	return /^-?\d*\.?\d+$/.test(trimmed) ? `${trimmed}px` : trimmed;
};

const applyTextStyle = (
	target: HTMLElement,
	property: string,
	value: string | null | undefined
) => {
	if (!value) return;
	const trimmed = value.trim();
	if (!trimmed || trimmed === 'normal' || trimmed === 'none') return;
	if (property === 'fill') {
		target.style.color = trimmed;
		return;
	}
	if (property === 'text-anchor') {
		target.style.textAlign = trimmed === 'middle' ? 'center' : trimmed === 'end' ? 'right' : 'left';
		return;
	}
	if (property === 'line-height') {
		target.style.setProperty(property, trimmed);
		return;
	}
	if (property === 'font-size' || property === 'letter-spacing') {
		target.style.setProperty(property, normalizeCssLength(trimmed));
		return;
	}
	target.style.setProperty(property, trimmed);
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
	const fontSize = Number.parseFloat(text.getAttribute('font-size') ?? '');
	const hasWrapBox = x && rawY && wrapWidth && wrapHeight;
	if (hasWrapBox) {
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

export function getSvgDataMap(
	frontSvg: SVGSVGElement,
	backSvg: SVGSVGElement
): Map<string, ColumnWithData> {
	const frontData = parseSvg(frontSvg);
	const backData = parseSvg(backSvg, 'back_');
	const dataMap = new Map<string, ColumnWithData>();

	frontData.forEach((col) => {
		dataMap.set(col.title, col);
	});
	backData.forEach((col) => {
		dataMap.set(col.title, col);
	});

	return dataMap;
}

export function generateSvg(
	svgTemplate: SVGSVGElement,
	headers: string[],
	row: string[],
	imagePaths: Map<string, string>
): SVGSVGElement {
	const svg = svgTemplate.cloneNode(true) as SVGSVGElement;
	// add a random id after date
	svg.id = `generated-svg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	svg.style.contain = 'layout style paint';
	headers.forEach((col, idx) => {
		const data = row[idx] || '';
		initialSetupForSvgItem(svg, col, data, imagePaths);
	});
	return svg;
}

export function initialSetupForSvgItem(
	svg: SVGSVGElement,
	elementId: string,
	data: string,
	imagePaths: Map<string, string>
): SVGForeignObjectElement | null {
	const el = svg.getElementById(elementId) as SVGGraphicsElement | null;
	if (!el) {
		return null;
	} else if (el.tagName === 'image') {
		const path = imagePaths.get(data) || '';
		updateSvgImageLink(el, path);
	}
	if (el.tagName !== 'text') return null;

	const text = el as SVGTextElement;
	const frameBounds = getTextFrameBounds(svg, text);
	const x = frameBounds?.x ?? text.getAttribute('x');
	const y = frameBounds?.y ?? text.getAttribute('y');
	let width = frameBounds?.width ?? text.getAttribute('width');
	let height = frameBounds?.height ?? text.getAttribute('height');

	if (width === null || height === null) {
		const bbox = text.getBBox();
		width = bbox.width.toString();
		height = bbox.height.toString();
	}

	if (x == null || x === '' || y == null || y === '') {
		throw new Error(`Element ${elementId} is missing x or y attributes`);
	}
	const fo = document.createElementNS(
		svg.namespaceURI || SVG_NS,
		'foreignObject'
	) as SVGForeignObjectElement;
	fo.setAttribute('x', x.toString());
	fo.setAttribute('y', y.toString());
	fo.setAttribute('width', width.toString());
	fo.setAttribute('height', height.toString());
	fo.id = elementId;
	if (frameBounds?.shapeId) {
		fo.setAttribute('data-flow-rect', frameBounds.shapeId);
		fo.setAttribute('data-flow-id', elementId);
	}
	const transform = text.getAttribute('transform');
	if (transform) fo.setAttribute('transform', transform);
	text.parentNode!.appendChild(fo);
	text.parentNode!.removeChild(text);

	const div = document.createElement('div');
	div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
	div.style.width = '100%';
	div.style.height = '100%';
	div.style.overflow = 'hidden';
	div.style.whiteSpace = 'pre-wrap';
	div.style.boxSizing = 'border-box';

	for (const attr of SVG_TEXT_STYLE_ATTRS) {
		applyTextStyle(div, attr, text.getAttribute(attr));
	}
	div.style.contain = 'layout style paint';

	// Copy styles from the original SVG text element
	const computedStyle = window.getComputedStyle(text);
	const stylesToCopy = [...SVG_TEXT_STYLE_ATTRS, 'color'];

	stylesToCopy.forEach((prop) => {
		const value = computedStyle.getPropertyValue(prop);
		applyTextStyle(div, prop, value);
	});

	// Also copy any inline style attribute
	const inlineStyle = text.getAttribute('style');
	if (inlineStyle) {
		// Parse and apply relevant inline styles
		const styleDeclarations = inlineStyle.split(';').filter(Boolean);
		styleDeclarations.forEach((declaration) => {
			const [prop, value] = declaration.split(':').map((s) => s.trim());
			if (prop && value && stylesToCopy.includes(prop)) {
				applyTextStyle(div, prop, value);
			}
		});
	}

	div.textContent = data;

	fo.appendChild(div);

	return fo;
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
	const bb = el.getBBox();
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
