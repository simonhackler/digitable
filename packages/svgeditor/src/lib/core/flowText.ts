import { DEFAULT_TEXT_BOX_EMS, DEFAULT_TEXT_STYLE } from '../reference/text-defaults';

const SVG_NS = 'http://www.w3.org/2000/svg';

const FLOW_MANAGED_ATTR = 'data-flow-managed';
const FLOW_RECT_ATTR = 'data-flow-rect';
const FLOW_OWNER_ATTR = 'data-flow-owner';
const FLOW_FOR_ATTR = 'data-flow-for';
const FLOW_FOREIGN_ATTR = 'data-flow-foreign';
const FLOW_STYLE_ATTR = 'data-flow-style';
const FLOW_MEASURE_ATTR = 'data-flow-measure';
const FLOW_BOX_ATTR = 'data-flow-box';
const FLOW_OPACITY_ATTR = 'data-flow-orig-opacity';
const FLOW_POINTER_ATTR = 'data-flow-orig-pointer-events';

const STYLE_PROPS = [
	'font-family',
	'font-size',
	'font-weight',
	'font-style',
	'line-height',
	'letter-spacing',
	'text-align',
	'text-decoration',
	'text-transform',
	'fill'
];

const FALLBACK_PROPS = {
	shapeInside: 'shape-inside',
	whiteSpace: 'white-space',
	display: 'display',
	textAlign: 'text-align',
	lineHeight: 'line-height',
	fontFamily: 'font-family',
	fontSize: 'font-size',
	fontWeight: 'font-weight',
	fontStyle: 'font-style',
	letterSpacing: 'letter-spacing',
	fill: 'fill'
};

type TextStyle = {
	fontFamily: string;
	fontSize: number;
	fontWeight: string;
	fontStyle: string;
	lineHeight: number;
	letterSpacing: string;
	textAlign: string;
	fill: string;
};

type RectBox = {
	x: number;
	y: number;
	width: number;
	height: number;
	transform: string | null;
};

const escapeId = (value: string) => {
	if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
		return CSS.escape(value);
	}
	return value.replace(/\"/g, '\\"');
};

const parseStyle = (styleText: string | null) => {
	const map = new Map<string, string>();
	if (!styleText) return map;
	styleText
		.split(';')
		.map((entry) => entry.trim())
		.filter(Boolean)
		.forEach((entry) => {
			const idx = entry.indexOf(':');
			if (idx === -1) return;
			const key = entry.slice(0, idx).trim();
			const value = entry.slice(idx + 1).trim();
			if (!key) return;
			map.set(key, value);
		});
	return map;
};

const serializeStyle = (styleMap: Map<string, string>) =>
	Array.from(styleMap.entries())
		.map(([key, value]) => `${key}:${value}`)
		.join(';');

const upsertStyle = (el: Element, updates: Record<string, string>) => {
	const styleMap = parseStyle(el.getAttribute('style'));
	Object.entries(updates).forEach(([key, value]) => {
		if (!value) return;
		styleMap.set(key, value);
	});
	el.setAttribute('style', serializeStyle(styleMap));
};

const getStyleValue = (el: Element, prop: string) => {
	const fromAttr = el.getAttribute(prop);
	if (fromAttr) return fromAttr;
	const styleMap = parseStyle(el.getAttribute('style'));
	return styleMap.get(prop) ?? '';
};

const ensureStyleProp = (el: Element, prop: string, value: string) => {
	if (getStyleValue(el, prop)) return;
	upsertStyle(el, { [prop]: value });
};

const getNumeric = (value: string | null, fallback: number) => {
	if (!value) return fallback;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const getTextStyle = (text: SVGTextElement): TextStyle => {
	const styleMap = parseStyle(text.getAttribute('style'));
	const fontFamily =
		text.getAttribute('font-family') ||
		styleMap.get('font-family') ||
		DEFAULT_TEXT_STYLE.fontFamily;
	const fontSize = getNumeric(
		text.getAttribute('font-size') || styleMap.get('font-size') || '',
		DEFAULT_TEXT_STYLE.fontSize
	);
	const fontWeight =
		text.getAttribute('font-weight') ||
		styleMap.get('font-weight') ||
		DEFAULT_TEXT_STYLE.fontWeight;
	const fontStyle =
		text.getAttribute('font-style') || styleMap.get('font-style') || DEFAULT_TEXT_STYLE.fontStyle;
	const lineHeightRaw = styleMap.get('line-height') || text.getAttribute('line-height') || '';
	const lineHeight = getNumeric(lineHeightRaw, DEFAULT_TEXT_STYLE.lineHeight);
	const letterSpacing =
		styleMap.get('letter-spacing') ||
		text.getAttribute('letter-spacing') ||
		DEFAULT_TEXT_STYLE.letterSpacing;
	const textAlign =
		styleMap.get('text-align') || text.getAttribute('text-align') || DEFAULT_TEXT_STYLE.textAlign;
	const fill = styleMap.get('fill') || text.getAttribute('fill') || DEFAULT_TEXT_STYLE.fill;

	return {
		fontFamily,
		fontSize,
		fontWeight,
		fontStyle,
		lineHeight,
		letterSpacing,
		textAlign,
		fill
	};
};

const getShapeInsideId = (text: SVGTextElement) => {
	const styleMap = parseStyle(text.getAttribute('style'));
	const shape = styleMap.get('shape-inside') || '';
	const match = /url\(\s*#([^\)]+)\s*\)/i.exec(shape);
	return match ? match[1] : '';
};

const ensureDefs = (svgRoot: SVGSVGElement) => {
	const doc = svgRoot.ownerDocument;
	if (!doc) return null;
	const defs =
		svgRoot.querySelector('defs') ??
		svgRoot.insertBefore(doc.createElementNS(SVG_NS, 'defs'), svgRoot.firstChild);
	return defs;
};

const ensureFlowStyle = (svgRoot: SVGSVGElement) => {
	const existing = svgRoot.querySelector(`style[${FLOW_STYLE_ATTR}="true"]`);
	if (existing) {
		existing.textContent = `text[${FLOW_MANAGED_ATTR}="true"]{opacity:0 !important;pointer-events:none !important;}`;
		return;
	}
	const doc = svgRoot.ownerDocument;
	if (!doc) return;
	const style = doc.createElementNS(SVG_NS, 'style');
	style.setAttribute(FLOW_STYLE_ATTR, 'true');
	style.textContent = `text[${FLOW_MANAGED_ATTR}="true"]{opacity:0 !important;pointer-events:none !important;}`;
	svgRoot.insertBefore(style, svgRoot.firstChild);
};

const ensureMeasureText = (svgRoot: SVGSVGElement) => {
	let measure = svgRoot.querySelector(`text[${FLOW_MEASURE_ATTR}="true"]`) as SVGTextElement | null;
	if (measure) return measure;
	const doc = svgRoot.ownerDocument;
	if (!doc) return null;
	measure = doc.createElementNS(SVG_NS, 'text') as SVGTextElement;
	measure.setAttribute(FLOW_MEASURE_ATTR, 'true');
	measure.setAttribute('visibility', 'hidden');
	measure.setAttribute('pointer-events', 'none');
	svgRoot.append(measure);
	return measure;
};

const ensureUniqueId = (svgRoot: SVGSVGElement, base: string) => {
	let id = base;
	let counter = 1;
	while (svgRoot.querySelector(`#${escapeId(id)}`)) {
		id = `${base}_${counter++}`;
	}
	return id;
};

const extractTextContent = (text: SVGTextElement) => {
	const tspans = Array.from(text.querySelectorAll(':scope > tspan')) as SVGTSpanElement[];
	if (tspans.length) {
		return tspans.map((span) => span.textContent ?? '').join('\n');
	}
	return text.textContent ?? '';
};

const measureTextWidth = (measureEl: SVGTextElement, style: TextStyle, text: string): number => {
	measureEl.setAttribute('font-family', style.fontFamily);
	measureEl.setAttribute('font-size', style.fontSize.toString());
	measureEl.setAttribute('font-weight', style.fontWeight);
	measureEl.setAttribute('font-style', style.fontStyle);
	measureEl.setAttribute('letter-spacing', style.letterSpacing);
	measureEl.textContent = text || '';
	try {
		return measureEl.getComputedTextLength();
	} catch {
		return text.length * style.fontSize * 0.6;
	}
};

const splitLongWord = (word: string, maxWidth: number, measure: (text: string) => number) => {
	const chars = word.split('');
	let chunk = '';
	const lines: string[] = [];
	for (const ch of chars) {
		const next = chunk + ch;
		if (chunk && measure(next) > maxWidth) {
			lines.push(chunk);
			chunk = ch;
		} else {
			chunk = next;
		}
	}
	if (chunk) lines.push(chunk);
	return lines;
};

const wrapTextLines = (
	text: string,
	maxWidth: number,
	measure: (text: string) => number
): string[] => {
	if (maxWidth <= 0) return text.split('\n');
	const paragraphs = text.split('\n');
	const lines: string[] = [];
	for (const paragraph of paragraphs) {
		if (!paragraph) {
			lines.push('');
			continue;
		}
		const words = paragraph.split(/\s+/);
		let line = '';
		for (const word of words) {
			const candidate = line ? `${line} ${word}` : word;
			if (measure(candidate) <= maxWidth) {
				line = candidate;
				continue;
			}
			if (line) {
				lines.push(line);
				line = '';
			}
			if (measure(word) > maxWidth) {
				const broken = splitLongWord(word, maxWidth, measure);
				lines.push(...broken.slice(0, -1));
				line = broken[broken.length - 1] ?? '';
			} else {
				line = word;
			}
		}
		if (line) lines.push(line);
	}
	return lines;
};

const alignToAnchor = (align: string) => {
	const normalized = align.toLowerCase();
	if (normalized === 'center') return 'middle';
	if (normalized === 'right' || normalized === 'end') return 'end';
	return 'start';
};

const anchorToAlign = (anchor: string) => {
	const normalized = anchor.toLowerCase();
	if (normalized === 'middle') return 'center';
	if (normalized === 'end') return 'right';
	return 'left';
};

const applyFallback = (
	textEl: SVGTextElement,
	rect: SVGRectElement,
	content: string,
	style: TextStyle,
	measureEl: SVGTextElement
) => {
	// Remove direct text nodes so browsers don't render raw text alongside fallback tspans.
	Array.from(textEl.childNodes).forEach((node) => {
		if (node.nodeType === Node.TEXT_NODE) node.remove();
	});
	const rectX = getNumeric(rect.getAttribute('x'), 0);
	const rectY = getNumeric(rect.getAttribute('y'), 0);
	const rectWidth = getNumeric(
		rect.getAttribute('width'),
		style.fontSize * DEFAULT_TEXT_BOX_EMS.width
	);
	const lineHeight = style.lineHeight || DEFAULT_TEXT_STYLE.lineHeight;
	const lineHeightPx = lineHeight * style.fontSize;

	const textAnchor = textEl.getAttribute('text-anchor') || alignToAnchor(style.textAlign);
	textEl.setAttribute('text-anchor', textAnchor);
	const align = style.textAlign || anchorToAlign(textAnchor);
	const x =
		textAnchor === 'middle'
			? rectX + rectWidth / 2
			: textAnchor === 'end'
				? rectX + rectWidth
				: rectX;
	const yStart = rectY + style.fontSize;

	const measure = (value: string) => measureTextWidth(measureEl, style, value);
	const lines = wrapTextLines(content, rectWidth, measure);

	const existingTspans = Array.from(textEl.querySelectorAll(':scope > tspan')) as SVGTSpanElement[];
	lines.forEach((line, index) => {
		const tspan =
			existingTspans[index] ??
			(textEl.ownerDocument!.createElementNS(SVG_NS, 'tspan') as SVGTSpanElement);
		tspan.setAttribute('x', x.toString());
		if (index === 0) {
			tspan.setAttribute('y', yStart.toString());
		} else {
			tspan.setAttribute('dy', lineHeightPx.toString());
		}
		tspan.textContent = line === '' ? ' ' : line;
		textEl.appendChild(tspan);
	});
	existingTspans.slice(lines.length).forEach((span) => span.remove());

	upsertStyle(textEl, {
		[FALLBACK_PROPS.whiteSpace]: 'pre',
		[FALLBACK_PROPS.display]: 'inline'
	});
	if (!getStyleValue(textEl, FALLBACK_PROPS.lineHeight)) {
		upsertStyle(textEl, { [FALLBACK_PROPS.lineHeight]: String(lineHeight) });
	}
	if (!getStyleValue(textEl, FALLBACK_PROPS.textAlign)) {
		upsertStyle(textEl, { [FALLBACK_PROPS.textAlign]: align });
	}
};

const getRectBox = (rect: SVGRectElement) => ({
	x: getNumeric(rect.getAttribute('x'), 0),
	y: getNumeric(rect.getAttribute('y'), 0),
	width: getNumeric(rect.getAttribute('width'), 0),
	height: getNumeric(rect.getAttribute('height'), 0)
});

const getTransformedBox = (box: Omit<RectBox, 'transform'>, matrix: DOMMatrix) => {
	const points = [
		{ x: box.x, y: box.y },
		{ x: box.x + box.width, y: box.y },
		{ x: box.x + box.width, y: box.y + box.height },
		{ x: box.x, y: box.y + box.height }
	].map((pt) => ({
		x: matrix.a * pt.x + matrix.c * pt.y + matrix.e,
		y: matrix.b * pt.x + matrix.d * pt.y + matrix.f
	}));
	const xs = points.map((pt) => pt.x);
	const ys = points.map((pt) => pt.y);
	const minX = Math.min(...xs);
	const maxX = Math.max(...xs);
	const minY = Math.min(...ys);
	const maxY = Math.max(...ys);
	return {
		x: minX,
		y: minY,
		width: Math.max(0, maxX - minX),
		height: Math.max(0, maxY - minY)
	};
};

const hasRotationOrSkew = (matrix: DOMMatrix) =>
	Math.abs(matrix.b) > 1e-6 || Math.abs(matrix.c) > 1e-6;

const resolveRectBox = (rect: SVGRectElement, respectTransform: boolean): RectBox => {
	const baseBox = getRectBox(rect);
	const transform = rect.getAttribute('transform');
	if (!transform || transform === 'none') {
		return { ...baseBox, transform: null };
	}
	const consolidated = rect.transform?.baseVal?.consolidate?.();
	if (!consolidated) {
		return { ...baseBox, transform };
	}
	const matrix = consolidated.matrix;
	if (respectTransform) {
		return { ...baseBox, transform };
	}
	if (!hasRotationOrSkew(matrix)) {
		const transformed = getTransformedBox(baseBox, matrix);
		rect.setAttribute('x', transformed.x.toString());
		rect.setAttribute('y', transformed.y.toString());
		rect.setAttribute('width', transformed.width.toString());
		rect.setAttribute('height', transformed.height.toString());
		rect.removeAttribute('transform');
		return { ...transformed, transform: null };
	}
	return { ...baseBox, transform };
};

const ensureRectForText = (
	textEl: SVGTextElement,
	svgRoot: SVGSVGElement,
	defs: SVGDefsElement,
	style: TextStyle
) => {
	let rectId = getShapeInsideId(textEl) || textEl.getAttribute(FLOW_RECT_ATTR) || '';
	let rect: SVGRectElement | null = null;
	if (rectId) {
		rect = svgRoot.querySelector(`#${escapeId(rectId)}`) as SVGRectElement | null;
	}
	if (!rect) {
		const ownerId = textEl.id || '';
		if (ownerId) {
			rect =
				(defs.querySelector(
					`rect[${FLOW_OWNER_ATTR}="${escapeId(ownerId)}"]`
				) as SVGRectElement | null) ??
				(defs.querySelector(`#${escapeId(`rect_${ownerId}`)}`) as SVGRectElement | null);
			if (rect) {
				rectId = rect.getAttribute('id') || rectId;
			}
		}
	}
	if (!rect) {
		rectId = ensureUniqueId(svgRoot, `rect_${textEl.id || 'flow'}`);
		rect = textEl.ownerDocument!.createElementNS(SVG_NS, 'rect') as SVGRectElement;
		const x = getNumeric(textEl.getAttribute('x'), 0);
		const y = getNumeric(textEl.getAttribute('y'), 0);
		const viewBox = svgRoot.viewBox?.baseVal;
		const svgWidth = viewBox?.width || getNumeric(svgRoot.getAttribute('width'), 0);
		const svgHeight = viewBox?.height || getNumeric(svgRoot.getAttribute('height'), 0);
		const fallbackWidth = svgWidth
			? Math.max(style.fontSize * 4, svgWidth * 0.6)
			: style.fontSize * DEFAULT_TEXT_BOX_EMS.width;
		const fallbackHeight = svgHeight
			? Math.max(style.fontSize * 2, svgHeight * 0.2)
			: style.fontSize * DEFAULT_TEXT_BOX_EMS.height;
		const defaultWidth = fallbackWidth;
		const defaultHeight = fallbackHeight;
		rect.setAttribute('x', x.toString());
		rect.setAttribute('y', y.toString());
		rect.setAttribute('width', defaultWidth.toString());
		rect.setAttribute('height', defaultHeight.toString());
		rect.setAttribute('id', rectId);
		rect.setAttribute(FLOW_OWNER_ATTR, textEl.id || rectId);
		defs.appendChild(rect);
	}
	textEl.setAttribute(FLOW_RECT_ATTR, rectId);
	return rect;
};

const ensureProxyRect = (textEl: SVGTextElement, svgRoot: SVGSVGElement, rect: SVGRectElement) => {
	let proxy = svgRoot.querySelector(
		`rect[${FLOW_BOX_ATTR}="true"][${FLOW_FOR_ATTR}="${escapeId(textEl.id)}"]`
	) as SVGRectElement | null;
	const isNew = !proxy;
	if (!proxy) {
		proxy = textEl.ownerDocument!.createElementNS(SVG_NS, 'rect') as SVGRectElement;
		proxy.setAttribute(FLOW_BOX_ATTR, 'true');
		proxy.setAttribute(FLOW_FOR_ATTR, textEl.id);
		proxy.setAttribute('fill', 'none');
		proxy.setAttribute('stroke', '#64748b');
		proxy.setAttribute('stroke-dasharray', '4,4');
		proxy.setAttribute('stroke-width', '0.5');
		proxy.setAttribute('vector-effect', 'non-scaling-stroke');
		proxy.style.pointerEvents = 'stroke';
		textEl.parentNode?.insertBefore(proxy, textEl.nextSibling);
	}
	if (isNew) {
		proxy.setAttribute('x', rect.getAttribute('x') || '0');
		proxy.setAttribute('y', rect.getAttribute('y') || '0');
		proxy.setAttribute('width', rect.getAttribute('width') || '0');
		proxy.setAttribute('height', rect.getAttribute('height') || '0');
	}
	return proxy;
};

const applyDivStyles = (textEl: SVGTextElement, div: HTMLDivElement, style: TextStyle) => {
	div.style.width = '100%';
	div.style.height = '100%';
	div.style.overflow = 'hidden';
	div.style.whiteSpace = 'pre-wrap';
	div.style.fontFamily = style.fontFamily;
	div.style.fontSize = `${style.fontSize}px`;
	div.style.fontWeight = style.fontWeight;
	div.style.fontStyle = style.fontStyle;
	div.style.lineHeight = String(style.lineHeight);
	div.style.letterSpacing = style.letterSpacing;
	div.style.textAlign = style.textAlign;
	div.style.color = style.fill;

	const computed = textEl.ownerDocument?.defaultView?.getComputedStyle(textEl);
	if (computed) {
		const fill = computed.getPropertyValue('fill');
		if (fill && fill !== 'none') {
			div.style.color = fill;
		}
		STYLE_PROPS.forEach((prop) => {
			const value = computed.getPropertyValue(prop);
			if (!value || value === 'normal' || value === 'none') return;
			if (prop === 'fill') return;
			div.style.setProperty(prop, value);
		});
	}
};

const ensureForeignObject = (
	textEl: SVGTextElement,
	rect: SVGRectElement,
	rectId: string,
	content: string,
	style: TextStyle,
	box?: RectBox
) => {
	const svgRoot = textEl.ownerSVGElement;
	if (!svgRoot) return;
	let foreign = svgRoot.querySelector(
		`foreignObject[${FLOW_FOR_ATTR}="${escapeId(textEl.id)}"]`
	) as SVGForeignObjectElement | null;
	if (!foreign) {
		foreign = textEl.ownerDocument!.createElementNS(
			SVG_NS,
			'foreignObject'
		) as SVGForeignObjectElement;
		foreign.setAttribute(FLOW_FOR_ATTR, textEl.id);
		foreign.setAttribute(FLOW_FOREIGN_ATTR, 'true');
		foreign.setAttribute(FLOW_MANAGED_ATTR, 'true');
		foreign.style.pointerEvents = 'none';
		textEl.parentNode?.insertBefore(foreign, textEl.nextSibling);
	}
	const targetBox = box ?? {
		x: getNumeric(rect.getAttribute('x'), 0),
		y: getNumeric(rect.getAttribute('y'), 0),
		width: getNumeric(rect.getAttribute('width'), 0),
		height: getNumeric(rect.getAttribute('height'), 0),
		transform: null
	};
	foreign.setAttribute('x', targetBox.x.toString());
	foreign.setAttribute('y', targetBox.y.toString());
	foreign.setAttribute('width', targetBox.width.toString());
	foreign.setAttribute('height', targetBox.height.toString());
	foreign.setAttribute(FLOW_RECT_ATTR, rectId);
	if (targetBox.transform) {
		foreign.setAttribute('transform', targetBox.transform);
	} else {
		foreign.removeAttribute('transform');
	}

	let div = foreign.querySelector('div');
	if (!div) {
		div = textEl.ownerDocument!.createElement('div');
		div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
		foreign.appendChild(div);
	}
	applyDivStyles(textEl, div as HTMLDivElement, style);
	div.textContent = content;
};

const removeOrphanedFlowNodes = (svgRoot: SVGSVGElement, liveTextIds: Set<string>) => {
	const dedupeByOwner = <T extends Element>(nodes: T[], getOwner: (node: T) => string) => {
		const seen = new Set<string>();
		nodes.forEach((node) => {
			const owner = getOwner(node);
			if (!owner || !liveTextIds.has(owner)) {
				node.remove();
				return;
			}
			if (seen.has(owner)) {
				node.remove();
				return;
			}
			seen.add(owner);
		});
	};

	const foreignObjects = Array.from(
		svgRoot.querySelectorAll(`foreignObject[${FLOW_FOREIGN_ATTR}="true"]`)
	) as SVGForeignObjectElement[];
	dedupeByOwner(foreignObjects, (foreign) => foreign.getAttribute(FLOW_FOR_ATTR) || '');

	const proxyRects = Array.from(
		svgRoot.querySelectorAll(`rect[${FLOW_BOX_ATTR}="true"]`)
	) as SVGRectElement[];
	dedupeByOwner(proxyRects, (rect) => rect.getAttribute(FLOW_FOR_ATTR) || '');

	const rects = Array.from(
		svgRoot.querySelectorAll(`rect[${FLOW_OWNER_ATTR}]`)
	) as SVGRectElement[];
	dedupeByOwner(rects, (rect) => rect.getAttribute(FLOW_OWNER_ATTR) || '');
};

export const syncFlowText = (
	svgRoot: SVGSVGElement,
	options: { updateFallback?: boolean; respectTransform?: boolean } = {}
) => {
	const { updateFallback = true, respectTransform = false } = options;
	ensureFlowStyle(svgRoot);
	const defs = ensureDefs(svgRoot);
	if (!defs) return;
	const measureEl = ensureMeasureText(svgRoot);
	if (!measureEl) return;

	const textNodes = Array.from(svgRoot.querySelectorAll('text')).filter(
		(text) => !text.closest('defs') && text.getAttribute(FLOW_MEASURE_ATTR) !== 'true'
	) as SVGTextElement[];

	const liveTextIds = new Set<string>();
	textNodes.forEach((textEl, index) => {
		if (!textEl.id) {
			textEl.setAttribute('id', ensureUniqueId(svgRoot, `text_${index + 1}`));
		}
		const textId = textEl.id;
		liveTextIds.add(textId);
		textEl.setAttribute(FLOW_MANAGED_ATTR, 'true');

		const style = getTextStyle(textEl);
		const rect = ensureRectForText(textEl, svgRoot, defs, style);
		const proxyRect = ensureProxyRect(textEl, svgRoot, rect);
		const rectSource = proxyRect ?? rect;
		const foreignBox = resolveRectBox(rectSource, respectTransform);
		rect.setAttribute('x', rectSource.getAttribute('x') || '0');
		rect.setAttribute('y', rectSource.getAttribute('y') || '0');
		rect.setAttribute('width', rectSource.getAttribute('width') || '0');
		rect.setAttribute('height', rectSource.getAttribute('height') || '0');
		const rectId = rect.getAttribute('id') || '';
		upsertStyle(textEl, {
			[FALLBACK_PROPS.shapeInside]: `url(#${rectId})`,
			[FALLBACK_PROPS.whiteSpace]: 'pre',
			[FALLBACK_PROPS.display]: 'inline'
		});
		ensureStyleProp(textEl, FALLBACK_PROPS.textAlign, style.textAlign);
		ensureStyleProp(textEl, FALLBACK_PROPS.fontFamily, style.fontFamily);
		ensureStyleProp(textEl, FALLBACK_PROPS.fontSize, `${style.fontSize}px`);
		ensureStyleProp(textEl, FALLBACK_PROPS.fontWeight, style.fontWeight);
		ensureStyleProp(textEl, FALLBACK_PROPS.fontStyle, style.fontStyle);
		ensureStyleProp(textEl, FALLBACK_PROPS.letterSpacing, style.letterSpacing);
		ensureStyleProp(textEl, FALLBACK_PROPS.fill, style.fill);
		textEl.setAttribute('xml:space', 'preserve');
		if (!textEl.hasAttribute(FLOW_OPACITY_ATTR)) {
			const original = textEl.getAttribute('opacity') ?? '';
			textEl.setAttribute(FLOW_OPACITY_ATTR, original);
		}
		if (!textEl.hasAttribute(FLOW_POINTER_ATTR)) {
			const original = textEl.getAttribute('pointer-events') ?? '';
			textEl.setAttribute(FLOW_POINTER_ATTR, original);
		}
		textEl.setAttribute('opacity', '0');
		textEl.setAttribute('pointer-events', 'none');

		const content = extractTextContent(textEl);
		if (updateFallback) {
			applyFallback(textEl, rectSource, content, style, measureEl);
		}
		ensureForeignObject(
			textEl,
			rectSource,
			rect.getAttribute('id') || '',
			content,
			style,
			foreignBox
		);
	});

	removeOrphanedFlowNodes(svgRoot, liveTextIds);
};

const stripFlowAttributes = (el: Element) => {
	const keep = new Set([FLOW_RECT_ATTR, FLOW_OWNER_ATTR]);
	const attrs = Array.from(el.attributes);
	attrs.forEach((attr) => {
		if (attr.name.startsWith('data-flow-')) {
			if (keep.has(attr.name)) return;
			el.removeAttribute(attr.name);
		}
	});
};

export const serializeFlowText = (svgRoot: SVGSVGElement) => {
	const clone = svgRoot.cloneNode(true) as SVGSVGElement;
	let container: HTMLDivElement | null = null;
	try {
		if (typeof document !== 'undefined' && document.body) {
			container = document.createElement('div');
			Object.assign(container.style, {
				position: 'fixed',
				left: '-10000px',
				top: '-10000px',
				width: '0',
				height: '0',
				overflow: 'hidden',
				visibility: 'hidden',
				pointerEvents: 'none'
			});
			container.appendChild(clone);
			document.body.appendChild(container);
		}
		syncFlowText(clone, { updateFallback: true });
	} finally {
		if (container && container.parentNode) {
			container.parentNode.removeChild(container);
		}
	}
	clone.querySelectorAll(`text[${FLOW_MANAGED_ATTR}="true"]`).forEach((node) => {
		const text = node as SVGTextElement;
		const origOpacity = text.getAttribute(FLOW_OPACITY_ATTR);
		const origPointer = text.getAttribute(FLOW_POINTER_ATTR);
		if (origOpacity !== null) {
			if (origOpacity === '') text.removeAttribute('opacity');
			else text.setAttribute('opacity', origOpacity);
		} else {
			text.removeAttribute('opacity');
		}
		if (origPointer !== null) {
			if (origPointer === '') text.removeAttribute('pointer-events');
			else text.setAttribute('pointer-events', origPointer);
		} else {
			text.removeAttribute('pointer-events');
		}
		text.removeAttribute(FLOW_OPACITY_ATTR);
		text.removeAttribute(FLOW_POINTER_ATTR);
	});
	clone
		.querySelectorAll(`foreignObject[${FLOW_FOREIGN_ATTR}="true"]`)
		.forEach((node) => node.remove());
	clone.querySelectorAll(`rect[${FLOW_BOX_ATTR}="true"]`).forEach((node) => node.remove());
	clone.querySelectorAll(`text[${FLOW_MEASURE_ATTR}="true"]`).forEach((node) => node.remove());
	clone.querySelectorAll(`style[${FLOW_STYLE_ATTR}="true"]`).forEach((node) => node.remove());
	clone.querySelectorAll('*').forEach(stripFlowAttributes);

	const serializer = new XMLSerializer();
	return serializer.serializeToString(clone);
};

export const isFlowForeignObject = (el: Element) =>
	el.tagName.toLowerCase() === 'foreignobject' && el.getAttribute(FLOW_FOREIGN_ATTR) === 'true';
