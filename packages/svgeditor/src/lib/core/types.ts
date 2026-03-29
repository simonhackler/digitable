export type SvgString = string;

export type SvgCanvasConfig = Record<string, unknown>;

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
		step: number;
		color: string;
	};
	setGridVisible(show: boolean): void;
	setGridSnapping(enabled: boolean): void;
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
		rawCanvas(): unknown;
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
