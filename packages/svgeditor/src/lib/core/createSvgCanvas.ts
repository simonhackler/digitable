import type {
	EditorError,
	EditorMode,
	ElementTreeNode,
	ChangeSvgEmission,
	Bounds,
	RemoteSvgInteraction,
	SvgClaim,
	SvgClaimDomain,
	SvgCanvasConfig,
	SvgCanvasRawApi,
	SvgEditorApi,
	SvgElementJsonNode,
	SvgInteractionEvent,
	SvgInteractionKind,
	SvgInteractionPreview
} from './types';
import { SVG_NODE_ID_ATTRIBUTE } from '../crdt/codec';
import type { NodeId, Paint, Stroke } from '../crdt/model';

export type SvgCanvasConstructor = new (
	container: HTMLElement,
	config?: SvgCanvasConfig
) => SvgCanvasLike;

type SvgCanvasLike = SvgCanvasRawApi & {
	getBaseUnit?: () => string;
	getCurrentMode?: () => string;
	getCurrentResizeMode?: () => string;
	getRotationAngle?: (elem: Element) => number;
	getTypeMap?: () => Record<string, number>;
	selectorManager?: {
		requestSelector?: (elem: Element) => {
			resize?: () => void;
			showGrips?: (show: boolean) => void;
		};
	};
};

type HistoryHandler = {
	handleHistoryEvent?: (eventType: string, command: unknown) => void;
};

type HistoryCommand = {
	apply: (handler?: HistoryHandler) => void;
	elements: () => Element[];
	getText: () => string;
	type: () => string;
	unapply: (handler?: HistoryHandler) => void;
};

export type CreateSvgCanvasArgs = {
	container: HTMLElement;
	canvasContainer?: HTMLElement | null;
	multilineTextInput: HTMLTextAreaElement;
	value: string;
	config?: SvgCanvasConfig;
	centerOnLoad?: boolean;
	emitChangeSvg?: ChangeSvgEmission;
	onChange?: (svg?: string) => void;
	onSelectionChange?: (payload: { selectedElements: Element[]; multiselect: boolean }) => void;
	onModeChange?: (mode: EditorMode) => void;
	onInteraction?: (event: SvgInteractionEvent) => void;
	onError?: (err: EditorError) => void;
	remoteInteractions?: RemoteSvgInteraction[];
	blockedClaims?: SvgClaim[];
	svgCanvasCtor?: SvgCanvasConstructor;
	rulers?: {
		frame?: HTMLElement | null;
		x?: HTMLElement | null;
		y?: HTMLElement | null;
		corner?: HTMLElement | null;
	};
};

const toError = (cause: unknown, fallback: string): Error => {
	if (cause instanceof Error) return cause;
	return new Error(fallback);
};

const DEFAULT_GRID_STEP = 10;
const DEFAULT_GRID_COLOR = '#000000';
const DEFAULT_RULER_COLOR = '#000000';
const DEFAULT_RULER_SIZE = 16;
const RULER_LIMIT = 30000;
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const MULTILINE_ATTR = 'data-svgedit-multiline';
const RAW_TEXT_ATTR = 'data-svgedit-raw-text';
const WRAP_WIDTH_ATTR = 'data-svgedit-wrap-width';
const WRAP_HEIGHT_ATTR = 'data-svgedit-wrap-height';
const SHAPE_INSIDE_ATTR = 'data-svgedit-shape-inside-ref';
const DIGITABLE_KIND_ATTR = 'data-digitable-kind';
const RESIZABLE_ATTR = 'data-svgedit-resizable';

const normalizeGridColor = (value: unknown) => {
	if (typeof value !== 'string' || !value.trim()) return DEFAULT_GRID_COLOR;
	let hex = value.trim();
	if (hex.startsWith('#')) {
		hex = hex.slice(1);
	}
	if (/^[0-9a-fA-F]{3}$/.test(hex)) {
		hex = hex
			.split('')
			.map((char) => char + char)
			.join('');
	}
	if (/^[0-9a-fA-F]{8}$/.test(hex)) {
		hex = hex.slice(0, 6);
	}
	if (!/^[0-9a-fA-F]{6}$/.test(hex)) return DEFAULT_GRID_COLOR;
	return `#${hex.toLowerCase()}`;
};

const normalizeStep = (value: number) =>
	Number.isFinite(value) && value > 0 ? value : DEFAULT_GRID_STEP;

const normalizeTextAlign = (value: string | null | undefined) => {
	const normalized = value?.trim().toLowerCase();
	if (normalized === 'left' || normalized === 'start') return 'left';
	if (normalized === 'center' || normalized === 'middle') return 'center';
	if (normalized === 'right' || normalized === 'end') return 'right';
	return null;
};

const getStyleDeclaration = (style: string | null | undefined, property: string) => {
	for (const declaration of (style ?? '').split(';')) {
		const separatorIndex = declaration.indexOf(':');
		if (separatorIndex === -1) continue;
		const key = declaration.slice(0, separatorIndex).trim().toLowerCase();
		const value = declaration.slice(separatorIndex + 1).trim();
		if (key === property && value) return value;
	}
	return null;
};

const escapeXmlAttribute = (value: string) =>
	value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

const getShapeInsideRef = (textElement: SVGTextElement) => {
	const explicit = textElement.getAttribute(SHAPE_INSIDE_ATTR);
	if (explicit) {
		const normalized = explicit.trim();
		if (normalized.startsWith('#')) return normalized.slice(1);
		const explicitMatch = /url\(\s*#([^)]+)\)/i.exec(normalized);
		if (explicitMatch) return explicitMatch[1];
		return normalized;
	}

	const styleAttr = textElement.getAttribute('style') ?? '';
	const styleMatch = /shape-inside\s*:\s*url\(\s*#([^)]+)\)/i.exec(styleAttr);
	return styleMatch?.[1] ?? null;
};

const getDirectTspans = (textElement: SVGTextElement) =>
	Array.from(textElement.children).filter(
		(child): child is SVGTSpanElement => child.tagName.toLowerCase() === 'tspan'
	);

const getImportedRawText = (textElement: SVGTextElement) => {
	const rawText = textElement.getAttribute(RAW_TEXT_ATTR);
	if (textElement.hasAttribute(RAW_TEXT_ATTR)) return rawText ?? '';

	const tspans = getDirectTspans(textElement);
	if (tspans.length > 0) {
		return tspans
			.map((tspan) =>
				tspan.getAttribute('data-svgedit-empty-line') === 'true' ? '' : (tspan.textContent ?? '')
			)
			.join('\n');
	}

	return textElement.textContent ?? '';
};

const hydrateImportedMultilineText = (svgContent: SVGSVGElement, textElement: SVGTextElement) => {
	const rawText = getImportedRawText(textElement);
	const shapeId = getShapeInsideRef(textElement);
	const isStructuredText = getDirectTspans(textElement).length > 0;

	if (!textElement.hasAttribute(RAW_TEXT_ATTR)) {
		textElement.setAttribute(RAW_TEXT_ATTR, rawText);
	}
	if (shapeId && !textElement.hasAttribute(SHAPE_INSIDE_ATTR)) {
		textElement.setAttribute(SHAPE_INSIDE_ATTR, `#${shapeId}`);
	}

	if (shapeId) {
		const shapeEl = svgContent.getElementById(shapeId) as SVGGraphicsElement | null;
		const x = shapeEl?.getAttribute('x');
		const y = shapeEl?.getAttribute('y');
		const width = shapeEl?.getAttribute('width');
		const height = shapeEl?.getAttribute('height');
		const fontSize = Number.parseFloat(textElement.getAttribute('font-size') ?? '');

		if (x && !textElement.getAttribute('x')) {
			textElement.setAttribute('x', x);
		}
		if (y && !textElement.getAttribute('y')) {
			const baseline =
				Number.isFinite(fontSize) && fontSize > 0
					? Number.parseFloat(y) + fontSize
					: Number.parseFloat(y);
			textElement.setAttribute('y', String(baseline));
		}
		if (width && !textElement.getAttribute(WRAP_WIDTH_ATTR)) {
			textElement.setAttribute(WRAP_WIDTH_ATTR, width);
		}
		if (height && !textElement.getAttribute(WRAP_HEIGHT_ATTR)) {
			textElement.setAttribute(WRAP_HEIGHT_ATTR, height);
		}
	}

	if (
		!textElement.hasAttribute(MULTILINE_ATTR) &&
		(shapeId !== null || isStructuredText || rawText.includes('\n') || rawText.includes('\r'))
	) {
		textElement.setAttribute(MULTILINE_ATTR, 'true');
	}
};

export const createSvgCanvas = ({
	container,
	canvasContainer,
	multilineTextInput,
	value,
	config,
	centerOnLoad = true,
	emitChangeSvg = true,
	onChange,
	onSelectionChange,
	onModeChange,
	onInteraction,
	onError,
	remoteInteractions: initialRemoteInteractions = [],
	blockedClaims: initialBlockedClaims = [],
	svgCanvasCtor,
	rulers
}: CreateSvgCanvasArgs): SvgEditorApi => {
	if (!svgCanvasCtor) {
		const error: EditorError = {
			code: 'INIT_FAILED',
			message: 'SvgCanvas constructor not provided.'
		};
		onError?.(error);
		throw new Error(error.message);
	}

	let canvas: SvgCanvasLike;
	let suppressEvents = false;
	try {
		canvas = new svgCanvasCtor(canvasContainer ?? container, config);
	} catch (cause) {
		const error: EditorError = {
			code: 'INIT_FAILED',
			message: 'Failed to initialize SvgCanvas.',
			cause
		};
		onError?.(error);
		throw toError(cause, error.message);
	}

	const getCanvasElement = (): HTMLElement | null =>
		container.querySelector('#svgcanvas') || canvasContainer || container;

	const configuredStep = (config as { snappingStep?: number } | undefined)?.snappingStep;
	const snappingStep = typeof configuredStep === 'number' ? configuredStep : DEFAULT_GRID_STEP;

	const gridState = {
		show: (config as { showGrid?: boolean } | undefined)?.showGrid ?? true,
		snapping: (config as { gridSnapping?: boolean } | undefined)?.gridSnapping ?? true,
		pageBorderSnapping:
			(config as { pageBorderSnapping?: boolean } | undefined)?.pageBorderSnapping ?? false,
		step: normalizeStep(snappingStep),
		color: normalizeGridColor((config as { gridColor?: string } | undefined)?.gridColor)
	};
	const rulerState = {
		show: Boolean((config as { showRulers?: boolean } | undefined)?.showRulers)
	};

	const rulerElements = rulers ?? {};
	const rulerIntervals = (() => {
		const intervals: number[] = [];
		for (let i = 0.1; i < 1e5; i *= 10) {
			intervals.push(i);
			intervals.push(2 * i);
			intervals.push(5 * i);
		}
		return intervals;
	})();

	type GridElements = {
		container: SVGSVGElement;
		pattern: SVGPatternElement;
		image: SVGImageElement;
		rect: SVGRectElement;
		canvas: HTMLCanvasElement;
		patternId: string;
	};

	let gridElements: GridElements | null = null;

	const getSvgRoot = () => {
		const canvasElement = getCanvasElement();
		if (!canvasElement) return null;
		return canvasElement.querySelector('#svgroot') as SVGSVGElement | null;
	};

	const excludedTags = new Set(['defs', 'style', 'metadata', 'title', 'desc']);
	const treeIdMap = new WeakMap<Element, string>();
	const treeIdReverse = new Map<string, Element>();
	let treeIdCounter = 1;
	const lockedPointerEvents = new WeakMap<Element, string | null>();
	const hiddenDisplay = new WeakMap<Element, string | null>();

	const isGroupElement = (elem: Element) => {
		const tag = elem.tagName.toLowerCase();
		return tag === 'g' || tag === 'svg';
	};

	const isRenderableElement = (elem: Element) => {
		const tag = elem.tagName.toLowerCase();
		if (excludedTags.has(tag)) return false;
		return true;
	};

	const getElementId = (elem: Element) => {
		const explicit = elem.getAttribute('id');
		if (explicit) return explicit;
		const existing = treeIdMap.get(elem);
		if (existing) return existing;
		const next = `tree-${treeIdCounter++}`;
		treeIdMap.set(elem, next);
		return next;
	};

	const indexTreeElement = (elem: Element) => {
		const id = getElementId(elem);
		treeIdReverse.set(id, elem);
		return id;
	};

	const queryById = (root: Element, id: string) => {
		if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
			return root.querySelector(`#${CSS.escape(id)}`);
		}
		const safeId = id.replace(/"/g, '\\"');
		return root.querySelector(`[id="${safeId}"]`);
	};

	const resolveElementById = (id: string) => {
		const svgContent = canvas.getSvgContent?.();
		if (!svgContent) return null;
		const mapped = treeIdReverse.get(id);
		if (mapped && svgContent.contains(mapped)) return mapped;
		return queryById(svgContent, id);
	};

	const buildElementTree = (): ElementTreeNode[] => {
		const svgContent = canvas.getSvgContent?.();
		if (!svgContent) return [];
		treeIdReverse.clear();
		const labelCounts = new Map<string, number>();

		const nextLabel = (tagName: string) => {
			const displayTag = tagName === 'g' ? 'group' : tagName;
			const count = (labelCounts.get(displayTag) ?? 0) + 1;
			labelCounts.set(displayTag, count);
			return `${displayTag}_${count}`;
		};

		const build = (parent: Element, depth: number, parentId: string | null): ElementTreeNode[] => {
			const nodes: ElementTreeNode[] = [];
			const children = Array.from(parent.children);
			for (const child of children) {
				if (!isRenderableElement(child)) continue;
				const id = indexTreeElement(child);
				const tagName = child.tagName.toLowerCase();
				const textLabel =
					tagName === 'text' ? getImportedRawText(child as SVGTextElement).trim() : '';
				const label = child.getAttribute('data-name') ?? (textLabel || nextLabel(tagName));
				const isGroup = isGroupElement(child);
				const isHidden =
					child.getAttribute('display') === 'none' || child.getAttribute('visibility') === 'hidden';
				const isLocked =
					child.getAttribute('data-locked') === 'true' ||
					child.getAttribute('pointer-events') === 'none';
				const node: ElementTreeNode = {
					id,
					tagName,
					label,
					parentId,
					depth,
					children: [],
					isGroup,
					isHidden,
					isLocked,
					elementRef: child
				};
				if (isGroup) {
					node.children = build(child, depth + 1, id);
				}
				nodes.push(node);
			}
			return nodes;
		};

		return build(svgContent, 0, null);
	};

	const ensureGridElements = () => {
		if (gridElements) return true;
		const svgroot = getSvgRoot();
		if (!svgroot) return false;

		const svgdoc = svgroot.ownerDocument;
		const defs =
			svgroot.querySelector('defs') ??
			svgroot.insertBefore(svgdoc.createElementNS(SVG_NS, 'defs'), svgroot.firstChild);

		const patternId = `gridpattern-${Math.random().toString(36).slice(2, 9)}`;
		const pattern = svgdoc.createElementNS(SVG_NS, 'pattern');
		pattern.setAttribute('id', patternId);
		pattern.setAttribute('patternUnits', 'userSpaceOnUse');
		pattern.setAttribute('x', '0');
		pattern.setAttribute('y', '0');
		pattern.setAttribute('width', '100');
		pattern.setAttribute('height', '100');

		const image = svgdoc.createElementNS(SVG_NS, 'image');
		image.setAttribute('x', '0');
		image.setAttribute('y', '0');
		image.setAttribute('width', '100');
		image.setAttribute('height', '100');
		pattern.append(image);
		defs.append(pattern);

		const gridContainer = svgdoc.createElementNS(SVG_NS, 'svg');
		gridContainer.setAttribute('id', 'canvasGrid');
		gridContainer.setAttribute('width', '100%');
		gridContainer.setAttribute('height', '100%');
		gridContainer.setAttribute('x', '0');
		gridContainer.setAttribute('y', '0');
		gridContainer.setAttribute('overflow', 'visible');
		gridContainer.style.pointerEvents = 'none';
		gridContainer.style.display = 'none';

		const rect = svgdoc.createElementNS(SVG_NS, 'rect');
		rect.setAttribute('width', '100%');
		rect.setAttribute('height', '100%');
		rect.setAttribute('x', '0');
		rect.setAttribute('y', '0');
		rect.setAttribute('stroke-width', '0');
		rect.setAttribute('stroke', 'none');
		rect.setAttribute('fill', `url(#${patternId})`);
		rect.style.pointerEvents = 'none';
		gridContainer.append(rect);

		const canvasBackground = svgroot.querySelector('#canvasBackground');
		const svgContent = svgroot.querySelector('#svgcontent');
		if (canvasBackground) {
			canvasBackground.append(gridContainer);
		} else if (svgContent) {
			svgroot.insertBefore(gridContainer, svgContent);
		} else {
			svgroot.append(gridContainer);
		}

		gridElements = {
			container: gridContainer,
			pattern,
			image,
			rect,
			canvas: svgdoc.createElement('canvas') as HTMLCanvasElement,
			patternId
		};
		return true;
	};

	const updateGrid = (zoom: number) => {
		if (!gridState.show) return;
		if (!ensureGridElements() || !gridElements) return;
		const unit = canvas.getTypeMap?.()[canvas.getBaseUnit?.() ?? 'px'] ?? 1;
		let stepSize = gridState.step;
		if ((canvas.getBaseUnit?.() ?? 'px') !== 'px') {
			stepSize *= unit;
		}
		const scaledStep = stepSize * zoom;
		if (!Number.isFinite(scaledStep) || scaledStep <= 0) return;
		const majorCount = 10;
		const bigInt = Math.max(scaledStep * majorCount, 2);

		gridElements.canvas.width = bigInt;
		gridElements.canvas.height = bigInt;
		const ctx = gridElements.canvas.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, bigInt, bigInt);
		ctx.globalAlpha = 0.2;
		ctx.strokeStyle = gridState.color;
		const part = scaledStep;
		const lineNum = 0;
		ctx.beginPath();
		for (let i = 1; i < majorCount; i++) {
			const subD = Math.round(part * i) + 0.5;
			ctx.moveTo(subD, bigInt);
			ctx.lineTo(subD, lineNum);
			ctx.moveTo(bigInt, subD);
			ctx.lineTo(lineNum, subD);
		}
		ctx.stroke();

		ctx.beginPath();
		ctx.globalAlpha = 0.5;
		ctx.moveTo(0.5, bigInt);
		ctx.lineTo(0.5, 0);
		ctx.moveTo(bigInt, 0.5);
		ctx.lineTo(0, 0.5);
		ctx.stroke();

		const datauri = gridElements.canvas.toDataURL('image/png');
		gridElements.image.setAttribute('width', String(bigInt));
		gridElements.image.setAttribute('height', String(bigInt));
		gridElements.pattern.setAttribute('width', String(bigInt));
		gridElements.pattern.setAttribute('height', String(bigInt));
		if (canvas.setHref) {
			canvas.setHref(gridElements.image, datauri);
		} else {
			gridElements.image.setAttributeNS(XLINK_NS, 'href', datauri);
			gridElements.image.setAttribute('href', datauri);
		}
	};

	const applyGridVisibility = () => {
		if (!gridState.show && !gridElements) return;
		if (!ensureGridElements() || !gridElements) return;
		gridElements.container.style.display = gridState.show ? 'block' : 'none';
		if (gridState.show) {
			updateGrid(canvas.getZoom() || 1);
		}
	};

	const readRulerColor = (element: HTMLElement | null) => {
		if (!element) return DEFAULT_RULER_COLOR;
		const color = getComputedStyle(element).color;
		return color && color.trim() ? color : DEFAULT_RULER_COLOR;
	};

	const ensureRulerTrack = (element: HTMLElement | null) => {
		if (!element) return null;
		const track = element.querySelector<HTMLElement>('.svgcanvas-ruler-track');
		return track ?? element;
	};

	const ensureRulerCanvas = (track: HTMLElement, isX: boolean) => {
		let canvas = track.querySelector('canvas') as HTMLCanvasElement | null;
		if (!canvas) {
			canvas = document.createElement('canvas');
			if (isX) {
				canvas.setAttribute('height', String(DEFAULT_RULER_SIZE));
			} else {
				canvas.setAttribute('width', String(DEFAULT_RULER_SIZE));
			}
			track.append(canvas);
		}
		return canvas;
	};

	const applyRulerVisibility = () => {
		const hasRulers = Boolean(rulerElements.x || rulerElements.y || rulerElements.corner);
		if (!hasRulers) return;
		const show = rulerState.show;
		const display = show ? '' : 'none';
		if (rulerElements.frame) {
			rulerElements.frame.dataset.rulers = show ? 'true' : 'false';
			rulerElements.frame.style.setProperty(
				'--ruler-size',
				show ? `${DEFAULT_RULER_SIZE}px` : '0px'
			);
		}
		if (rulerElements.x) rulerElements.x.style.display = display;
		if (rulerElements.y) rulerElements.y.style.display = display;
		if (rulerElements.corner) rulerElements.corner.style.display = display;
	};

	const syncRulerScroll = () => {
		if (!rulerState.show) return;
		if (rulerElements.x) {
			rulerElements.x.scrollLeft = container.scrollLeft;
		}
		if (rulerElements.y) {
			rulerElements.y.scrollTop = container.scrollTop;
		}
	};

	const updateRulers = (zoomValue?: number) => {
		if (!rulerState.show) return;
		if (!rulerElements.x || !rulerElements.y) return;

		const canvasElement = getCanvasElement();
		const contentElement = canvas.getSvgContent?.();
		if (!canvasElement || !contentElement) return;

		const zoom = zoomValue ?? (canvas.getZoom() || 1);
		const units = canvas.getTypeMap?.() ?? { px: 1 };
		const unit = units[canvas.getBaseUnit?.() ?? 'px'] ?? 1;
		const uMulti = unit * zoom;
		if (!Number.isFinite(uMulti) || uMulti <= 0) return;

		const tickColor = readRulerColor(rulerElements.x);
		const font = "600 9px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
		const scale = Math.max(1, window.devicePixelRatio || 1) * 2;
		const tickEnd = DEFAULT_RULER_SIZE - 1;
		const minorLong = DEFAULT_RULER_SIZE - 4;
		const minorShort = DEFAULT_RULER_SIZE - 6;

		const drawAxis = (axis: 'x' | 'y') => {
			const isX = axis === 'x';
			const ruler = isX ? rulerElements.x : rulerElements.y;
			if (!ruler) return;
			const track = ensureRulerTrack(ruler);
			if (!track) return;

			const totalLen = isX ? canvasElement.offsetWidth : canvasElement.offsetHeight;
			if (!Number.isFinite(totalLen) || totalLen <= 0) return;

			track.style[isX ? 'width' : 'height'] = `${totalLen}px`;

			const baseCanvas = ensureRulerCanvas(track, isX);
			const existing = Array.from(track.querySelectorAll('canvas'));
			for (const canvas of existing) {
				if (canvas !== baseCanvas) canvas.remove();
			}

			const segmentCount =
				totalLen > RULER_LIMIT ? Math.floor((totalLen - 1) / RULER_LIMIT) + 1 : 1;
			const canvases: HTMLCanvasElement[] = [baseCanvas];
			for (let i = 1; i < segmentCount; i++) {
				const clone = baseCanvas.cloneNode(true) as HTMLCanvasElement;
				track.append(clone);
				canvases.push(clone);
			}

			const segmentLen = totalLen > RULER_LIMIT ? RULER_LIMIT : totalLen;
			const ctxArr = canvases
				.map((canvas, index) => {
					const length = index === segmentCount - 1 ? totalLen - index * RULER_LIMIT : RULER_LIMIT;
					if (isX) {
						canvas.style.width = `${length}px`;
						canvas.style.height = `${DEFAULT_RULER_SIZE}px`;
						canvas.width = Math.floor(length * scale);
						canvas.height = Math.floor(DEFAULT_RULER_SIZE * scale);
					} else {
						canvas.style.width = `${DEFAULT_RULER_SIZE}px`;
						canvas.style.height = `${length}px`;
						canvas.width = Math.floor(DEFAULT_RULER_SIZE * scale);
						canvas.height = Math.floor(length * scale);
					}
					const ctx = canvas.getContext('2d');
					if (!ctx) return null;
					ctx.setTransform(1, 0, 0, 1, 0, 0);
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.setTransform(scale, 0, 0, scale, 0, 0);
					ctx.lineWidth = 1;
					ctx.font = font;
					ctx.fillStyle = tickColor;
					ctx.strokeStyle = tickColor;
					ctx.beginPath();
					return ctx;
				})
				.filter((ctx): ctx is CanvasRenderingContext2D => Boolean(ctx));

			if (!ctxArr.length) return;

			const contentDimRaw = contentElement.getAttribute(axis);
			const contentDim = Number.isFinite(Number(contentDimRaw)) ? Number(contentDimRaw) : 0;

			const rawM = 50 / uMulti;
			let multi = 1;
			for (const interval of rulerIntervals) {
				multi = interval;
				if (rawM <= interval) break;
			}

			const bigInt = multi * uMulti;
			const startOffset = (((contentDim / uMulti) % multi) + multi) % multi;
			let rulerPos = startOffset * uMulti;
			let labelPos = rulerPos - bigInt;

			while (rulerPos < totalLen) {
				labelPos += bigInt;
				const segmentIndex = Math.floor(rulerPos / segmentLen);
				const ctx = ctxArr[segmentIndex];
				if (ctx) {
					const localPos = rulerPos - segmentIndex * segmentLen;
					const curD = Math.round(localPos) + 0.5;
					if (isX) {
						ctx.moveTo(curD, tickEnd);
						ctx.lineTo(curD, 0);
					} else {
						ctx.moveTo(tickEnd, curD);
						ctx.lineTo(0, curD);
					}

					const num = (labelPos - contentDim) / uMulti;
					let label: string | number;
					if (multi >= 1) {
						label = Math.round(num);
					} else {
						const decs = String(multi).split('.')[1]?.length ?? 0;
						label = Number(num.toFixed(decs));
					}
					if (label !== 0 && label !== 1000 && Number(label) % 1000 === 0) {
						label = `${Number(label) / 1000}K`;
					}

					if (isX) {
						ctx.fillText(String(label), localPos + 2, 8);
					} else {
						const chars = String(label).split('');
						for (let i = 0; i < chars.length; i++) {
							ctx.fillText(chars[i], 1, localPos + 9 + i * 9);
						}
					}
				}

				const part = bigInt / 10;
				for (let i = 1; i < 10; i++) {
					const subPos = rulerPos + part * i;
					if (subPos < 0 || subPos > totalLen) continue;
					const subIndex = Math.floor(subPos / segmentLen);
					const subCtx = ctxArr[subIndex];
					if (!subCtx) continue;
					const localSub = subPos - subIndex * segmentLen;
					const subD = Math.round(localSub) + 0.5;
					const lineNum = i % 2 ? minorLong : minorShort;
					if (isX) {
						subCtx.moveTo(subD, tickEnd);
						subCtx.lineTo(subD, lineNum);
					} else {
						subCtx.moveTo(tickEnd, subD);
						subCtx.lineTo(lineNum, subD);
					}
				}

				rulerPos += bigInt;
			}

			for (const ctx of ctxArr) {
				ctx.stroke();
			}
		};

		drawAxis('x');
		drawAxis('y');
	};

	const refreshLayout = ({ center = false }: { center?: boolean } = {}) => {
		const workarea = container;
		const canvasElement = getCanvasElement();
		if (!canvasElement) return;

		const wOrig = workarea.clientWidth;
		const hOrig = workarea.clientHeight;
		if (!wOrig || !hOrig) return;

		const zoom = canvas.getZoom() || 1;
		const expansion = typeof config?.canvas_expansion === 'number' ? config.canvas_expansion : 1;

		const contentW = typeof canvas.contentW === 'number' ? canvas.contentW : wOrig;
		const contentH = typeof canvas.contentH === 'number' ? canvas.contentH : hOrig;

		const width = Math.max(wOrig, contentW * zoom * expansion);
		const height = Math.max(hOrig, contentH * zoom * expansion);

		workarea.style.overflow = width === wOrig && height === hOrig ? 'hidden' : 'auto';

		const oldCanX = canvasElement.clientWidth / 2 || wOrig / 2;
		const oldCanY = canvasElement.clientHeight / 2 || hOrig / 2;
		canvasElement.style.width = `${width}px`;
		canvasElement.style.height = `${height}px`;

		const newCanX = width / 2;
		const newCanY = height / 2;

		const offset = canvas.updateCanvas?.(width, height);
		const offsetX = (offset as { x?: number })?.x ?? 0;
		const offsetY = (offset as { y?: number })?.y ?? 0;

		const ratio = oldCanX ? newCanX / oldCanX : 1;

		const scrollX = width / 2 - wOrig / 2;
		const scrollY = height / 2 - hOrig / 2;

		const oldCtr = {
			x: workarea.scrollLeft + wOrig / 2,
			y: workarea.scrollTop + hOrig / 2
		};

		let newCtr = {
			x: newCanX,
			y: newCanY
		};

		const oldDistX = oldCtr.x - oldCanX;
		const oldDistY = oldCtr.y - oldCanY;
		newCtr = {
			x: newCanX + oldDistX * ratio,
			y: newCanY + oldDistY * ratio
		};

		newCtr.x += offsetX;
		newCtr.y += offsetY;

		if (center) {
			if (contentW > wOrig) {
				workarea.scrollLeft = offsetX - 10;
				workarea.scrollTop = offsetY - 10;
			} else {
				workarea.scrollLeft = scrollX;
				workarea.scrollTop = scrollY;
			}
		} else {
			workarea.scrollLeft = newCtr.x - wOrig / 2;
			workarea.scrollTop = newCtr.y - hOrig / 2;
		}

		syncRulerScroll();
		if (rulerState.show) {
			updateRulers(zoom);
		}
		if (previewOverlay) renderRemoteInteractions();
	};

	const changedElementsFromArgs = (args: unknown[]) =>
		args
			.flatMap((arg) => (Array.isArray(arg) ? arg : [arg]))
			.filter((item): item is Element => item instanceof Element);

	const claimDomains = (kind: SvgInteractionKind): SvgClaimDomain[] => {
		if (kind === 'fill' || kind === 'stroke') return [kind];
		if (kind === 'resize') return ['geometry', 'transform'];
		return ['transform'];
	};
	const getNodeId = (element: Element) => {
		const value = element.getAttribute(SVG_NODE_ID_ATTRIBUTE);
		return value ? (value as NodeId) : null;
	};
	const getNodeIds = (elements: Element[]) =>
		elements.flatMap((element) => {
			const nodeId = getNodeId(element);
			return nodeId ? [nodeId] : [];
		});
	const ensureSemanticNodeIds = () => {
		const root = canvas.getSvgContent?.();
		if (!root) return;
		const seen = new Set<string>();
		for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
			const current = element.getAttribute(SVG_NODE_ID_ATTRIBUTE);
			if (current && !seen.has(current)) {
				seen.add(current);
				continue;
			}
			let next: string;
			do {
				next = `node-${crypto.randomUUID()}`;
			} while (seen.has(next));
			element.setAttribute(SVG_NODE_ID_ATTRIBUTE, next);
			seen.add(next);
		}
	};
	const claimsFor = (kind: SvgInteractionKind, nodeIds: NodeId[]): SvgClaim[] =>
		nodeIds.flatMap((nodeId) => claimDomains(kind).map((domain) => ({ nodeId, domain })));
	const parsePaint = (value: string | null): Paint => {
		const normalized = value?.trim() ?? '';
		if (!normalized || normalized === 'none') return { kind: 'none' };
		const resource = /^url\(\s*#([^)\s]+)\s*\)\s*(.*)$/i.exec(normalized);
		if (resource) {
			return {
				kind: 'resource',
				sourceId: resource[1],
				resourceId: null,
				...(resource[2] ? { fallback: parsePaint(resource[2]) } : {})
			};
		}
		if (/^(?:#|rgb|hsl|lab|lch|oklab|oklch|color\(|[a-z]+$)/i.test(normalized)) {
			return { kind: 'color', value: normalized };
		}
		return { kind: 'raw', value: normalized };
	};
	const paintToAttribute = (paint: Paint): string => {
		switch (paint.kind) {
			case 'none':
				return 'none';
			case 'color':
			case 'raw':
				return paint.value;
			case 'resource': {
				const fallback = paint.fallback ? ` ${paintToAttribute(paint.fallback)}` : '';
				return `url(#${paint.sourceId})${fallback}`;
			}
		}
	};
	const finiteAttribute = (element: Element, name: string) => {
		const value = Number.parseFloat(element.getAttribute(name) ?? '');
		return Number.isFinite(value) ? value : undefined;
	};
	const parseStroke = (element: Element): Stroke => {
		const lineCap = element.getAttribute('stroke-linecap');
		const lineJoin = element.getAttribute('stroke-linejoin');
		const dash = element.getAttribute('stroke-dasharray')?.trim();
		return {
			paint: parsePaint(element.getAttribute('stroke')),
			...(finiteAttribute(element, 'stroke-width') !== undefined
				? { width: finiteAttribute(element, 'stroke-width') }
				: {}),
			...(lineCap === 'butt' || lineCap === 'round' || lineCap === 'square' ? { lineCap } : {}),
			...(lineJoin === 'miter' || lineJoin === 'round' || lineJoin === 'bevel' ? { lineJoin } : {}),
			...(finiteAttribute(element, 'stroke-miterlimit') !== undefined
				? { miterLimit: finiteAttribute(element, 'stroke-miterlimit') }
				: {}),
			...(dash
				? {
						dashArray:
							dash === 'none'
								? ('none' as const)
								: dash.split(/[ ,]+/).map(Number).filter(Number.isFinite)
					}
				: {}),
			...(finiteAttribute(element, 'stroke-dashoffset') !== undefined
				? { dashOffset: finiteAttribute(element, 'stroke-dashoffset') }
				: {})
		};
	};

	let remoteInteractions = initialRemoteInteractions;
	let blockedClaims = initialBlockedClaims;
	type LocalInteraction = RemoteSvgInteraction & {
		elements: Element[];
		attribute?: 'fill' | 'stroke';
		baselineAttributes?: (string | null)[];
	};
	let localInteraction: LocalInteraction | null = null;
	let pointerStartAngle: number | null = null;
	let lastInteractionClient = { x: 0, y: 0 };
	let pendingInteractionFrame: number | null = null;
	let pendingInteractionPreview: SvgInteractionPreview | null = null;
	let interactionSequence = 0;
	let previewOverlay: SVGSVGElement | null = null;
	type PreviewEntry = {
		source: Element;
		wrapper: SVGGElement;
		clone: Element;
		baseTransform: string;
		baseAttributes: Map<string, string | null>;
	};
	const previewEntries = new Map<NodeId, PreviewEntry>();

	const isBlocked = (kind: SvgInteractionKind, nodeIds: NodeId[]) => {
		const domains = claimDomains(kind);
		return blockedClaims.some(
			(claim) => domains.includes(claim.domain) && nodeIds.includes(claim.nodeId)
		);
	};
	const emitInteraction = (
		phase: SvgInteractionEvent['phase'],
		interaction: LocalInteraction,
		preview = interaction.preview
	) => {
		interaction.preview = preview;
		onInteraction?.({
			phase,
			interactionId: interaction.interactionId,
			nodeIds: [...interaction.nodeIds],
			claims: interaction.claims.map((claim) => ({ ...claim })),
			preview,
			...(interaction.color ? { color: interaction.color } : {})
		});
	};
	const createInteractionId = () => {
		interactionSequence += 1;
		return `svg-interaction-${Date.now().toString(36)}-${interactionSequence.toString(36)}`;
	};
	const findNodeElement = (nodeId: NodeId) => {
		const svgContent = canvas.getSvgContent?.();
		if (!svgContent) return null;
		if (svgContent.getAttribute(SVG_NODE_ID_ATTRIBUTE) === nodeId) return svgContent;
		return (
			Array.from(svgContent.querySelectorAll(`[${SVG_NODE_ID_ATTRIBUTE}]`)).find(
				(element) => element.getAttribute(SVG_NODE_ID_ATTRIBUTE) === nodeId
			) ?? null
		);
	};
	const applyStrokePreview = (element: Element, stroke: Stroke) => {
		if (stroke.paint) element.setAttribute('stroke', paintToAttribute(stroke.paint));
		if (stroke.width !== undefined) element.setAttribute('stroke-width', String(stroke.width));
		if (stroke.lineCap) element.setAttribute('stroke-linecap', stroke.lineCap);
		if (stroke.lineJoin) element.setAttribute('stroke-linejoin', stroke.lineJoin);
		if (stroke.miterLimit !== undefined)
			element.setAttribute('stroke-miterlimit', String(stroke.miterLimit));
		if (stroke.dashArray !== undefined) {
			element.setAttribute(
				'stroke-dasharray',
				stroke.dashArray === 'none' ? 'none' : stroke.dashArray.join(',')
			);
		}
		if (stroke.dashOffset !== undefined)
			element.setAttribute('stroke-dashoffset', String(stroke.dashOffset));
	};
	const syncOverlayAttributes = (overlay: SVGSVGElement, content: SVGSVGElement) => {
		for (const name of ['x', 'y', 'width', 'height', 'viewBox', 'preserveAspectRatio']) {
			const value = content.getAttribute(name);
			if (value === null) overlay.removeAttribute(name);
			else overlay.setAttribute(name, value);
		}
	};
	const unsafePreviewSelector =
		'script, foreignObject, iframe, audio, video, animate, animateMotion, animateTransform, set';
	const preparePreviewClone = (clone: Element, interactionId: string) => {
		if (clone.matches(unsafePreviewSelector)) return false;
		for (const unsafe of clone.querySelectorAll(unsafePreviewSelector)) {
			unsafe.remove();
		}
		const elements = [clone, ...Array.from(clone.querySelectorAll('*'))];
		const ids = new Map<string, string>();
		for (const element of elements) {
			element.setAttribute('pointer-events', 'none');
			(element as HTMLElement | SVGElement).style.pointerEvents = 'none';
			element.setAttribute('tabindex', '-1');
			element.removeAttribute('autofocus');
			element.removeAttribute('contenteditable');
			for (const attribute of Array.from(element.attributes)) {
				if (attribute.name.toLowerCase().startsWith('on')) element.removeAttribute(attribute.name);
			}
			const id = element.getAttribute('id');
			if (!id) continue;
			ids.set(id, `preview-${interactionId}-${id}`);
		}
		for (const element of elements) {
			const id = element.getAttribute('id');
			if (id) element.setAttribute('id', ids.get(id)!);
			for (const attribute of Array.from(element.attributes)) {
				let value = attribute.value.replace(
					/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g,
					(match, quote, target) => {
						const replacement = ids.get(target);
						return replacement ? `url(${quote}#${replacement}${quote})` : match;
					}
				);
				if (value.startsWith('#')) value = `#${ids.get(value.slice(1)) ?? value.slice(1)}`;
				if (value !== attribute.value) element.setAttribute(attribute.name, value);
			}
		}
		return true;
	};
	const rootMatrix = (element: Element, content: SVGSVGElement) => {
		if (!(element instanceof SVGGraphicsElement)) return '';
		const matrix = element.getCTM();
		const contentMatrix = content.getCTM();
		if (!matrix || !contentMatrix) return '';
		const relative = contentMatrix.inverse().multiply(matrix);
		return `matrix(${relative.a} ${relative.b} ${relative.c} ${relative.d} ${relative.e} ${relative.f})`;
	};
	const resetRemoteInteractions = () => {
		previewOverlay?.remove();
		previewOverlay = null;
		previewEntries.clear();
	};
	const renderRemoteInteractions = () => {
		if (remoteInteractions.length === 0) {
			resetRemoteInteractions();
			return;
		}
		const svgRoot = canvas.getSvgRoot?.();
		const svgContent = canvas.getSvgContent?.();
		if (!svgRoot || !svgContent) return;

		if (!previewOverlay) {
			previewOverlay = document.createElementNS(SVG_NS, 'svg');
			previewOverlay.setAttribute('data-svg-interaction-preview-overlay', 'true');
			previewOverlay.setAttribute('aria-hidden', 'true');
			previewOverlay.setAttribute('focusable', 'false');
			previewOverlay.setAttribute('overflow', 'visible');
			previewOverlay.setAttribute('pointer-events', 'none');
			previewOverlay.style.pointerEvents = 'none';
			svgRoot.append(previewOverlay);
		}
		syncOverlayAttributes(previewOverlay, svgContent);

		type ComposedPreview = {
			transforms: Extract<SvgInteractionPreview, { kind: 'move' | 'resize' | 'rotate' }>[];
			fill?: Paint;
			stroke?: Stroke;
			color?: string;
		};
		const composed = new Map<NodeId, ComposedPreview>();
		for (const interaction of remoteInteractions) {
			for (const nodeId of interaction.nodeIds) {
				const current = composed.get(nodeId) ?? { transforms: [] };
				if (interaction.preview.kind === 'fill') current.fill = interaction.preview.paint;
				else if (interaction.preview.kind === 'stroke') current.stroke = interaction.preview.stroke;
				else current.transforms.push(interaction.preview);
				current.color = interaction.color ?? current.color;
				composed.set(nodeId, current);
			}
		}

		for (const [nodeId, entry] of previewEntries) {
			if (composed.has(nodeId)) continue;
			entry.wrapper.remove();
			previewEntries.delete(nodeId);
		}

		const strokeAttributes = [
			'stroke',
			'stroke-width',
			'stroke-linecap',
			'stroke-linejoin',
			'stroke-miterlimit',
			'stroke-dasharray',
			'stroke-dashoffset'
		];
		for (const [nodeId, preview] of composed) {
			const source = findNodeElement(nodeId);
			if (!source || source === svgContent) {
				previewEntries.get(nodeId)?.wrapper.remove();
				previewEntries.delete(nodeId);
				continue;
			}
			let entry = previewEntries.get(nodeId);
			if (!entry || entry.source !== source) {
				entry?.wrapper.remove();
				const wrapper = document.createElementNS(SVG_NS, 'g');
				const clone = source.cloneNode(true) as Element;
				const interactionId = remoteInteractions.find((interaction) =>
					interaction.nodeIds.includes(nodeId)
				)?.interactionId;
				if (!preparePreviewClone(clone, interactionId ?? String(nodeId))) continue;
				clone.removeAttribute('transform');
				clone.setAttribute('data-svg-interaction-preview-node', nodeId);
				clone.setAttribute('pointer-events', 'none');
				wrapper.setAttribute('opacity', '0.68');
				wrapper.setAttribute('pointer-events', 'none');
				wrapper.append(clone);
				previewOverlay.append(wrapper);
				entry = {
					source,
					wrapper,
					clone,
					baseTransform: rootMatrix(source, svgContent),
					baseAttributes: new Map(
						['fill', ...strokeAttributes].map((name) => [name, clone.getAttribute(name)])
					)
				};
				previewEntries.set(nodeId, entry);
			}
			entry.baseTransform = rootMatrix(source, svgContent);
			for (const name of ['fill', ...strokeAttributes]) {
				entry.baseAttributes.set(name, source.getAttribute(name));
			}

			for (const [name, value] of entry.baseAttributes) {
				if (value === null) entry.clone.removeAttribute(name);
				else entry.clone.setAttribute(name, value);
			}
			if (preview.fill) entry.clone.setAttribute('fill', paintToAttribute(preview.fill));
			if (preview.stroke) applyStrokePreview(entry.clone, preview.stroke);
			if (preview.color) entry.wrapper.setAttribute('color', preview.color);
			else entry.wrapper.removeAttribute('color');

			const previewTransforms = preview.transforms.map((transform) => {
				if (transform.kind === 'move') {
					return `translate(${transform.delta.x} ${transform.delta.y})`;
				}
				if (transform.kind === 'resize') {
					const base = transform.baseBounds;
					const target = transform.bounds;
					const sx = base.width === 0 ? 1 : target.width / base.width;
					const sy = base.height === 0 ? 1 : target.height / base.height;
					return `translate(${target.x} ${target.y}) scale(${sx} ${sy}) translate(${-base.x} ${-base.y})`;
				}
				return `rotate(${transform.angle} ${transform.pivot.x} ${transform.pivot.y})`;
			});
			const projectionTransform = [...previewTransforms, entry.baseTransform]
				.filter(Boolean)
				.join(' ');
			if (projectionTransform) entry.wrapper.setAttribute('transform', projectionTransform);
			else entry.wrapper.removeAttribute('transform');
		}
	};

	type TransitionPayload =
		| {
				kind: 'move';
				elements: unknown[];
				delta: { x: number; y: number };
				client?: { x: number; y: number };
		  }
		| {
				kind: 'resize';
				elements: unknown[];
				baseBounds: Bounds;
				bounds: Bounds;
				client?: { x: number; y: number };
		  }
		| {
				kind: 'rotate';
				elements: unknown[];
				angle: number;
				pivot: { x: number; y: number };
				client?: { x: number; y: number };
		  };
	const isTransitionPayload = (value: unknown): value is TransitionPayload => {
		if (!value || typeof value !== 'object') return false;
		const payload = value as { kind?: unknown; elements?: unknown };
		return (
			(payload.kind === 'move' || payload.kind === 'resize' || payload.kind === 'rotate') &&
			Array.isArray(payload.elements)
		);
	};
	const legacyTransitionPayload = (value: unknown): TransitionPayload | null => {
		const elements = changedElementsFromArgs([value]);
		if (elements.length === 0) return null;
		const mode = canvas.getCurrentMode?.() ?? canvas.getMode();
		if (mode === 'rotate') {
			const angle = canvas.getRotationAngle?.(elements[0]) ?? 0;
			return { kind: 'rotate', elements, angle, pivot: { x: 0, y: 0 } };
		}
		if (mode !== 'select') return null;
		const element = elements[0];
		if (!(element instanceof SVGGraphicsElement)) return null;
		const transform = element.transform.baseVal.numberOfItems
			? element.transform.baseVal.getItem(0).matrix
			: null;
		return {
			kind: 'move',
			elements,
			delta: { x: transform?.e ?? 0, y: transform?.f ?? 0 }
		};
	};
	const queueInteractionPreview = (
		interaction: LocalInteraction,
		preview: SvgInteractionPreview
	) => {
		interaction.preview = preview;
		pendingInteractionPreview = preview;
		if (pendingInteractionFrame !== null) return;
		pendingInteractionFrame = requestAnimationFrame(() => {
			pendingInteractionFrame = null;
			const next = pendingInteractionPreview;
			pendingInteractionPreview = null;
			if (!next || localInteraction !== interaction) return;
			emitInteraction('update', interaction, next);
			if (remoteInteractions.length > 0) renderRemoteInteractions();
		});
	};
	const transitionHandler = (_window: unknown, args: unknown) => {
		const payload = isTransitionPayload(args) ? args : legacyTransitionPayload(args);
		if (!payload) return;
		if (payload.client) lastInteractionClient = payload.client;
		const elements = payload.elements.filter(
			(element): element is Element => element instanceof Element
		);
		if (elements.length === 0) return;
		const preview: SvgInteractionPreview =
			payload.kind === 'move'
				? { kind: 'move', delta: payload.delta }
				: payload.kind === 'resize'
					? { kind: 'resize', baseBounds: payload.baseBounds, bounds: payload.bounds }
					: {
							kind: 'rotate',
							angle: payload.angle - (pointerStartAngle ?? payload.angle),
							pivot: payload.pivot
						};
		if (!localInteraction) {
			const nodeIds = getNodeIds(elements);
			if (nodeIds.length === 0) return;
			localInteraction = {
				interactionId: createInteractionId(),
				nodeIds,
				claims: claimsFor(payload.kind, nodeIds),
				preview,
				elements
			};
			emitInteraction('start', localInteraction);
			return;
		}
		if (localInteraction.preview.kind === 'fill' || localInteraction.preview.kind === 'stroke')
			return;
		queueInteractionPreview(localInteraction, preview);
	};
	const finishTransformInteraction = () => {
		if (!localInteraction) return;
		if (localInteraction.preview.kind === 'fill' || localInteraction.preview.kind === 'stroke')
			return;
		const interaction = localInteraction;
		if (pendingInteractionFrame !== null) cancelAnimationFrame(pendingInteractionFrame);
		pendingInteractionFrame = null;
		const finalPreview = pendingInteractionPreview ?? interaction.preview;
		pendingInteractionPreview = null;
		emitInteraction('commit', interaction, finalPreview);
		localInteraction = null;
		pointerStartAngle = null;
	};
	let transformCommitQueued = false;

	const shouldEmitChangeSvg = (args: unknown[]) => {
		if (emitChangeSvg === false) return false;
		if (emitChangeSvg !== 'non-setup') return true;
		const changedElements = changedElementsFromArgs(args);
		if (changedElements.length === 0) return true;
		const svgContent = canvas.getSvgContent?.();
		return !changedElements.every(
			(element) => element === svgContent || Boolean(setupSelectionRoot(element))
		);
	};

	const changeHandler = (...args: unknown[]) => {
		if (suppressEvents) return;
		if (
			localInteraction &&
			localInteraction.preview.kind !== 'fill' &&
			localInteraction.preview.kind !== 'stroke'
		) {
			if (transformCommitQueued) return;
			transformCommitQueued = true;
			queueMicrotask(() => {
				transformCommitQueued = false;
				if (suppressEvents || !localInteraction) return;
				correctSelectedSetupSelectors();
				ensureSemanticNodeIds();
				onChange?.(shouldEmitChangeSvg(args) ? canvas.getSvgString() : undefined);
				finishTransformInteraction();
				resetRemoteInteractions();
				renderRemoteInteractions();
			});
			return;
		}
		correctSelectedSetupSelectors();
		ensureSemanticNodeIds();
		onChange?.(shouldEmitChangeSvg(args) ? canvas.getSvgString() : undefined);
		finishTransformInteraction();
		resetRemoteInteractions();
		renderRemoteInteractions();
	};

	const enableMultilineTextElements = () => {
		const svgContent = canvas.getSvgContent?.();
		if (!svgContent) return;
		for (const textElement of svgContent.querySelectorAll('text')) {
			hydrateImportedMultilineText(svgContent, textElement);
		}
	};

	const createBlankSvgFromCanvas = () => {
		const svgContent = canvas.getSvgContent?.();
		const width = svgContent?.getAttribute('width')?.trim() || '300';
		const height = svgContent?.getAttribute('height')?.trim() || '150';
		const viewBox = svgContent?.getAttribute('viewBox')?.trim() || `0 0 ${width} ${height}`;
		return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="${SVG_NS}" width="${escapeXmlAttribute(width)}" height="${escapeXmlAttribute(height)}" viewBox="${escapeXmlAttribute(viewBox)}"></svg>`;
	};

	const parsePositiveDimension = (value: string | null | undefined) => {
		if (!value) return null;
		const parsed = Number.parseFloat(value);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
	};

	const getSvgContentSize = () => {
		const svgContent = canvas.getSvgContent?.();
		const viewBox = svgContent?.getAttribute('viewBox');
		if (viewBox) {
			const parts = viewBox.split(/[ ,]+/).map((part) => Number(part));
			const width = parts[2];
			const height = parts[3];
			if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
				return { width, height };
			}
		}

		const width = parsePositiveDimension(svgContent?.getAttribute('width'));
		const height = parsePositiveDimension(svgContent?.getAttribute('height'));
		if (width && height) return { width, height };
		return { width: 300, height: 150 };
	};

	const findImageInsertionParent = (root: Element) =>
		root.querySelector(':scope > g.layer > g') ?? root.querySelector(':scope > g.layer') ?? root;

	const isElementNode = (node: Element | Text | null): node is Element =>
		Boolean(node && node.nodeType === Node.ELEMENT_NODE);

	const jsonElementId = (data: SvgElementJsonNode) => {
		const id = data.attr?.id;
		return typeof id === 'string' && id.trim() ? id : null;
	};

	const setImageHref = (image: Element, href: string) => {
		if (canvas.setHref) {
			canvas.setHref(image, href);
			return;
		}
		image.setAttribute('href', href);
		image.setAttributeNS(XLINK_NS, 'xlink:href', href);
	};

	const removeAttribute = (element: Element, name: string) => {
		if (name === 'xlink:href') {
			element.removeAttributeNS(XLINK_NS, 'href');
			element.removeAttribute('xlink:href');
			return;
		}
		element.removeAttribute(name);
	};

	const setAttribute = (element: Element, name: string, value: string) => {
		if (name === 'xlink:href') {
			element.setAttributeNS(XLINK_NS, 'xlink:href', value);
			return;
		}
		element.setAttribute(name, value);
	};

	const readAttributeSnapshot = (element: Element, names: string[]) => {
		const snapshot: Record<string, string | null> = {};
		for (const name of names) {
			snapshot[name] =
				name === 'xlink:href'
					? (element.getAttributeNS(XLINK_NS, 'href') ?? element.getAttribute('xlink:href'))
					: element.getAttribute(name);
		}
		return snapshot;
	};

	const applyAttributeSnapshot = (element: Element, snapshot: Record<string, string | null>) => {
		for (const [name, value] of Object.entries(snapshot)) {
			if (value === null) {
				removeAttribute(element, name);
			} else {
				setAttribute(element, name, value);
			}
		}
	};

	const addCommandToHistory = (command: HistoryCommand) => {
		canvas.undoMgr?.addCommandToHistory?.(command);
	};

	type SelectorLike = {
		resize?: () => void;
		showGrips?: (show: boolean) => void;
	};

	type SelectorManagerLike = {
		requestSelector?: (elem: Element) => SelectorLike | null;
		selectorParentGroup?: Element | null;
	};

	const setupSelectionRoot = (element: Element | null | undefined) =>
		element?.closest?.(`[${DIGITABLE_KIND_ATTR}]`) ?? null;

	const selectableElement = (element: Element) => setupSelectionRoot(element) ?? element;

	const canResizeSelectedSetupElement = (element: Element) =>
		element.closest?.(`[${RESIZABLE_ATTR}="false"]`) === null;

	const resizeGripFromEventTarget = (target: EventTarget | null) => {
		if (!(target instanceof Element)) return null;
		return target.closest?.('[id^="selectorGrip_resize_"]') ?? null;
	};

	const selectedSetupRoot = () => {
		for (const element of canvas.getSelectedElements?.() ?? []) {
			const root = setupSelectionRoot(element);
			if (root) return root;
		}
		return null;
	};

	const correctSetupSelector = (element: Element | null | undefined) => {
		const setupRoot = setupSelectionRoot(element);
		if (!setupRoot) return;
		const manager = canvas.selectorManager as SelectorManagerLike | undefined;
		const selector = manager?.requestSelector?.(setupRoot);
		selector?.resize?.();
		if (!canResizeSelectedSetupElement(setupRoot)) {
			selector?.showGrips?.(false);
		}
	};

	const correctSelectedSetupSelectors = () => {
		for (const element of canvas.getSelectedElements?.() ?? []) {
			correctSetupSelector(element);
		}
	};

	let normalizingSetupSelection = false;

	const normalizeSetupSelection = () => {
		if (normalizingSetupSelection) return canvas.getSelectedElements?.() ?? [];
		const selected = canvas.getSelectedElements?.() ?? [];
		const normalized: Element[] = [];
		let changed = false;
		for (const element of selected) {
			const root = setupSelectionRoot(element);
			const next = root ?? element;
			if (next !== element) changed = true;
			if (!normalized.includes(next)) normalized.push(next);
		}
		if (!changed) return selected;
		normalizingSetupSelection = true;
		try {
			if (canvas.selectOnly) {
				canvas.selectOnly(normalized, true);
			} else {
				canvas.clearSelection?.(true);
				canvas.addToSelection?.(normalized, true);
			}
		} finally {
			normalizingSetupSelection = false;
		}
		return normalized;
	};

	const selectElement = (element: Element) => {
		const target = selectableElement(element);
		if (canvas.selectOnly) {
			canvas.selectOnly([target], true);
		} else if (canvas.addToSelection) {
			canvas.addToSelection([target], true);
		}
		correctSetupSelector(target);
		selectionHandler();
	};

	const cancelSetupTextEdit = (element: Element | null | undefined) => {
		const root = setupSelectionRoot(element);
		if (!root) return false;
		canvas.setMode('select');
		selectElement(root);
		return true;
	};

	const setupRootForEditorEvent = (event: Event) => {
		const target = event.target;
		if (!(target instanceof Element)) return null;
		const targetRoot = setupSelectionRoot(target);
		if (targetRoot) return targetRoot;

		const selectorParent = (canvas.selectorManager as SelectorManagerLike | undefined)
			?.selectorParentGroup;
		if (selectorParent?.contains(target)) {
			return selectedSetupRoot();
		}

		return null;
	};

	const preventSetupTextEdit = (event: MouseEvent) => {
		const root = setupRootForEditorEvent(event);
		if (!root) return;
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
		canvas.setMode('select');
		selectElement(root);
	};

	const preventSetupResize = (event: Event) => {
		if (!resizeGripFromEventTarget(event.target)) return;
		const root = selectedSetupRoot();
		if (!root || canResizeSelectedSetupElement(root)) return;
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
		canvas.setMode('select');
		selectElement(root);
	};

	const emitElementChanged = (element?: Element | null) => {
		const fallback = canvas.getSvgContent?.();
		const changedElement = element ?? fallback;
		if (!changedElement) return;
		canvas.call?.('changed', [changedElement]);
		correctSelectedSetupSelectors();
		selectionHandler();
	};

	const applyAttributes = (element: Element, attributes?: Record<string, string>) => {
		for (const [name, value] of Object.entries(attributes ?? {})) {
			element.setAttribute(name, value);
		}
	};

	const createImageElement = (
		href: string,
		opts?: { width?: number; height?: number; attributes?: Record<string, string> }
	) => {
		const svgContent = canvas.getSvgContent?.();
		if (!svgContent) return null;

		const size = getSvgContentSize();
		const shorterSide = Math.min(size.width, size.height);
		const width = opts?.width ?? Math.max(1, Math.round(shorterSide * 0.35 * 100) / 100);
		const height = opts?.height ?? width;
		const x = Math.round(((size.width - width) / 2) * 100) / 100;
		const y = Math.round(((size.height - height) / 2) * 100) / 100;
		const id = canvas.getNextId?.() ?? `image_${Date.now().toString(36)}`;

		if (canvas.addSVGElementsFromJson) {
			const image = canvas.addSVGElementsFromJson({
				element: 'image',
				attr: {
					id,
					x,
					y,
					width,
					height,
					preserveAspectRatio: 'xMidYMid meet',
					style: 'pointer-events:inherit'
				}
			});
			if (!isElementNode(image)) return null;
			setImageHref(image, href);
			applyAttributes(image, opts?.attributes);
			return image;
		}

		const image = svgContent.ownerDocument.createElementNS(SVG_NS, 'image');
		image.setAttribute('id', id);
		image.setAttribute('x', String(x));
		image.setAttribute('y', String(y));
		image.setAttribute('width', String(width));
		image.setAttribute('height', String(height));
		image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
		image.setAttribute('style', 'pointer-events:inherit');
		setImageHref(image, href);
		applyAttributes(image, opts?.attributes);
		findImageInsertionParent(svgContent).append(image);
		return image;
	};

	const addSvgElementFromJson = (data: SvgElementJsonNode) => {
		if (!canvas.addSVGElementsFromJson) return null;
		const element = canvas.addSVGElementsFromJson(data);
		return isElementNode(element) ? element : null;
	};

	const createInsertElementCommand = (
		element: Element,
		parent: ParentNode | null,
		nextSibling: ChildNode | null,
		label: string
	): HistoryCommand => ({
		apply(handler?: HistoryHandler) {
			handler?.handleHistoryEvent?.('before_apply', this);
			if (parent && element.parentNode !== parent) {
				const reference = nextSibling && nextSibling.parentNode === parent ? nextSibling : null;
				parent.insertBefore(element, reference);
			}
			selectElement(element);
			emitElementChanged(element);
			handler?.handleHistoryEvent?.('after_apply', this);
		},
		unapply(handler?: HistoryHandler) {
			handler?.handleHistoryEvent?.('before_unapply', this);
			if (element.parentNode) {
				element.parentNode.removeChild(element);
			}
			canvas.clearSelection?.(true);
			emitElementChanged(parent instanceof Element ? parent : null);
			handler?.handleHistoryEvent?.('after_unapply', this);
		},
		elements() {
			return [element];
		},
		getText() {
			return label;
		},
		type() {
			return 'InsertElementCommand';
		}
	});

	const replaceElementWithSnapshot = (
		id: string,
		snapshot: Element,
		fallback: Element | null,
		selectAfterReplace: boolean
	) => {
		const live = resolveElementById(id) ?? fallback;
		const parent = live?.parentNode;
		if (!live || !parent) return null;
		const replacement = snapshot.cloneNode(true) as Element;
		parent.replaceChild(replacement, live);
		if (selectAfterReplace) {
			selectElement(replacement);
		}
		emitElementChanged(replacement);
		return replacement;
	};

	const applySvgString = (
		svg: string,
		{ center = true, emitChange = false }: { center?: boolean; emitChange?: boolean } = {}
	) => {
		const loadOk = canvas.setSvgString(svg, true);
		if (!loadOk) return false;
		enableMultilineTextElements();
		if (center) {
			refreshLayout({ center: true });
		}
		if (gridState.show) {
			updateGrid(canvas.getZoom() || 1);
		}
		if (rulerState.show) {
			updateRulers(canvas.getZoom() || 1);
		}
		if (emitChange) {
			canvas.call?.('changed', [canvas.getSvgContent?.()]);
		}
		return true;
	};

	const selectionHandler = () => {
		if (suppressEvents) return;
		const selected = normalizeSetupSelection();
		correctSelectedSetupSelectors();
		onSelectionChange?.({
			selectedElements: selected,
			multiselect: selected.length > 1
		});
	};

	const modeHandler = (event: Event) => {
		if (suppressEvents) return;
		if (!onModeChange) return;
		if (event instanceof CustomEvent && typeof event.detail?.getMode === 'function') {
			onModeChange(event.detail.getMode());
			return;
		}
		onModeChange(canvas.getMode());
	};

	canvas.bind?.('changed', changeHandler);
	canvas.bind?.('selected', selectionHandler);
	canvas.bind?.('transition', transitionHandler);
	document.addEventListener('modeChange', modeHandler);

	canvas.textActions?.setMultilineInputElem?.(multilineTextInput);
	const emitCanvasChange = () => {
		canvas.call?.('changed', [canvas.getSvgContent?.()]);
	};
	const applySelectedElementChange = (change: () => void) => {
		const before = canvas.getSvgString();
		change();
		if (canvas.getSvgString() !== before) {
			emitCanvasChange();
		}
	};
	const applySelectedAttributeChange = (name: string, value: string | number) => {
		const selected = (canvas.getSelectedElements?.() ?? []).filter(Boolean);
		const next = String(value);
		if (selected.length === 0 || selected.every((element) => element.getAttribute(name) === next)) {
			return;
		}
		canvas.changeSelectedAttribute?.(name, value, selected);
		emitCanvasChange();
	};
	const beginColorInteraction = (kind: 'fill' | 'stroke') => {
		if (localInteraction) return localInteraction.preview.kind === kind;
		if (
			!canvas.changeSelectedAttributeNoUndo ||
			!canvas.undoMgr?.beginUndoableChange ||
			!canvas.undoMgr.finishUndoableChange
		)
			return false;
		const elements = (canvas.getSelectedElements?.() ?? []).filter(Boolean);
		if (elements.length === 0) return false;
		const nodeIds = getNodeIds(elements);
		if (isBlocked(kind, nodeIds)) return false;
		const attribute = kind;
		const preview: SvgInteractionPreview =
			kind === 'fill'
				? { kind, paint: parsePaint(elements[0].getAttribute('fill')) }
				: { kind, stroke: parseStroke(elements[0]) };
		canvas.undoMgr?.beginUndoableChange?.(attribute, elements);
		localInteraction = {
			interactionId: createInteractionId(),
			nodeIds,
			claims: claimsFor(kind, nodeIds),
			preview,
			elements,
			attribute,
			baselineAttributes: elements.map((element) => element.getAttribute(attribute))
		};
		emitInteraction('start', localInteraction);
		return true;
	};
	const updateColorInteraction = (
		preview: Extract<SvgInteractionPreview, { kind: 'fill' | 'stroke' }>
	) => {
		if (!localInteraction && !beginColorInteraction(preview.kind)) return false;
		const interaction = localInteraction;
		if (!interaction || interaction.attribute !== preview.kind) return false;
		const paint = preview.kind === 'fill' ? preview.paint : preview.stroke.paint;
		if (!paint) return false;
		canvas.changeSelectedAttributeNoUndo?.(
			interaction.attribute,
			paintToAttribute(paint),
			interaction.elements
		);
		queueInteractionPreview(interaction, preview);
		return true;
	};
	const commitColorInteraction = (
		preview?: Extract<SvgInteractionPreview, { kind: 'fill' | 'stroke' }>
	) => {
		if (preview && !updateColorInteraction(preview)) return false;
		const interaction = localInteraction;
		if (!interaction?.attribute) return false;
		const command = canvas.undoMgr?.finishUndoableChange?.();
		if (pendingInteractionFrame !== null) cancelAnimationFrame(pendingInteractionFrame);
		pendingInteractionFrame = null;
		pendingInteractionPreview = null;
		localInteraction = null;
		if (command && !command.isEmpty()) {
			canvas.undoMgr?.addCommandToHistory?.(command);
			canvas.call?.('changed', interaction.elements);
		}
		emitInteraction('commit', interaction);
		return true;
	};
	const cancelLocalInteraction = () => {
		const interaction = localInteraction;
		if (!interaction) return false;
		if (interaction.attribute && interaction.baselineAttributes) {
			interaction.elements.forEach((element, index) => {
				const baseline = interaction.baselineAttributes?.[index] ?? null;
				if (baseline === null) element.removeAttribute(interaction.attribute!);
				else element.setAttribute(interaction.attribute!, baseline);
			});
			canvas.undoMgr?.finishUndoableChange?.();
			correctSelectedSetupSelectors();
		}
		if (pendingInteractionFrame !== null) cancelAnimationFrame(pendingInteractionFrame);
		pendingInteractionFrame = null;
		pendingInteractionPreview = null;
		localInteraction = null;
		pointerStartAngle = null;
		emitInteraction('cancel', interaction);
		return true;
	};
	const getActiveTextElement = () => {
		const selected = canvas.getSelectedElements?.()?.[0];
		if (selected?.tagName === 'text') return selected as SVGTextElement;
		const editingText = canvas.textActions?.getCurrentTextElement?.();
		if (editingText?.tagName === 'text') return editingText as SVGTextElement;
		return null;
	};
	const getTextLineWidth = (line: SVGTSpanElement) => {
		try {
			return line.getComputedTextLength();
		} catch {
			return 0;
		}
	};
	const inferRenderedTextAlign = (text: SVGTextElement) => {
		const frameX = Number.parseFloat(text.getAttribute('x') ?? '');
		const frameWidth = Number.parseFloat(text.getAttribute(WRAP_WIDTH_ATTR) ?? '');
		if (!Number.isFinite(frameX) || !Number.isFinite(frameWidth) || frameWidth <= 0) return null;

		for (const line of text.querySelectorAll('tspan')) {
			const lineX = Number.parseFloat(line.getAttribute('x') ?? '');
			if (!Number.isFinite(lineX)) continue;

			const offset = lineX - frameX;
			if (offset <= 1) return 'left';

			const availableOffset = Math.max(0, frameWidth - getTextLineWidth(line));
			if (availableOffset <= 1) return 'left';

			return offset >= availableOffset * 0.75 ? 'right' : 'center';
		}

		return null;
	};
	const getTextElementAlign = (text: SVGTextElement) =>
		normalizeTextAlign(getStyleDeclaration(text.getAttribute('style'), 'text-align')) ??
		normalizeTextAlign(text.getAttribute('text-align')) ??
		inferRenderedTextAlign(text);
	const syncSelectedMultilineText = (value: string | undefined) => {
		const selected = getActiveTextElement();
		if (!selected) return;
		selected.setAttribute('data-svgedit-multiline', 'true');
		if (value !== undefined) {
			selected.setAttribute('data-svgedit-raw-text', value);
		}
	};
	const syncSelectedMultilineAlignment = () => {
		const selected = getActiveTextElement();
		if (!selected) return;
		const align =
			getTextElementAlign(selected) ??
			normalizeTextAlign(multilineTextInput.style.textAlign) ??
			normalizeTextAlign(window.getComputedStyle(multilineTextInput).textAlign);
		if (!align) return;
		selected.setAttribute('text-align', align);
	};
	const forwardTextInput = (event: Event) => {
		const target = event.currentTarget as HTMLTextAreaElement | null;
		if (!target) return;
		if (cancelSetupTextEdit(getActiveTextElement())) return;
		syncSelectedMultilineAlignment();
		canvas.setTextContent?.(target.value);
		syncSelectedMultilineText(target.value);
		emitCanvasChange();
	};
	const forwardMultilineCursor = (event?: Event) => {
		const target = event?.currentTarget as HTMLTextAreaElement | null;
		if (cancelSetupTextEdit(getActiveTextElement())) return;
		if (event?.type === 'keyup' || event?.type === 'input') {
			syncSelectedMultilineText(target?.value);
		}
		canvas.textActions?.setCursor?.();
	};
	const handleMultilineEnter = (event: KeyboardEvent) => {
		if (event.key !== 'Enter' || event.altKey || event.ctrlKey || event.metaKey) return;

		event.preventDefault();
		if (cancelSetupTextEdit(getActiveTextElement())) return;

		const input = event.currentTarget as HTMLTextAreaElement | null;
		if (!input) return;

		const start = input.selectionStart ?? input.value.length;
		const end = input.selectionEnd ?? start;
		const nextValue = `${input.value.slice(0, start)}\n${input.value.slice(end)}`;
		const nextIndex = start + 1;
		const selected = canvas.getSelectedElements?.()?.[0];

		input.value = nextValue;
		input.setSelectionRange(nextIndex, nextIndex);

		if (selected?.tagName === 'text') {
			selected.setAttribute('data-svgedit-multiline', 'true');
			syncSelectedMultilineAlignment();
			canvas.setTextContent?.(nextValue);
			syncSelectedMultilineText(nextValue);
			emitCanvasChange();
		}

		canvas.textActions?.setCursor?.(nextIndex);
	};
	multilineTextInput.addEventListener('keydown', handleMultilineEnter);
	multilineTextInput.addEventListener('input', forwardTextInput);
	multilineTextInput.addEventListener('keyup', forwardMultilineCursor);
	multilineTextInput.addEventListener('input', forwardMultilineCursor);
	multilineTextInput.addEventListener('click', forwardMultilineCursor);
	multilineTextInput.addEventListener('mouseup', forwardMultilineCursor);
	multilineTextInput.addEventListener('select', forwardMultilineCursor);
	const editorEventTarget = canvasContainer ?? container;
	const blockClaimedTransform = (event: Event) => {
		const selected = (canvas.getSelectedElements?.() ?? []).filter(Boolean);
		const target = event.target;
		if (!(target instanceof Element)) return;
		const isGrip = Boolean(target.closest('[id^="selectorGrip_"]'));
		const gripKind: SvgInteractionKind = target.closest('#selectorGrip_rotate')
			? 'rotate'
			: isGrip
				? 'resize'
				: 'move';
		const targetNode = target.closest(`[${SVG_NODE_ID_ATTRIBUTE}]`);
		const targetNodeId = targetNode ? getNodeId(targetNode) : null;
		const blocked = targetNodeId
			? isBlocked(gripKind, [targetNodeId])
			: selected.length > 0 && isBlocked(gripKind, getNodeIds(selected));
		if (!blocked) return;
		const isSelectedTarget = selected.some(
			(element) => element === target || element.contains(target)
		);
		if (!targetNodeId && !isGrip && !isSelectedTarget) return;
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
	};
	const capturePointerStartAngle = () => {
		const elements = (canvas.getSelectedElements?.() ?? []).filter(Boolean);
		pointerStartAngle = elements.length ? (canvas.getRotationAngle?.(elements[0]) ?? 0) : null;
	};
	const cancelTransformInteraction = () => {
		if (localInteraction?.preview.kind === 'fill' || localInteraction?.preview.kind === 'stroke') {
			return;
		}
		cancelLocalInteraction();
		pointerStartAngle = null;
	};
	const finalizeNativeInteraction = () => {
		if (!canvas.getStarted?.()) return;
		editorEventTarget.dispatchEvent(
			new MouseEvent('mouseup', {
				bubbles: true,
				cancelable: true,
				clientX: lastInteractionClient.x,
				clientY: lastInteractionClient.y
			})
		);
	};
	const finishPointerInteraction = () => {
		queueMicrotask(() => {
			finalizeNativeInteraction();
			queueMicrotask(cancelTransformInteraction);
		});
	};
	const handlePointerEnd = (event: MouseEvent) => {
		lastInteractionClient = { x: event.clientX, y: event.clientY };
		finishPointerInteraction();
	};
	editorEventTarget.addEventListener('pointerdown', blockClaimedTransform, true);
	editorEventTarget.addEventListener('mousedown', blockClaimedTransform, true);
	editorEventTarget.addEventListener('pointerdown', preventSetupResize, true);
	editorEventTarget.addEventListener('mousedown', preventSetupResize, true);
	editorEventTarget.addEventListener('dblclick', preventSetupResize, true);
	editorEventTarget.addEventListener('dblclick', preventSetupTextEdit, true);
	editorEventTarget.addEventListener('mousedown', capturePointerStartAngle, true);
	editorEventTarget.addEventListener('pointercancel', finishPointerInteraction);
	window.addEventListener('blur', finishPointerInteraction);
	window.addEventListener('mouseup', handlePointerEnd);

	if (rulerElements.x || rulerElements.y) {
		container.addEventListener('scroll', syncRulerScroll);
	}

	const configDimensions = config?.dimensions;
	const initialWidth = container.clientWidth || configDimensions?.[0] || 300;
	const initialHeight = container.clientHeight || configDimensions?.[1] || 150;

	canvas.updateCanvas?.(initialWidth, initialHeight);

	const ok = canvas.setSvgString(value, true);
	if (ok) {
		enableMultilineTextElements();
		canvas.undoMgr?.resetUndoStack?.();
	}
	if (!ok) {
		onError?.({
			code: 'LOAD_FAILED',
			message: 'Failed to load SVG content.'
		});
	}

	canvas.setConfig?.({
		gridSnapping: gridState.snapping,
		pageBorderSnapping: gridState.pageBorderSnapping,
		snappingStep: gridState.step,
		gridColor: gridState.color
	});

	applyRulerVisibility();
	refreshLayout({ center: centerOnLoad });
	if (gridState.show) {
		applyGridVisibility();
	}
	if (rulerState.show) {
		syncRulerScroll();
		updateRulers(canvas.getZoom() || 1);
	}
	renderRemoteInteractions();

	canvas.addExtension?.(
		'svelte-grid',
		async () => ({
			zoomChanged(zoom: number) {
				if (gridState.show) updateGrid(zoom);
				if (rulerState.show) updateRulers(zoom);
			}
		}),
		{ importLocale: undefined }
	);

	const api: SvgEditorApi = {
		loadSvg(svg, opts) {
			cancelLocalInteraction();
			resetRemoteInteractions();
			const loadOk = canvas.setSvgString(svg, opts?.preventUndo);
			if (loadOk) {
				enableMultilineTextElements();
			}
			if (loadOk && opts?.preventUndo) {
				canvas.undoMgr?.resetUndoStack?.();
			}
			if (loadOk && opts?.center) {
				refreshLayout({ center: true });
			}
			if (gridState.show) {
				updateGrid(canvas.getZoom() || 1);
			}
			if (rulerState.show) {
				updateRulers(canvas.getZoom() || 1);
			}
			if (loadOk) renderRemoteInteractions();
			return loadOk;
		},
		applySvgProjection(svg, opts) {
			cancelLocalInteraction();
			resetRemoteInteractions();
			const selected = (canvas.getSelectedElements?.() ?? []).map((element) => ({
				id: element.getAttribute('id'),
				nodeId: element.getAttribute(SVG_NODE_ID_ATTRIBUTE)
			}));
			const zoom = canvas.getZoom();
			const mode = canvas.getMode();
			let loadOk = false;
			suppressEvents = true;
			try {
				loadOk = canvas.setSvgString(svg, true);
				if (!loadOk) return false;
				enableMultilineTextElements();
				canvas.undoMgr?.resetUndoStack?.();
				canvas.setZoom(zoom);
				refreshLayout({ center: opts?.center ?? false });
				if (gridState.show) updateGrid(canvas.getZoom() || 1);
				if (rulerState.show) updateRulers(canvas.getZoom() || 1);

				const root = canvas.getSvgContent?.();
				const restored = selected.flatMap(({ id, nodeId }) => {
					const byId = id ? resolveElementById(id) : null;
					if (byId) return [byId];
					if (!nodeId || !root) return [];
					const byNodeId = Array.from(root.querySelectorAll(`[${SVG_NODE_ID_ATTRIBUTE}]`)).find(
						(element) => element.getAttribute(SVG_NODE_ID_ATTRIBUTE) === nodeId
					);
					return byNodeId ? [byNodeId] : [];
				});
				if (restored.length > 0) canvas.selectOnly?.(restored, true);
				if (canvas.getMode() !== mode) canvas.setMode(mode);
				renderRemoteInteractions();
				return true;
			} finally {
				suppressEvents = false;
				if (loadOk) selectionHandler();
			}
		},
		getSvg() {
			return canvas.getSvgString();
		},
		setResolution(width, height) {
			const changed = canvas.setResolution?.(width, height) ?? false;
			if (!changed) return false;
			refreshLayout({ center: true });
			if (gridState.show) updateGrid(canvas.getZoom() || 1);
			if (rulerState.show) updateRulers(canvas.getZoom() || 1);
			return true;
		},
		setMode(mode) {
			if (mode === 'text' && cancelSetupTextEdit(canvas.getSelectedElements?.()?.[0])) return;
			const nextMode = mode === 'text' ? 'textmultiline' : mode;
			canvas.setMode(nextMode);

			if (nextMode !== 'textmultiline') return;

			const selected = canvas.getSelectedElements?.()?.[0];
			if (selected?.tagName !== 'text') return;

			const selector = canvas.selectorManager?.requestSelector?.(selected);
			selector?.resize?.();
			selector?.showGrips?.(true);
		},
		getMode() {
			return canvas.getMode() as EditorMode;
		},
		clear() {
			const previousSvg = canvas.getSvgString();
			const clearedSvg = createBlankSvgFromCanvas();

			const command = {
				text: 'Clear canvas',
				getText() {
					return this.text;
				},
				type() {
					return 'ClearSvgCommand';
				},
				elements() {
					const current = canvas.getSvgContent?.();
					return current ? [current] : [];
				},
				apply(handler?: { handleHistoryEvent?: (eventType: string, command: unknown) => void }) {
					handler?.handleHistoryEvent?.('before_apply', this);
					applySvgString(clearedSvg, { center: true });
					handler?.handleHistoryEvent?.('after_apply', this);
				},
				unapply(handler?: { handleHistoryEvent?: (eventType: string, command: unknown) => void }) {
					handler?.handleHistoryEvent?.('before_unapply', this);
					applySvgString(previousSvg, { center: true });
					handler?.handleHistoryEvent?.('after_unapply', this);
				}
			};

			const applied = applySvgString(clearedSvg, { center: true, emitChange: true });
			if (!applied) {
				canvas.clear?.();
				refreshLayout({ center: true });
				return;
			}

			canvas.undoMgr?.addCommandToHistory?.(command);
		},
		deleteSelection() {
			canvas.deleteSelectedElements?.();
		},
		duplicateSelection(opts) {
			if (typeof canvas.cloneSelectedElements !== 'function') return [];
			const selected = canvas.getSelectedElements?.().filter(Boolean) ?? [];
			if (selected.length === 0) return [];
			const dx = Number.isFinite(opts?.dx) ? Number(opts?.dx) : 20;
			const dy = Number.isFinite(opts?.dy) ? Number(opts?.dy) : 20;
			canvas.cloneSelectedElements(dx, dy);
			return (canvas.getSelectedElements?.() ?? [])
				.map((element) => element?.getAttribute('id') ?? '')
				.filter((id) => id.length > 0);
		},
		zoomIn() {
			const current = canvas.getZoom() || 1;
			const next = current * 1.1;
			canvas.setZoom(next);
			refreshLayout();
			if (gridState.show) updateGrid(canvas.getZoom() || next);
		},
		zoomOut() {
			const current = canvas.getZoom() || 1;
			const next = current / 1.1;
			canvas.setZoom(next);
			refreshLayout();
			if (gridState.show) updateGrid(canvas.getZoom() || next);
		},
		setZoom(value) {
			canvas.setZoom(value);
			refreshLayout();
			if (gridState.show) updateGrid(canvas.getZoom() || value);
		},
		getZoom() {
			return canvas.getZoom() || 1;
		},
		setFill(color) {
			if (isBlocked('fill', getNodeIds((canvas.getSelectedElements?.() ?? []).filter(Boolean))))
				return;
			applySelectedAttributeChange('fill', color);
		},
		setStroke(color) {
			if (isBlocked('stroke', getNodeIds((canvas.getSelectedElements?.() ?? []).filter(Boolean))))
				return;
			applySelectedAttributeChange('stroke', color);
		},
		setStrokeWidth(value) {
			if (isBlocked('stroke', getNodeIds((canvas.getSelectedElements?.() ?? []).filter(Boolean))))
				return;
			applySelectedAttributeChange('stroke-width', value);
		},
		beginColorInteraction(kind) {
			return beginColorInteraction(kind);
		},
		updateColorInteraction(preview) {
			return updateColorInteraction(preview);
		},
		commitColorInteraction(preview) {
			return commitColorInteraction(preview);
		},
		cancelInteraction() {
			return cancelLocalInteraction();
		},
		setRemoteInteractions(interactions, nextBlockedClaims = blockedClaims) {
			remoteInteractions = [...interactions];
			blockedClaims = [...nextBlockedClaims];
			renderRemoteInteractions();
		},
		isInteractionBlocked(kind, nodeIds) {
			return isBlocked(
				kind,
				nodeIds ?? getNodeIds((canvas.getSelectedElements?.() ?? []).filter(Boolean))
			);
		},
		getFontSize() {
			return canvas.getFontSize?.() ?? 0;
		},
		setFontSize(value) {
			if (!Number.isFinite(value)) return;
			const next = Math.max(1, value);
			applySelectedElementChange(() => canvas.setFontSize?.(next));
		},
		getFontFamily() {
			return canvas.getFontFamily?.() ?? '';
		},
		setFontFamily(value) {
			if (!value) return;
			applySelectedElementChange(() => canvas.setFontFamily?.(value));
		},
		getBold() {
			return Boolean(canvas.getBold?.());
		},
		setBold(value) {
			applySelectedElementChange(() => canvas.setBold?.(value));
		},
		getItalic() {
			return Boolean(canvas.getItalic?.());
		},
		setItalic(value) {
			applySelectedElementChange(() => canvas.setItalic?.(value));
		},
		focusTextInput() {
			multilineTextInput.focus();
		},
		refreshLayout(opts) {
			refreshLayout(opts);
		},
		getGridSettings() {
			return { ...gridState };
		},
		setGridVisible(show) {
			gridState.show = show;
			applyGridVisibility();
		},
		setGridSnapping(enabled) {
			gridState.snapping = enabled;
			canvas.setConfig?.({ gridSnapping: enabled });
		},
		setPageBorderSnapping(enabled) {
			gridState.pageBorderSnapping = enabled;
			canvas.setConfig?.({ pageBorderSnapping: enabled });
		},
		setSnappingStep(step) {
			const safeStep = normalizeStep(step);
			gridState.step = safeStep;
			canvas.setConfig?.({ snappingStep: safeStep });
			if (gridState.show) updateGrid(canvas.getZoom() || 1);
		},
		setGridColor(color) {
			const normalized = normalizeGridColor(color);
			gridState.color = normalized;
			canvas.setConfig?.({ gridColor: normalized });
			if (gridState.show) updateGrid(canvas.getZoom() || 1);
		},
		getRulerSettings() {
			return { ...rulerState };
		},
		setRulersVisible(show) {
			rulerState.show = show;
			applyRulerVisibility();
			refreshLayout();
		},
		undo() {
			canvas.undoMgr?.undo?.();
		},
		redo() {
			canvas.undoMgr?.redo?.();
		},
		getUndoStackSize() {
			return canvas.undoMgr?.getUndoStackSize?.() ?? 0;
		},
		getRedoStackSize() {
			return canvas.undoMgr?.getRedoStackSize?.() ?? 0;
		},
		getNextUndoCommandText() {
			return canvas.undoMgr?.getNextUndoCommandText?.() ?? '';
		},
		getNextRedoCommandText() {
			return canvas.undoMgr?.getNextRedoCommandText?.() ?? '';
		},
		getElementTree() {
			return buildElementTree();
		},
		getElementById(id) {
			return resolveElementById(id);
		},
		insertSvgElement(data, opts) {
			const explicitId = jsonElementId(data);
			if (explicitId && resolveElementById(explicitId)) return null;
			const element = addSvgElementFromJson(data);
			if (!element) return null;

			const parent = element.parentNode;
			const nextSibling = element.nextSibling;
			addCommandToHistory(
				createInsertElementCommand(
					element,
					parent,
					nextSibling,
					opts?.historyLabel ?? `Insert ${element.tagName}`
				)
			);

			const selectTarget =
				opts?.selectId && resolveElementById(opts.selectId)
					? resolveElementById(opts.selectId)
					: element;
			selectElement(selectTarget ?? element);
			emitElementChanged(element);
			return element.getAttribute('id');
		},
		updateSvgElement(id, data, opts) {
			const existing = resolveElementById(id);
			if (!existing) return false;
			const before = existing.cloneNode(true) as Element;
			const generatedId = `${id}__svgedit_update_${Date.now().toString(36)}`;
			const generated = addSvgElementFromJson({
				...data,
				attr: {
					...(data.attr ?? {}),
					id: generatedId
				}
			});
			if (!generated) return false;
			const after = generated.cloneNode(true) as Element;
			after.setAttribute('id', id);
			generated.parentNode?.removeChild(generated);
			const shouldSelect = opts?.select ?? true;
			let current: Element | null =
				replaceElementWithSnapshot(id, after, existing, shouldSelect) ?? existing;
			const command = {
				text: opts?.historyLabel ?? `Update ${current.tagName}`,
				apply(handler?: HistoryHandler) {
					handler?.handleHistoryEvent?.('before_apply', this);
					current = replaceElementWithSnapshot(id, after, current, shouldSelect) ?? current;
					handler?.handleHistoryEvent?.('after_apply', this);
				},
				unapply(handler?: HistoryHandler) {
					handler?.handleHistoryEvent?.('before_unapply', this);
					current = replaceElementWithSnapshot(id, before, current, shouldSelect) ?? current;
					handler?.handleHistoryEvent?.('after_unapply', this);
				},
				elements() {
					return current ? [current] : [];
				},
				getText() {
					return this.text;
				},
				type() {
					return 'UpdateElementCommand';
				}
			};
			addCommandToHistory(command);
			return true;
		},
		updateElementAttributes(id, attributes, opts) {
			const element = resolveElementById(id);
			if (!element) return false;
			const attributeNames = Object.keys(attributes);
			const before = readAttributeSnapshot(element, attributeNames);
			applyAttributeSnapshot(element, attributes);
			const after = readAttributeSnapshot(element, attributeNames);
			if (JSON.stringify(before) === JSON.stringify(after)) return true;
			const shouldSelect = opts?.select ?? true;
			const command = {
				text: opts?.historyLabel ?? `Update ${element.tagName} attributes`,
				apply(handler?: HistoryHandler) {
					handler?.handleHistoryEvent?.('before_apply', this);
					applyAttributeSnapshot(element, after);
					if (shouldSelect) selectElement(element);
					emitElementChanged(element);
					handler?.handleHistoryEvent?.('after_apply', this);
				},
				unapply(handler?: HistoryHandler) {
					handler?.handleHistoryEvent?.('before_unapply', this);
					applyAttributeSnapshot(element, before);
					if (shouldSelect) selectElement(element);
					emitElementChanged(element);
					handler?.handleHistoryEvent?.('after_unapply', this);
				},
				elements() {
					return [element];
				},
				getText() {
					return this.text;
				},
				type() {
					return 'UpdateAttributesCommand';
				}
			};
			addCommandToHistory(command);
			if (shouldSelect) selectElement(element);
			emitElementChanged(element);
			return true;
		},
		removeElementById(id, opts) {
			const element = resolveElementById(id);
			const parent = element?.parentNode ?? null;
			if (!element || !parent) return false;
			const nextSibling = element.nextSibling;
			let current: Element | null = element;
			const command = {
				text: opts?.historyLabel ?? `Remove ${element.tagName}`,
				apply(handler?: HistoryHandler) {
					handler?.handleHistoryEvent?.('before_apply', this);
					const live = resolveElementById(id) ?? current;
					if (live?.parentNode) {
						current = live;
						live.parentNode.removeChild(live);
					}
					canvas.clearSelection?.(true);
					emitElementChanged(parent instanceof Element ? parent : null);
					handler?.handleHistoryEvent?.('after_apply', this);
				},
				unapply(handler?: HistoryHandler) {
					handler?.handleHistoryEvent?.('before_unapply', this);
					if (current && current.parentNode !== parent) {
						const reference = nextSibling && nextSibling.parentNode === parent ? nextSibling : null;
						parent.insertBefore(current, reference);
					}
					if (current) selectElement(current);
					emitElementChanged(current);
					handler?.handleHistoryEvent?.('after_unapply', this);
				},
				elements() {
					return current ? [current] : [];
				},
				getText() {
					return this.text;
				},
				type() {
					return 'RemoveElementCommand';
				}
			};
			element.parentNode?.removeChild(element);
			addCommandToHistory(command);
			canvas.clearSelection?.(true);
			emitElementChanged(parent instanceof Element ? parent : null);
			return true;
		},
		insertImage(href, opts) {
			if (!href.trim()) return null;
			const image = createImageElement(href, opts);
			if (!image) return null;
			const parent = image.parentNode;
			const nextSibling = image.nextSibling;
			const command = {
				text: 'Insert Image',
				getText() {
					return this.text;
				},
				type() {
					return 'InsertImageCommand';
				},
				elements() {
					return [image];
				},
				apply(handler?: HistoryHandler) {
					handler?.handleHistoryEvent?.('before_apply', this);
					if (parent && image.parentNode !== parent) {
						parent.insertBefore(image, nextSibling);
					}
					selectElement(image);
					emitElementChanged(image);
					handler?.handleHistoryEvent?.('after_apply', this);
				},
				unapply(handler?: HistoryHandler) {
					handler?.handleHistoryEvent?.('before_unapply', this);
					if (image.parentNode) {
						image.parentNode.removeChild(image);
					}
					canvas.clearSelection?.(true);
					emitElementChanged(parent instanceof Element ? parent : null);
					handler?.handleHistoryEvent?.('after_unapply', this);
				}
			};
			addCommandToHistory(command);
			selectElement(image);
			emitElementChanged(image);
			return image.getAttribute('id');
		},
		selectElementById(id, opts) {
			const element = resolveElementById(id);
			if (!element) return;
			const selection = [selectableElement(element)];
			if (opts?.add) {
				if (canvas.addToSelection) {
					canvas.addToSelection(selection, true);
					return;
				}
			}
			if (canvas.selectOnly) {
				canvas.selectOnly(selection, true);
				return;
			}
			canvas.clearSelection?.(true);
			canvas.addToSelection?.(selection, true);
		},
		setSelectedImageHref(href, opts) {
			const selected = canvas.getSelectedElements?.()?.[0];
			if (!selected || selected.tagName.toLowerCase() !== 'image') return false;
			const attributeNames = ['href', 'xlink:href', ...Object.keys(opts?.attributes ?? {})];
			const previousAttributes = readAttributeSnapshot(selected, attributeNames);
			setImageHref(selected, href);
			applyAttributes(selected, opts?.attributes);
			const nextAttributes = readAttributeSnapshot(selected, attributeNames);
			const command = {
				text: 'Change Image',
				getText() {
					return this.text;
				},
				type() {
					return 'ChangeImageCommand';
				},
				elements() {
					return [selected];
				},
				apply(handler?: HistoryHandler) {
					handler?.handleHistoryEvent?.('before_apply', this);
					applyAttributeSnapshot(selected, nextAttributes);
					selectElement(selected);
					emitElementChanged(selected);
					handler?.handleHistoryEvent?.('after_apply', this);
				},
				unapply(handler?: HistoryHandler) {
					handler?.handleHistoryEvent?.('before_unapply', this);
					applyAttributeSnapshot(selected, previousAttributes);
					selectElement(selected);
					emitElementChanged(selected);
					handler?.handleHistoryEvent?.('after_unapply', this);
				}
			};
			addCommandToHistory(command);
			emitElementChanged(selected);
			return true;
		},
		moveElement(elementId, targetParentId, position) {
			const svgContent = canvas.getSvgContent?.();
			if (!svgContent) return;
			const element = resolveElementById(elementId);
			if (!element) return;
			const parent = targetParentId === null ? svgContent : resolveElementById(targetParentId);
			if (!parent) return;
			if (parent === element || element.contains(parent)) return;
			if (targetParentId !== null && !isGroupElement(parent)) return;

			if (position.type === 'inside') {
				parent.appendChild(element);
			} else {
				const siblingId = position.siblingId;
				if (siblingId) {
					const sibling = resolveElementById(siblingId);
					if (sibling && sibling.parentNode === parent) {
						if (position.type === 'before') {
							parent.insertBefore(element, sibling);
						} else {
							parent.insertBefore(element, sibling.nextSibling);
						}
					} else if (position.type === 'before') {
						parent.insertBefore(element, parent.firstChild);
					} else {
						parent.appendChild(element);
					}
				} else if (position.type === 'before') {
					parent.insertBefore(element, parent.firstChild);
				} else {
					parent.appendChild(element);
				}
			}

			canvas.call?.('changed', [canvas.getSvgContent?.()]);
		},
		setElementHidden(id, hidden) {
			const element = resolveElementById(id);
			if (!element) return;
			if (hidden) {
				if (!hiddenDisplay.has(element)) {
					hiddenDisplay.set(element, element.getAttribute('display'));
				}
				element.setAttribute('display', 'none');
			} else {
				const previous = hiddenDisplay.get(element);
				if (previous) {
					element.setAttribute('display', previous);
				} else {
					element.removeAttribute('display');
				}
				hiddenDisplay.delete(element);
			}
			canvas.call?.('changed', [canvas.getSvgContent?.()]);
		},
		setElementLocked(id, locked) {
			const element = resolveElementById(id);
			if (!element) return;
			if (locked) {
				if (!lockedPointerEvents.has(element)) {
					lockedPointerEvents.set(element, element.getAttribute('pointer-events'));
				}
				element.setAttribute('data-locked', 'true');
				element.setAttribute('pointer-events', 'none');
			} else {
				const previous = lockedPointerEvents.get(element);
				if (previous) {
					element.setAttribute('pointer-events', previous);
				} else {
					element.removeAttribute('pointer-events');
				}
				element.removeAttribute('data-locked');
				lockedPointerEvents.delete(element);
			}
			canvas.call?.('changed', [canvas.getSvgContent?.()]);
		},
		setElementName(id, name) {
			const element = resolveElementById(id);
			if (!element) return;
			const trimmed = name.trim();
			if (!trimmed) return;
			if (element.tagName.toLowerCase() === 'text') {
				if (cancelSetupTextEdit(element)) return;
				canvas.selectOnly?.([element], true);
				canvas.setTextContent?.(trimmed);
				canvas.call?.('changed', [element]);
				return;
			}
			element.setAttribute('data-name', trimmed);
			canvas.call?.('changed', [canvas.getSvgContent?.()]);
		},
		destroy() {
			cancelLocalInteraction();
			resetRemoteInteractions();
			canvas.unbind?.('changed', changeHandler);
			canvas.unbind?.('selected', selectionHandler);
			canvas.unbind?.('transition', transitionHandler);
			document.removeEventListener('modeChange', modeHandler);
			multilineTextInput.removeEventListener('keydown', handleMultilineEnter);
			multilineTextInput.removeEventListener('input', forwardTextInput);
			multilineTextInput.removeEventListener('keyup', forwardMultilineCursor);
			multilineTextInput.removeEventListener('input', forwardMultilineCursor);
			multilineTextInput.removeEventListener('click', forwardMultilineCursor);
			multilineTextInput.removeEventListener('mouseup', forwardMultilineCursor);
			multilineTextInput.removeEventListener('select', forwardMultilineCursor);
			editorEventTarget.removeEventListener('pointerdown', preventSetupResize, true);
			editorEventTarget.removeEventListener('pointerdown', blockClaimedTransform, true);
			editorEventTarget.removeEventListener('mousedown', blockClaimedTransform, true);
			editorEventTarget.removeEventListener('mousedown', preventSetupResize, true);
			editorEventTarget.removeEventListener('dblclick', preventSetupResize, true);
			editorEventTarget.removeEventListener('dblclick', preventSetupTextEdit, true);
			editorEventTarget.removeEventListener('mousedown', capturePointerStartAngle, true);
			editorEventTarget.removeEventListener('pointercancel', finishPointerInteraction);
			window.removeEventListener('blur', finishPointerInteraction);
			window.removeEventListener('mouseup', handlePointerEnd);
			if (rulerElements.x || rulerElements.y) {
				container.removeEventListener('scroll', syncRulerScroll);
			}
		},
		_unsafe: {
			rawCanvas() {
				return canvas;
			}
		}
	};

	return api;
};
