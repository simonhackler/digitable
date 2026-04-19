import type {
	ChangeEvent,
	EditorError,
	EditorMode,
	ElementTreeNode,
	ModeChangeEvent,
	ReadyEvent,
	SelectionChangeEvent,
	SvgEditorApi
} from '../core/types';

type SvgUnit = 'px' | 'mm';

const DEFAULT_NEW_WIDTH = 300;
const DEFAULT_NEW_HEIGHT = 150;

const isPositiveNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value > 0;

const normalizeDimension = (value: number, fallback: number) =>
	isPositiveNumber(value) ? value : fallback;

const escapeXmlAttribute = (value: string) =>
	value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

const createBlankSvgDocument = ({
	width,
	height,
	viewBox
}: {
	width: string;
	height: string;
	viewBox: string;
}) =>
	`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${escapeXmlAttribute(width)}" height="${escapeXmlAttribute(height)}" viewBox="${escapeXmlAttribute(viewBox)}"></svg>`;

const createBlankSvg = (width: number, height: number, unit: SvgUnit) =>
	createBlankSvgDocument({
		width: `${width}${unit}`,
		height: `${height}${unit}`,
		viewBox: `0 0 ${width} ${height}`
	});

const normalizeGridColor = (value: unknown) => {
	if (typeof value !== 'string' || !value.trim()) return '#000000';
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
	if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#000000';
	return `#${hex.toLowerCase()}`;
};

const getDetail = <T>(event: CustomEvent<T> | T): T =>
	event && typeof event === 'object' && 'detail' in event
		? (event as CustomEvent<T>).detail
		: event;

const normalizeMode = (mode: EditorMode): EditorMode =>
	mode === 'textedit' || mode === 'textmultiline' ? 'text' : mode;

class EditorController {
	api = $state<SvgEditorApi | null>(null);
	mode = $state<EditorMode>('select');
	selection = $state<Element[]>([]);
	multiselect = $state(false);
	selectedIds = $state<string[]>([]);
	elementTree = $state<ElementTreeNode[]>([]);
	collapsedIds = $state<string[]>([]);
	zoom = $state(1);
	isReady = $state(false);
	lastError = $state<EditorError | null>(null);
	gridVisible = $state(true);
	gridSnapping = $state(true);
	pageBorderSnapping = $state(false);
	gridStep = $state(10);
	gridColor = $state('#000000');
	rulersVisible = $state(false);
	undoCount = $state(0);
	redoCount = $state(0);
	nextUndoLabel = $state('');
	nextRedoLabel = $state('');
	elementIdByRef = new Map<Element, string>();

	handleReady = (event: CustomEvent<ReadyEvent> | ReadyEvent) => {
		const detail = getDetail(event);
		this.api = detail.api;
		this.isReady = true;
		this.zoom = detail.api.getZoom();
		this.mode = normalizeMode(detail.api.getMode());
		const grid = detail.api.getGridSettings();
		this.gridVisible = grid.show;
		this.gridSnapping = grid.snapping;
		this.pageBorderSnapping = grid.pageBorderSnapping;
		this.gridStep = grid.step;
		this.gridColor = normalizeGridColor(grid.color);
		this.rulersVisible = detail.api.getRulerSettings().show;
		this.refreshElementTree();
		this.refreshHistory();
	};

	handleChange = (event: CustomEvent<ChangeEvent> | ChangeEvent) => {
		const detail = getDetail(event);
		if (detail.source === 'user') {
			this.zoom = this.api?.getZoom() ?? this.zoom;
		}
		this.refreshElementTree();
		this.refreshHistory();
	};

	handleSelectionChange = (event: CustomEvent<SelectionChangeEvent> | SelectionChangeEvent) => {
		const detail = getDetail(event);
		this.selection = detail.selectedElements;
		this.multiselect = detail.multiselect;
		const nextIds: string[] = [];
		for (const element of detail.selectedElements) {
			const id = this.elementIdByRef.get(element) ?? element.getAttribute('id');
			if (id && !nextIds.includes(id)) {
				nextIds.push(id);
			}
		}
		this.selectedIds = nextIds;
	};

	handleModeChange = (event: CustomEvent<ModeChangeEvent> | ModeChangeEvent) => {
		const detail = getDetail(event);
		this.mode = normalizeMode(detail.mode);
	};

	handleError = (event: CustomEvent<EditorError> | EditorError) => {
		this.lastError = getDetail(event);
	};

	setMode = (mode: EditorMode) => {
		this.api?.setMode(mode);
		this.mode = normalizeMode(mode);
		if (mode === 'text') {
			this.api?.focusTextInput();
		}
	};

	deleteSelection = () => {
		this.api?.deleteSelection();
	};

	selectAll = () => {
		const rawCanvas = this.api?._unsafe?.rawCanvas?.();
		if (rawCanvas && typeof rawCanvas.selectAllInCurrentLayer === 'function') {
			rawCanvas.selectAllInCurrentLayer();
			this.mode = 'select';
			const selected = rawCanvas.getSelectedElements?.() ?? [];
			this.selection = selected;
			this.multiselect = selected.length > 1;
		}
	};

	clearSelection = () => {
		const rawCanvas = this.api?._unsafe?.rawCanvas?.();
		if (rawCanvas && typeof rawCanvas.clearSelection === 'function') {
			rawCanvas.clearSelection(true);
		}
		this.selection = [];
		this.multiselect = false;
		this.selectedIds = [];
	};

	clear = () => {
		this.api?.clear();
		this.selection = [];
		this.multiselect = false;
		this.selectedIds = [];
		this.refreshElementTree();
		this.refreshHistory();
	};

	newSvg = ({ width, height, unit }: { width: number; height: number; unit: SvgUnit }) => {
		const safeWidth = normalizeDimension(width, DEFAULT_NEW_WIDTH);
		const safeHeight = normalizeDimension(height, DEFAULT_NEW_HEIGHT);
		const svg = createBlankSvg(safeWidth, safeHeight, unit);
		this.api?.loadSvg(svg, { preventUndo: true, center: true });
		this.zoom = this.api?.getZoom() ?? this.zoom;
		this.refreshElementTree();
		this.refreshHistory();
	};

	setFill = (color: string) => {
		this.api?.setFill(color);
	};

	setStroke = (color: string) => {
		this.api?.setStroke(color);
	};

	setStrokeWidth = (value: number) => {
		this.api?.setStrokeWidth(value);
	};

	getFontSize = () => {
		return this.api?.getFontSize() ?? 0;
	};

	setFontSize = (value: number) => {
		if (!Number.isFinite(value)) return;
		this.api?.setFontSize(value);
	};

	getFontFamily = () => {
		return this.api?.getFontFamily() ?? '';
	};

	setFontFamily = (value: string) => {
		if (!value) return;
		this.api?.setFontFamily(value);
	};

	getBold = () => {
		return this.api?.getBold() ?? false;
	};

	setBold = (value: boolean) => {
		this.api?.setBold(value);
	};

	getItalic = () => {
		return this.api?.getItalic() ?? false;
	};

	setItalic = (value: boolean) => {
		this.api?.setItalic(value);
	};

	zoomIn = () => {
		this.api?.zoomIn();
		this.zoom = this.api?.getZoom() ?? this.zoom;
	};

	zoomOut = () => {
		this.api?.zoomOut();
		this.zoom = this.api?.getZoom() ?? this.zoom;
	};

	setZoom = (value: number) => {
		this.api?.setZoom(value);
		this.zoom = this.api?.getZoom() ?? value;
	};

	refreshZoom = () => {
		if (this.api) {
			this.zoom = this.api.getZoom();
		}
	};

	setGridVisible = (show: boolean) => {
		this.api?.setGridVisible(show);
		this.gridVisible = show;
	};

	setGridSnapping = (enabled: boolean) => {
		this.api?.setGridSnapping(enabled);
		this.gridSnapping = enabled;
	};

	setPageBorderSnapping = (enabled: boolean) => {
		this.api?.setPageBorderSnapping(enabled);
		this.pageBorderSnapping = enabled;
	};

	setGridStep = (step: number) => {
		const safeStep = Number.isFinite(step) && step > 0 ? step : this.gridStep;
		this.api?.setSnappingStep(safeStep);
		this.gridStep = safeStep;
	};

	setGridColor = (color: string) => {
		const normalized = normalizeGridColor(color);
		this.api?.setGridColor(normalized);
		this.gridColor = normalized;
	};

	setRulersVisible = (show: boolean) => {
		this.api?.setRulersVisible(show);
		this.rulersVisible = show;
	};

	refreshHistory = () => {
		if (!this.api) {
			this.undoCount = 0;
			this.redoCount = 0;
			this.nextUndoLabel = '';
			this.nextRedoLabel = '';
			return;
		}
		this.undoCount = this.api.getUndoStackSize();
		this.redoCount = this.api.getRedoStackSize();
		this.nextUndoLabel = this.api.getNextUndoCommandText();
		this.nextRedoLabel = this.api.getNextRedoCommandText();
	};

	refreshElementTree = () => {
		if (!this.api) {
			this.elementTree = [];
			this.elementIdByRef.clear();
			return;
		}
		const tree = this.api.getElementTree();
		this.elementIdByRef.clear();
		const applyState = (nodes: ElementTreeNode[]): ElementTreeNode[] =>
			nodes.map((node) => {
				if (node.elementRef) {
					this.elementIdByRef.set(node.elementRef, node.id);
				}
				const isExpanded = !this.collapsedIds.includes(node.id);
				const children = node.children?.length ? applyState(node.children) : [];
				return {
					...node,
					isExpanded,
					children
				};
			});
		this.elementTree = applyState(tree);
	};

	toggleExpanded = (id: string) => {
		if (this.collapsedIds.includes(id)) {
			this.collapsedIds = this.collapsedIds.filter((value) => value !== id);
		} else {
			this.collapsedIds = [...this.collapsedIds, id];
		}
		this.refreshElementTree();
	};

	selectTreeElement = (id: string, opts?: { add?: boolean }) => {
		this.api?.selectElementById(id, opts);
		if (opts?.add) {
			if (!this.selectedIds.includes(id)) {
				this.selectedIds = [...this.selectedIds, id];
			}
		} else {
			this.selectedIds = [id];
		}
	};

	moveTreeElements = (
		ids: string[],
		projection: {
			parentId: string | null;
			mode: 'before' | 'after' | 'inside';
			targetId: string | null;
		}
	) => {
		if (!this.api || ids.length === 0) return;
		if (projection.mode === 'inside') {
			for (const id of ids) {
				this.api.moveElement(id, projection.parentId, { type: 'inside' });
			}
		} else if (projection.mode === 'before') {
			for (const id of ids) {
				this.api.moveElement(id, projection.parentId, {
					type: 'before',
					siblingId: projection.targetId ?? undefined
				});
			}
		} else {
			let anchorId = projection.targetId;
			for (const id of ids) {
				this.api.moveElement(id, projection.parentId, {
					type: 'after',
					siblingId: anchorId ?? undefined
				});
				anchorId = id;
			}
		}
		this.refreshElementTree();
	};

	setElementHidden = (id: string, hidden: boolean) => {
		this.api?.setElementHidden(id, hidden);
		this.refreshElementTree();
	};

	setElementLocked = (id: string, locked: boolean) => {
		this.api?.setElementLocked(id, locked);
		this.refreshElementTree();
	};

	setElementName = (id: string, name: string) => {
		this.api?.setElementName(id, name);
		this.refreshElementTree();
	};

	undo = () => {
		this.api?.undo();
		this.refreshHistory();
	};

	redo = () => {
		this.api?.redo();
		this.refreshHistory();
	};

	copySvgToClipboard = async (): Promise<boolean> => {
		const svg = this.api?.getSvg();
		if (!svg) return false;
		try {
			if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(svg);
				return true;
			}
		} catch (error) {
			console.warn('Failed to copy SVG to clipboard.', error);
		}
		return false;
	};
}

export const createEditorController = () => new EditorController();
