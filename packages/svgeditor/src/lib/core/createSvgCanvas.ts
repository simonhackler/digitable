import type {
	EditorError,
	EditorMode,
	ElementTreeNode,
	SvgCanvasConfig,
	SvgEditorApi
} from './types';

export type SvgCanvasConstructor = new (
	container: HTMLElement,
	config?: SvgCanvasConfig
) => SvgCanvasLike;

type SvgCanvasLike = {
	bind?: (event: string, callback: (...args: unknown[]) => void) => void;
	unbind?: (event: string, callback: (...args: unknown[]) => void) => void;
	updateCanvas?: (width: number, height: number) => { x: number; y: number } | void;
	setSvgString: (xmlString: string, preventUndo?: boolean) => boolean;
	getSvgString: () => string;
	setMode: (name: string) => void;
	getMode: () => string;
	getZoom: () => number;
	setZoom: (zoomLevel: number) => void;
	setConfig?: (opts: SvgCanvasConfig) => void;
	getBaseUnit?: () => string;
	getTypeMap?: () => Record<string, number>;
	getSvgContent?: () => SVGSVGElement;
	getSvgRoot?: () => SVGSVGElement;
	setHref?: (elem: Element, href: string) => void;
	addExtension?: (
		name: string,
		extInitFunc: (args: Record<string, unknown>) => unknown,
		opts?: { importLocale?: unknown }
	) => Promise<unknown>;
	getFontSize?: () => number;
	setFontSize?: (val: number) => void;
	getFontFamily?: () => string;
	setFontFamily?: (val: string) => void;
	getBold?: () => boolean;
	setBold?: (val: boolean) => void;
	getItalic?: () => boolean;
	setItalic?: (val: boolean) => void;
	changeSelectedAttribute?: (attr: string, val: string | number, elems?: Element[]) => void;
	deleteSelectedElements?: () => void;
	clear?: () => void;
	getSelectedElements?: () => Element[];
	clearSelection?: (noUndo?: boolean) => void;
	addToSelection?: (elems: Element[], showGrips?: boolean) => void;
	selectOnly?: (elems: Element[], showGrips?: boolean) => void;
	call?: (event: string, args: unknown[]) => void;
	undoMgr?: {
		undo?: () => void;
		redo?: () => void;
		addCommandToHistory?: (command: {
			apply: (handler?: {
				handleHistoryEvent?: (eventType: string, command: unknown) => void;
			}) => void;
			unapply: (handler?: {
				handleHistoryEvent?: (eventType: string, command: unknown) => void;
			}) => void;
			elements: () => Element[];
			getText: () => string;
			type: () => string;
		}) => void;
		resetUndoStack?: () => void;
		getUndoStackSize?: () => number;
		getRedoStackSize?: () => number;
		getNextUndoCommandText?: () => string;
		getNextRedoCommandText?: () => string;
	};
	textActions?: {
		setInputElem?: (elem: HTMLInputElement) => void;
		setMultilineInputElem?: (elem: HTMLTextAreaElement) => void;
		setCursor?: (index?: number) => void;
	};
	selectorManager?: {
		requestSelector?: (elem: Element) => {
			resize?: () => void;
			showGrips?: (show: boolean) => void;
		};
	};
	setTextContent?: (text: string) => void;
	contentW?: number;
	contentH?: number;
	useMultilineText?: boolean;
};

type CreateSvgCanvasArgs = {
	container: HTMLElement;
	canvasContainer?: HTMLElement | null;
	textInput: HTMLInputElement;
	multilineTextInput: HTMLTextAreaElement;
	value: string;
	config?: SvgCanvasConfig;
	centerOnLoad?: boolean;
	onChange?: (svg: string) => void;
	onSelectionChange?: (payload: { selectedElements: Element[]; multiselect: boolean }) => void;
	onModeChange?: (mode: EditorMode) => void;
	onError?: (err: EditorError) => void;
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

const escapeXmlAttribute = (value: string) =>
	value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

export const createSvgCanvas = ({
	container,
	canvasContainer,
	textInput,
	multilineTextInput,
	value,
	config,
	centerOnLoad = true,
	onChange,
	onSelectionChange,
	onModeChange,
	onError,
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

	const gridState = {
		show: (config as { showGrid?: boolean } | undefined)?.showGrid ?? true,
		snapping: (config as { gridSnapping?: boolean } | undefined)?.gridSnapping ?? true,
		step: normalizeStep(
			typeof (config as { snappingStep?: number } | undefined)?.snappingStep === 'number'
				? (config as { snappingStep?: number }).snappingStep
				: DEFAULT_GRID_STEP
		),
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
				const label = child.getAttribute('data-name') ?? nextLabel(tagName);
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
		const expansion =
			typeof (config as { canvas_expansion?: number } | undefined)?.canvas_expansion === 'number'
				? (config as { canvas_expansion?: number }).canvas_expansion
				: 1;

		const contentW = typeof canvas.contentW === 'number' ? canvas.contentW : wOrig;
		const contentH = typeof canvas.contentH === 'number' ? canvas.contentH : hOrig;

		let width = Math.max(wOrig, contentW * zoom * expansion);
		let height = Math.max(hOrig, contentH * zoom * expansion);

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
	};

	const changeHandler = () => {
		onChange?.(canvas.getSvgString());
	};

	const enableMultilineTextElements = () => {
		const svgContent = canvas.getSvgContent?.();
		if (!svgContent || !canvas.useMultilineText) return;
		for (const textElement of svgContent.querySelectorAll('text')) {
			if (!textElement.hasAttribute('data-svgedit-multiline')) {
				textElement.setAttribute('data-svgedit-multiline', 'true');
			}
			if (!textElement.hasAttribute('data-svgedit-raw-text')) {
				textElement.setAttribute('data-svgedit-raw-text', textElement.textContent ?? '');
			}
		}
	};

	const createBlankSvgFromCanvas = () => {
		const svgContent = canvas.getSvgContent?.();
		const width = svgContent?.getAttribute('width')?.trim() || '300';
		const height = svgContent?.getAttribute('height')?.trim() || '150';
		const viewBox =
			svgContent?.getAttribute('viewBox')?.trim() || `0 0 ${width} ${height}`;
		return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="${SVG_NS}" width="${escapeXmlAttribute(width)}" height="${escapeXmlAttribute(height)}" viewBox="${escapeXmlAttribute(viewBox)}"></svg>`;
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
		const selected = canvas.getSelectedElements?.() ?? [];
		onSelectionChange?.({
			selectedElements: selected,
			multiselect: selected.length > 1
		});
	};

	const modeHandler = (event: Event) => {
		if (!onModeChange) return;
		if (event instanceof CustomEvent && typeof event.detail?.getMode === 'function') {
			onModeChange(event.detail.getMode());
			return;
		}
		onModeChange(canvas.getMode());
	};

	canvas.bind?.('changed', changeHandler);
	canvas.bind?.('selected', selectionHandler);
	document.addEventListener('modeChange', modeHandler);

	canvas.useMultilineText = true;
	canvas.textActions?.setInputElem?.(textInput);
	canvas.textActions?.setMultilineInputElem?.(multilineTextInput);
	const forwardTextInput = (event: Event) => {
		const target = event.currentTarget as HTMLInputElement | HTMLTextAreaElement | null;
		if (!target) return;
		canvas.setTextContent?.(target.value);
	};
	const forwardMultilineCursor = (event?: Event) => {
		const target = event?.currentTarget as HTMLTextAreaElement | null;
		const selected = canvas.getSelectedElements?.()?.[0];
		if ((event?.type === 'keyup' || event?.type === 'input') && selected?.tagName === 'text') {
			selected.setAttribute('data-svgedit-multiline', 'true');
			if (!selected.hasAttribute('data-svgedit-raw-text')) {
				selected.setAttribute('data-svgedit-raw-text', target?.value ?? selected.textContent ?? '');
			}
		}
		canvas.textActions?.setCursor?.();
	};
	const handleMultilineEnter = (event: KeyboardEvent) => {
		if (event.key !== 'Enter' || event.altKey || event.ctrlKey || event.metaKey) return;

		event.preventDefault();

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
			canvas.setTextContent?.(nextValue);
		}

		canvas.textActions?.setCursor?.(nextIndex);
	};
	textInput.addEventListener('input', forwardTextInput);
	textInput.addEventListener('keyup', forwardTextInput);
	multilineTextInput.addEventListener('keydown', handleMultilineEnter);
	multilineTextInput.addEventListener('input', forwardTextInput);
	multilineTextInput.addEventListener('keyup', forwardMultilineCursor);
	multilineTextInput.addEventListener('input', forwardMultilineCursor);
	multilineTextInput.addEventListener('click', forwardMultilineCursor);
	multilineTextInput.addEventListener('mouseup', forwardMultilineCursor);
	multilineTextInput.addEventListener('select', forwardMultilineCursor);

	if (rulerElements.x || rulerElements.y) {
		container.addEventListener('scroll', syncRulerScroll);
	}

	const initialWidth =
		container.clientWidth ||
		(typeof (config as { dimensions?: number[] } | undefined)?.dimensions?.[0] === 'number'
			? (config as { dimensions?: number[] }).dimensions?.[0]
			: 300);
	const initialHeight =
		container.clientHeight ||
		(typeof (config as { dimensions?: number[] } | undefined)?.dimensions?.[1] === 'number'
			? (config as { dimensions?: number[] }).dimensions?.[1]
			: 150);

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
			return loadOk;
		},
		getSvg() {
			return canvas.getSvgString();
		},
		setMode(mode) {
			const nextMode = mode === 'text' && canvas.useMultilineText ? 'textmultiline' : mode;
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
				unapply(
					handler?: { handleHistoryEvent?: (eventType: string, command: unknown) => void }
				) {
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
			canvas.changeSelectedAttribute?.('fill', color);
		},
		setStroke(color) {
			canvas.changeSelectedAttribute?.('stroke', color);
		},
		setStrokeWidth(value) {
			canvas.changeSelectedAttribute?.('stroke-width', value);
		},
		getFontSize() {
			return canvas.getFontSize?.() ?? 0;
		},
		setFontSize(value) {
			if (!Number.isFinite(value)) return;
			const next = Math.max(1, value);
			canvas.setFontSize?.(next);
		},
		getFontFamily() {
			return canvas.getFontFamily?.() ?? '';
		},
		setFontFamily(value) {
			if (!value) return;
			canvas.setFontFamily?.(value);
		},
		getBold() {
			return Boolean(canvas.getBold?.());
		},
		setBold(value) {
			canvas.setBold?.(value);
		},
		getItalic() {
			return Boolean(canvas.getItalic?.());
		},
		setItalic(value) {
			canvas.setItalic?.(value);
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
		selectElementById(id, opts) {
			const element = resolveElementById(id);
			if (!element) return;
			const selection = [element];
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
			element.setAttribute('data-name', trimmed);
			canvas.call?.('changed', [canvas.getSvgContent?.()]);
		},
		destroy() {
			canvas.unbind?.('changed', changeHandler);
			canvas.unbind?.('selected', selectionHandler);
			document.removeEventListener('modeChange', modeHandler);
			textInput.removeEventListener('input', forwardTextInput);
			textInput.removeEventListener('keyup', forwardTextInput);
			multilineTextInput.removeEventListener('keydown', handleMultilineEnter);
			multilineTextInput.removeEventListener('input', forwardTextInput);
			multilineTextInput.removeEventListener('keyup', forwardMultilineCursor);
			multilineTextInput.removeEventListener('input', forwardMultilineCursor);
			multilineTextInput.removeEventListener('click', forwardMultilineCursor);
			multilineTextInput.removeEventListener('mouseup', forwardMultilineCursor);
			multilineTextInput.removeEventListener('select', forwardMultilineCursor);
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
