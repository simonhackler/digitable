import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext';

const RAW_TEXT_ATTR = 'data-svgedit-raw-text';
const WRAP_WIDTH_ATTR = 'data-svgedit-wrap-width';
const WRAP_HEIGHT_ATTR = 'data-svgedit-wrap-height';
const LINE_HEIGHT_ATTR = 'data-svgedit-line-height';
const MULTILINE_ATTR = 'data-svgedit-multiline';
const OVERFLOW_ATTR = 'data-svgedit-text-overflow';
const EMPTY_LINE_ATTR = 'data-svgedit-empty-line';
const EMPTY_LINE_PLACEHOLDER = ' ';
const FRAME_ORIGIN_ATTR = 'data-svgedit-frame-origin';
const SVG_NS = 'http://www.w3.org/2000/svg';
const FONT_SIZE_STYLE_REGEX = /font-size\s*:\s*([^;]+)/i;
const LINE_HEIGHT_STYLE_REGEX = /line-height\s*:\s*([^;]+)/i;
const TEXT_ALIGN_STYLE_REGEX = /text-align\s*:\s*([^;]+)/i;

const toNumber = (value: string | null | undefined, fallback = Number.NaN) => {
	const parsed = Number.parseFloat(value ?? '');
	return Number.isFinite(parsed) ? parsed : fallback;
};

const parseLength = (value: string | null | undefined, relativeTo = 1) => {
	if (typeof value !== 'string') return Number.NaN;

	const normalized = value.trim().toLowerCase();
	if (!normalized || normalized === 'normal') return Number.NaN;
	if (/^-?\d*\.?\d+$/.test(normalized)) return Number.parseFloat(normalized) * relativeTo;
	if (normalized.endsWith('px')) return Number.parseFloat(normalized);
	if (normalized.endsWith('%')) return (Number.parseFloat(normalized) * relativeTo) / 100;
	if (normalized.endsWith('em')) return Number.parseFloat(normalized) * relativeTo;
	return Number.parseFloat(normalized);
};

const getStyleValue = (textElem: SVGTextElement, regex: RegExp) => {
	const styleAttr = textElem.getAttribute('style') || '';
	return styleAttr.match(regex)?.[1]?.trim() || '';
};

const getDirectTspans = (textElem: SVGTextElement) =>
	Array.from(textElem.querySelectorAll<SVGTSpanElement>('tspan'));

export const getTextFontSize = (textElem: SVGTextElement) => {
	const attrSize = toNumber(textElem.getAttribute('font-size'));
	if (Number.isFinite(attrSize) && attrSize > 0) return attrSize;

	const computedSize = parseLength(window.getComputedStyle(textElem).fontSize);
	if (Number.isFinite(computedSize) && computedSize > 0) return computedSize;

	const inlineSize = parseLength(getStyleValue(textElem, FONT_SIZE_STYLE_REGEX));
	if (Number.isFinite(inlineSize) && inlineSize > 0) return inlineSize;

	return 16;
};

const getTextLineHeight = (textElem: SVGTextElement) => {
	const fontSize = getTextFontSize(textElem);
	const storedLineHeight = toNumber(textElem.getAttribute(LINE_HEIGHT_ATTR));
	if (Number.isFinite(storedLineHeight) && storedLineHeight > 0) return storedLineHeight;

	const computedLineHeight = parseLength(window.getComputedStyle(textElem).lineHeight, fontSize);
	if (Number.isFinite(computedLineHeight) && computedLineHeight > 0) return computedLineHeight;

	const inlineLineHeight = parseLength(getStyleValue(textElem, LINE_HEIGHT_STYLE_REGEX), fontSize);
	if (Number.isFinite(inlineLineHeight) && inlineLineHeight > 0) return inlineLineHeight;

	const attrLineHeight = parseLength(textElem.getAttribute('line-height'), fontSize);
	if (Number.isFinite(attrLineHeight) && attrLineHeight > 0) return attrLineHeight;

	return fontSize * 1.2;
};

const buildFontShorthand = (textElem: SVGTextElement) => {
	const computedStyle = window.getComputedStyle(textElem);
	const fontStyle = computedStyle.fontStyle || textElem.getAttribute('font-style') || 'normal';
	const fontWeight = computedStyle.fontWeight || textElem.getAttribute('font-weight') || 'normal';
	const fontSize = computedStyle.fontSize || `${getTextFontSize(textElem)}px`;
	const fontFamily =
		computedStyle.fontFamily || textElem.getAttribute('font-family') || 'sans-serif';
	return `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
};

const getTextLineWidth = (textElem: SVGTextElement, line: SVGTSpanElement) => {
	const context = new OffscreenCanvas(1, 1).getContext('2d');
	if (!context) return 0;
	context.font = buildFontShorthand(textElem);
	return context.measureText(line.textContent ?? '').width;
};

const getTextAlign = (textElem: SVGTextElement) => {
	const inlineAlign = getStyleValue(textElem, TEXT_ALIGN_STYLE_REGEX);
	if (inlineAlign) return inlineAlign;

	const attrAlign = textElem.getAttribute('text-align');
	if (attrAlign) return attrAlign;

	const frameX = toNumber(textElem.getAttribute('x'));
	const frameWidth = toNumber(textElem.getAttribute(WRAP_WIDTH_ATTR));
	const line = getDirectTspans(textElem)[0];
	const lineX = toNumber(line?.getAttribute('x'));
	if (Number.isFinite(frameX) && Number.isFinite(frameWidth) && frameWidth > 0 && line) {
		const offset = lineX - frameX;
		if (offset <= 1) return 'left';
		const lineWidth = getTextLineWidth(textElem, line);
		const availableOffset = Math.max(0, frameWidth - lineWidth);
		if (availableOffset <= 1) return 'left';
		return offset >= availableOffset * 0.75 ? 'right' : 'center';
	}

	return window.getComputedStyle(textElem).textAlign || 'left';
};

const getWrapWidth = (textElem: SVGTextElement) => {
	const rawWrapWidth = toNumber(textElem.getAttribute(WRAP_WIDTH_ATTR));
	return Number.isFinite(rawWrapWidth) && rawWrapWidth > 0 ? rawWrapWidth : 1000000;
};

const clearTextChildren = (textElem: SVGTextElement) => {
	while (textElem.firstChild) {
		textElem.removeChild(textElem.firstChild);
	}
};

export const applyPretextSvgText = (textElem: SVGTextElement, rawText: string) => {
	const normalizedText = String(rawText ?? '');
	const hasHardBreaks = normalizedText.includes('\n') || normalizedText.includes('\r');
	const hasWrapWidth = Number.isFinite(toNumber(textElem.getAttribute(WRAP_WIDTH_ATTR)));
	const forceMultiline = textElem.getAttribute(MULTILINE_ATTR) === 'true';

	if (!hasHardBreaks && !hasWrapWidth && !forceMultiline) {
		clearTextChildren(textElem);
		textElem.textContent = normalizedText;
		textElem.removeAttribute(RAW_TEXT_ATTR);
		return;
	}

	const font = buildFontShorthand(textElem);
	const lineHeight = getTextLineHeight(textElem);
	const wrapWidth = getWrapWidth(textElem);
	const prepared = prepareWithSegments(normalizedText, font, { whiteSpace: 'pre-wrap' });
	const { lineCount, lines } = layoutWithLines(prepared, wrapWidth, lineHeight);
	const wrapHeight = toNumber(textElem.getAttribute(WRAP_HEIGHT_ATTR));
	const renderedLines =
		Number.isFinite(wrapHeight) && wrapHeight > 0 && lineHeight > 0
			? lines.slice(0, Math.max(1, Math.floor(wrapHeight / lineHeight)))
			: lines;

	clearTextChildren(textElem);
	const baseX = toNumber(textElem.getAttribute('x'), 0);
	const y = toNumber(textElem.getAttribute('y'), getTextLineHeight(textElem));
	const textAlign = getTextAlign(textElem);
	const baseline =
		textElem.getAttribute(FRAME_ORIGIN_ATTR) === 'top' ? y + getTextFontSize(textElem) : y;
	textElem.setAttribute('text-align', textAlign);

	for (const [index, line] of renderedLines.entries()) {
		const tspan = textElem.ownerDocument.createElementNS(SVG_NS, 'tspan');
		const lineOffset =
			textAlign === 'center' || textAlign === 'middle'
				? Math.max(0, (wrapWidth - line.width) / 2)
				: textAlign === 'right' || textAlign === 'end'
					? Math.max(0, wrapWidth - line.width)
					: 0;
		tspan.setAttribute('x', String(baseX + lineOffset));
		tspan.setAttribute('y', String(baseline + index * lineHeight));
		if (line.text === '') {
			tspan.setAttribute(EMPTY_LINE_ATTR, 'true');
			tspan.setAttribute('xml:space', 'preserve');
			tspan.setAttribute('textLength', '0');
			tspan.setAttribute('lengthAdjust', 'spacingAndGlyphs');
			tspan.textContent = EMPTY_LINE_PLACEHOLDER;
		} else {
			tspan.textContent = line.text;
		}
		textElem.appendChild(tspan);
	}

	textElem.setAttribute(RAW_TEXT_ATTR, normalizedText);
	if (Number.isFinite(wrapHeight) && wrapHeight > 0) {
		const estimatedHeight = Math.max(lineCount, 1) * lineHeight;
		textElem.setAttribute(OVERFLOW_ATTR, estimatedHeight > wrapHeight ? 'true' : 'false');
	} else {
		textElem.removeAttribute(OVERFLOW_ATTR);
	}
	if (forceMultiline || hasHardBreaks || hasWrapWidth) {
		textElem.setAttribute(MULTILINE_ATTR, 'true');
	}
};
