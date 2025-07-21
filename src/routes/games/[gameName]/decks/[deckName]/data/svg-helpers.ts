import type { Column } from 'jspreadsheet-ce';
import type { Adapter } from '$lib/components/file-browser/adapters/adapter';

export interface SvgParseResult {
	cols: Column[];
	data: string[][];
}

export function loadSvgTemplate(svgText: string) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(svgText, 'image/svg+xml');
	return doc.documentElement as unknown as SVGSVGElement;
}

export function parseSvg(svg: SVGSVGElement): SvgParseResult {
	const doc = svg;
	const texts = Array.from(doc.querySelectorAll('text'));
	const images = Array.from(doc.querySelectorAll('image'));
	const textColumns = texts.map((t) => {
		return {
			title: t.id,
			type: 'text' as Column['type']
		};
	});
	const imageColumns = images.map((im) => {
		return { title: im.id, type: 'text' as Column['type'] };
	});
	const cols = textColumns.concat(imageColumns);
	const data = [texts.map((t) => t.textContent || '')];

	return { cols, data };
}

export function generateSvg(svgTemplate: SVGSVGElement): SVGSVGElement {
	const svg = svgTemplate.cloneNode(true) as SVGSVGElement;
	return svg;
}

export function appendForeignObjectByIdForText(svg: SVGSVGElement, elementId: string, html: string): SVGForeignObjectElement | null {
	const el = svg.getElementById(elementId) as SVGGraphicsElement | null;
	if (!el || el.tagName !== 'text') return null;

	const { x, y, width, height } = el.getBBox();
	const fo = document.createElementNS(svg.namespaceURI, 'foreignObject') as SVGForeignObjectElement;
	fo.setAttribute('x', x.toString());
	fo.setAttribute('y', y.toString());
	fo.setAttribute('width', width.toString());
	fo.setAttribute('height', height.toString());
	fo.id = elementId;
	el.parentNode!.appendChild(fo);
	el.parentNode!.removeChild(el);

	const div = document.createElement('div');
	div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
	div.style.width = '100%';
	div.style.height = '100%';
	div.style.overflow = 'hidden';
	div.style.whiteSpace = 'pre-wrap';
	div.textContent = html; // or innerHTML = html
	fo.appendChild(div);

	return fo;
}

export async function updateSvg(
	svg: SVGSVGElement,
	textId: string,
	newText: string,
	fileSystem: Adapter,
	currentProject: string
): Promise<void> {
	const el = svg.getElementById(textId) as SVGGraphicsElement | null;
	if (!el) {
		throw new Error(`element with id ${textId} not found`);
	}
	if (el.tagName == 'foreignObject') {
		const div = el.querySelector('div');
		if (!div) {
			throw new Error('div not found');
		}
		div.textContent = newText;
	} else if (el.tagName == 'image') {
		const fileResults = await fileSystem.download([`/${currentProject}/files/${newText}`]);
		const { result, error } = fileResults[0];
		if (error) {
			console.error(error);
		} else {
			const blob = result!.data;
			const url = URL.createObjectURL(blob);
			el.setAttribute('href', url);
			el.setAttribute('xlink:href', url);
		}
	}
}

export function createHighlightRect(el: SVGGraphicsElement, svg: SVGSVGElement, pad = 4): SVGRectElement | null {
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
	rect.style.strokeWidth = '4';

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
