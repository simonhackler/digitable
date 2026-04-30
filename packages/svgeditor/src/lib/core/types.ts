export type SvgString = string;

export type SvgCanvasConfig = {
	canvas_expansion?: number;
	dimensions?: [number, number];
	gridColor?: string;
	gridSnapping?: boolean;
	imgPath?: string;
	pageBorderSnapping?: boolean;
	showGrid?: boolean;
	showRulers?: boolean;
	show_outside_canvas?: boolean;
	snappingStep?: number;
	strict?: boolean;
	[key: string]: unknown;
};

export type SvgCanvasBBox = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type SvgCanvasRawApi = {
	addExtension?: (
		name: string,
		extInitFunc: (args: Record<string, unknown>) => unknown,
		opts?: { importLocale?: unknown }
	) => unknown | Promise<unknown>;
	addToSelection?: (elems: Element[], showGrips?: boolean) => void;
	alignSelectedElements?: (type: string, relativeTo: string) => void;
	bind?: (event: string, callback: (...args: unknown[]) => void) => void;
	call?: (event: string, args: unknown[]) => void;
	changeSelectedAttribute?: (attr: string, val: string | number, elems?: Element[]) => void;
	clear?: () => void;
	clearSelection?: (noUndo?: boolean) => void;
	contentH?: number;
	contentW?: number;
	deleteSelectedElements?: () => void;
	getBold?: () => boolean;
	getBlur?: (elem: Element) => number | string;
	getFontFamily?: () => string;
	getFontSize?: () => number;
	getItalic?: () => boolean;
	getMode: () => string;
	getOpacity?: () => number;
	getSelectedElements?: () => Element[];
	getStrokedBBox?: (elems: Element[]) => SvgCanvasBBox | null;
	getSvgContent?: () => SVGSVGElement;
	getSvgRoot?: () => SVGSVGElement;
	getSvgString: () => string;
	getZoom: () => number;
	moveSelectedElements?: (
		dx: number,
		dy: number,
		undoable?: boolean,
		snapToPageBorder?: boolean
	) => void;
	selectAllInCurrentLayer?: () => void;
	selectOnly?: (elems: Element[], showGrips?: boolean) => void;
	setBold?: (val: boolean) => void;
	setBlur?: (value: number, complete?: boolean) => void;
	setBlurNoUndo?: (value: number) => void;
	setConfig?: (opts: SvgCanvasConfig) => void;
	setFontFamily?: (val: string) => void;
	setFontSize?: (val: number) => void;
	setHref?: (elem: Element, href: string) => void;
	setItalic?: (val: boolean) => void;
	setMode: (name: string) => void;
	setOpacity?: (value: number) => void;
	setRectRadius?: (value: number) => void;
	setRotationAngle?: (value: number, preventUndo?: boolean) => void;
	setSvgString: (xmlString: string, preventUndo?: boolean) => boolean;
	setTextContent?: (text: string) => void;
	setZoom: (zoomLevel: number) => void;
	textActions?: {
		setCursor?: (index?: number) => void;
		setInputElem?: (elem: HTMLInputElement) => void;
		setMultilineInputElem?: (elem: HTMLTextAreaElement) => void;
	};
	undoMgr?: {
		addCommandToHistory?: (command: {
			apply: (handler?: {
				handleHistoryEvent?: (eventType: string, command: unknown) => void;
			}) => void;
			elements: () => Element[];
			getText: () => string;
			type: () => string;
			unapply: (handler?: {
				handleHistoryEvent?: (eventType: string, command: unknown) => void;
			}) => void;
		}) => void;
		getNextRedoCommandText?: () => string;
		getNextUndoCommandText?: () => string;
		getRedoStackSize?: () => number;
		getUndoStackSize?: () => number;
		redo?: () => void;
		resetUndoStack?: () => void;
		undo?: () => void;
	};
	unbind?: (event: string, callback: (...args: unknown[]) => void) => void;
	updateCanvas?: (width: number, height: number) => { x: number; y: number } | void;
	useMultilineText?: boolean;
};

export type ElementTreeNode = {
	id: string;
	tagName: string;
	label: string;
	parentId: string | null;
	depth: number;
	children: ElementTreeNode[];
	isGroup: boolean;
	isExpanded?: boolean;
	isHidden?: boolean;
	isLocked?: boolean;
	elementRef?: Element;
};

export type ElementMovePosition =
	| { type: 'before'; siblingId?: string }
	| { type: 'after'; siblingId?: string }
	| { type: 'inside' };

export type EditorMode =
	| 'select'
	| 'rect'
	| 'circle'
	| 'ellipse'
	| 'line'
	| 'text'
	| 'textmultiline'
	| 'path'
	| 'fhpath'
	| 'image'
	| string;

export type EditorErrorCode = 'INIT_FAILED' | 'LOAD_FAILED' | 'CONFIG_ERROR';

export type EditorError = {
	code: EditorErrorCode;
	message: string;
	cause?: unknown;
};

export type SvgEditorApi = {
	loadSvg(svg: string, opts?: { preventUndo?: boolean; center?: boolean }): boolean;
	getSvg(): string;

	setMode(mode: EditorMode): void;
	getMode(): EditorMode;

	clear(): void;
	deleteSelection(): void;

	zoomIn(): void;
	zoomOut(): void;
	setZoom(value: number): void;
	getZoom(): number;

	setFill(color: string): void;
	setStroke(color: string): void;
	setStrokeWidth(value: number): void;
	getFontSize(): number;
	setFontSize(value: number): void;
	getFontFamily(): string;
	setFontFamily(value: string): void;
	getBold(): boolean;
	setBold(value: boolean): void;
	getItalic(): boolean;
	setItalic(value: boolean): void;

	focusTextInput(): void;
	refreshLayout(opts?: { center?: boolean }): void;

	getGridSettings(): {
		show: boolean;
		snapping: boolean;
		pageBorderSnapping: boolean;
		step: number;
		color: string;
	};
	setGridVisible(show: boolean): void;
	setGridSnapping(enabled: boolean): void;
	setPageBorderSnapping(enabled: boolean): void;
	setSnappingStep(step: number): void;
	setGridColor(color: string): void;
	getRulerSettings(): {
		show: boolean;
	};
	setRulersVisible(show: boolean): void;

	undo(): void;
	redo(): void;
	getUndoStackSize(): number;
	getRedoStackSize(): number;
	getNextUndoCommandText(): string;
	getNextRedoCommandText(): string;

	getElementTree(): ElementTreeNode[];
	getElementById(id: string): Element | null;
	selectElementById(id: string, opts?: { add?: boolean }): void;
	moveElement(
		elementId: string,
		targetParentId: string | null,
		position: ElementMovePosition
	): void;
	setElementHidden(id: string, hidden: boolean): void;
	setElementLocked(id: string, locked: boolean): void;
	setElementName(id: string, name: string): void;

	destroy(): void;

	_unsafe?: {
		rawCanvas(): SvgCanvasRawApi | null;
	};
};

export type ReadyEvent = {
	api: SvgEditorApi;
};

export type ChangeEvent = {
	svg: string;
	source: 'user' | 'external';
};

export type SelectionChangeEvent = {
	selectedElements: Element[];
	multiselect: boolean;
};

export type ModeChangeEvent = {
	mode: EditorMode;
};

export type ErrorEvent = EditorError;
