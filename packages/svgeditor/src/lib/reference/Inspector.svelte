<script lang="ts">
	import type { createEditorController } from '../svelte/createEditorController.svelte.ts';
	import {
		AlignCenter,
		AlignLeft,
		AlignRight,
		Image as ImageIcon,
		Minus,
		Plus
	} from '@lucide/svelte';
	import { Button } from '$svgeditor/components/ui/button/index.js';
	import * as ButtonGroup from '$svgeditor/components/ui/button-group/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$svgeditor/components/ui/card/index.js';
	import { Input } from '$svgeditor/components/ui/input/index.js';
	import { Label } from '$svgeditor/components/ui/label/index.js';

	type EditorController = ReturnType<typeof createEditorController>;

	let {
		controller,
		selectedImageChangeAction,
		selectedImageHrefApplyAction,
		framed = true
	} = $props<{
		controller: EditorController;
		selectedImageChangeAction?: (controller: EditorController) => void | Promise<void>;
		selectedImageHrefApplyAction?: (
			controller: EditorController,
			href: string
		) => void | Promise<void>;
		framed?: boolean;
	}>();

	let posX = $state(111);
	let posY = $state(240);
	let width = $state(178);
	let height = $state(120);
	let rotation = $state(-23);
	let opacity = $state(100);
	let blur = $state(0);
	let roundness = $state(8);
	let strokeWidth = $state(1);
	let strokeDash = $state<'solid' | 'dash' | 'dot'>('solid');
	let fillColor = $state('#ffffff');
	let strokeColor = $state('#000000');
	let fontSize = $state(24);
	let fontBold = $state(false);
	let fontItalic = $state(false);
	let fontUnderline = $state(false);
	let fontFamily = $state('serif');
	let textAnchor = $state<TextAnchor>('start');
	let imageHref = $state('');

	type BBox = { x: number; y: number; width: number; height: number };
	type TextAnchor = 'start' | 'middle' | 'end';

	const fontFamilyOptions = [
		{ label: 'Sans Serif', value: 'sans-serif' },
		{ label: 'Serif', value: 'serif' },
		{ label: 'Monospace', value: 'monospace' },
		{ label: 'Arial', value: 'Arial' },
		{ label: 'Helvetica', value: 'Helvetica' },
		{ label: 'Times New Roman', value: 'Times New Roman' },
		{ label: 'Georgia', value: 'Georgia' },
		{ label: 'Courier New', value: 'Courier New' },
		{ label: 'Verdana', value: 'Verdana' },
		{ label: 'Trebuchet MS', value: 'Trebuchet MS' },
		{ label: 'Tahoma', value: 'Tahoma' },
		{ label: 'Palatino', value: 'Palatino' },
		{ label: 'Garamond', value: 'Garamond' },
		{ label: 'Impact', value: 'Impact' },
		{ label: 'Comic Sans MS', value: 'Comic Sans MS' }
	];

	const clamp = (value: number, min: number, max: number) =>
		Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

	const normalizeHex = (value: string) => {
		let hex = value.trim();
		if (hex.startsWith('#')) hex = hex.slice(1);
		if (/^[0-9a-fA-F]{3}$/.test(hex)) {
			hex = hex
				.split('')
				.map((char) => char + char)
				.join('');
		}
		if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
		return `#${hex.toLowerCase()}`;
	};

	const rgbToHex = (value: string) => {
		const tokens = value.match(/[\d.]+%?/g);
		if (!tokens || tokens.length < 3) return null;
		const channels = tokens.slice(0, 3).map((token) => {
			if (token.endsWith('%')) {
				const percent = Number.parseFloat(token);
				if (!Number.isFinite(percent)) return null;
				return Math.round(clamp((percent / 100) * 255, 0, 255));
			}
			const num = Number.parseFloat(token);
			if (!Number.isFinite(num)) return null;
			return Math.round(clamp(num, 0, 255));
		});
		if (channels.some((channel) => channel === null)) return null;
		return `#${channels.map((channel) => channel!.toString(16).padStart(2, '0')).join('')}`;
	};

	const normalizeColorInput = (value: string | null | undefined, fallback: string) => {
		if (!value) return fallback;
		const trimmed = value.trim();
		if (!trimmed || trimmed === 'none' || trimmed === 'transparent') return fallback;
		if (trimmed.startsWith('url(')) return fallback;
		const hex = normalizeHex(trimmed);
		if (hex) return hex;
		const rgb = rgbToHex(trimmed);
		if (rgb) return rgb;
		return fallback;
	};

	const toNumber = (value: unknown, fallback = 0) => {
		const parsed =
			typeof value === 'number'
				? value
				: typeof value === 'string'
					? Number.parseFloat(value)
					: NaN;
		return Number.isFinite(parsed) ? parsed : fallback;
	};

	const roundTo = (value: number, precision = 2) => {
		const factor = 10 ** precision;
		return Math.round(value * factor) / factor;
	};

	const coerceFontFamilyValue = (value: string) => {
		const trimmed = value.trim();
		if (!trimmed) return trimmed;
		const primary = trimmed.split(',')[0]?.trim() ?? trimmed;
		return primary.replace(/^['"]|['"]$/g, '');
	};

	const normalizeFontFamily = (value: string) => {
		const trimmed = value.trim();
		if (!trimmed) return trimmed;
		const lower = trimmed.toLowerCase();
		const generic = new Set([
			'serif',
			'sans-serif',
			'monospace',
			'cursive',
			'fantasy',
			'system-ui'
		]);
		if (generic.has(lower) || trimmed.includes(',') || /['"]/.test(trimmed)) {
			return trimmed;
		}
		if (trimmed.includes(' ')) return `'${trimmed}'`;
		return trimmed;
	};

	const normalizeTextAnchor = (value: string | null | undefined): TextAnchor | null => {
		if (value === 'start' || value === 'middle' || value === 'end') return value;
		return null;
	};

	const textAlignToAnchor = (value: string | null | undefined): TextAnchor | null => {
		const normalized = value?.trim().toLowerCase();
		if (normalized === 'left' || normalized === 'start') return 'start';
		if (normalized === 'center' || normalized === 'middle') return 'middle';
		if (normalized === 'right' || normalized === 'end') return 'end';
		return null;
	};

	const anchorToTextAlign = (value: TextAnchor) => {
		if (value === 'middle') return 'center';
		if (value === 'end') return 'right';
		return 'left';
	};

	const upsertStyleDeclaration = (
		style: string | null | undefined,
		property: string,
		value: string
	) => {
		const declarations: { property: string; value: string }[] = [];
		for (const declaration of (style ?? '').split(';')) {
			const separatorIndex = declaration.indexOf(':');
			if (separatorIndex === -1) continue;
			const key = declaration.slice(0, separatorIndex).trim();
			const declarationValue = declaration.slice(separatorIndex + 1).trim();
			if (!key || !declarationValue) continue;
			const existing = declarations.find((item) => item.property === key.toLowerCase());
			if (existing) {
				existing.value = declarationValue;
			} else {
				declarations.push({ property: key.toLowerCase(), value: declarationValue });
			}
		}
		const existing = declarations.find((item) => item.property === property);
		if (existing) {
			existing.value = value;
		} else {
			declarations.push({ property, value });
		}
		return declarations.map((item) => `${item.property}:${item.value}`).join(';');
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

	const getOwningTextElement = (element: Element): SVGTextElement | null => {
		const tag = element.tagName.toLowerCase();
		if (tag === 'text') return element as SVGTextElement;
		if (tag === 'tspan' && element.parentElement?.tagName.toLowerCase() === 'text') {
			return element.parentElement as unknown as SVGTextElement;
		}
		return null;
	};

	const uniqueTextRoots = (elements: Element[]) => {
		const roots: SVGTextElement[] = [];
		for (const element of elements) {
			const root = getOwningTextElement(element);
			if (root && !roots.includes(root)) {
				roots.push(root);
			}
		}
		return roots;
	};

	const hasTextFrame = (element: Element) =>
		element.hasAttribute('data-svgedit-wrap-width') ||
		element.hasAttribute('data-svgedit-wrap-height') ||
		element.hasAttribute('data-svgedit-shape-inside-ref') ||
		getStyleDeclaration(element.getAttribute('style'), 'shape-inside') !== null;

	const getSvgTextLineWidth = (line: SVGTSpanElement) => {
		try {
			return line.getComputedTextLength();
		} catch {
			return 0;
		}
	};

	const reflowFramedTextAlignment = (element: Element, value: TextAnchor) => {
		if (element.tagName.toLowerCase() !== 'text') return;
		const text = element as SVGTextElement;
		const frameX = toNumber(text.getAttribute('x'), 0);
		const frameWidth = toNumber(text.getAttribute('data-svgedit-wrap-width'), 0);
		if (frameWidth <= 0) return;
		for (const line of text.querySelectorAll('tspan')) {
			const lineWidth = getSvgTextLineWidth(line);
			const offset =
				value === 'middle'
					? Math.max(0, (frameWidth - lineWidth) / 2)
					: value === 'end'
						? Math.max(0, frameWidth - lineWidth)
						: 0;
			line.setAttribute('x', String(roundTo(frameX + offset, 2)));
		}
	};

	const inferFramedTextAnchor = (element: SVGTextElement): TextAnchor | null => {
		const frameX = toNumber(element.getAttribute('x'), Number.NaN);
		const frameWidth = toNumber(element.getAttribute('data-svgedit-wrap-width'), Number.NaN);
		if (!Number.isFinite(frameX) || !Number.isFinite(frameWidth) || frameWidth <= 0) {
			return null;
		}

		for (const line of element.querySelectorAll('tspan')) {
			const lineX = toNumber(line.getAttribute('x'), Number.NaN);
			if (!Number.isFinite(lineX)) continue;

			const offset = lineX - frameX;
			if (offset <= 1) return 'start';

			const lineWidth = getSvgTextLineWidth(line);
			const availableOffset = Math.max(0, frameWidth - lineWidth);
			if (availableOffset <= 1) return 'start';

			return offset >= availableOffset * 0.75 ? 'end' : 'middle';
		}

		return null;
	};

	const stepFontSize = (current: number, step: number) => {
		if (!Number.isFinite(current)) return current;
		const suggested = current + step;
		const increasing = suggested >= current;
		if (step === 0) return current;
		if (current >= 24) {
			return Math.round(current * (increasing ? 1.1 : 1 / 1.1));
		}
		if (current <= 1) {
			return current * (increasing ? 2 : 0.5);
		}
		return suggested;
	};

	const getRawCanvas = () =>
		controller.api?._unsafe?.rawCanvas?.() as {
			getStrokedBBox?: (elems: Element[]) => BBox | null;
			getRotationAngle?: (elem: Element) => number;
			getOpacity?: () => number;
			getBlur?: (elem: Element) => number | string;
			getFontSize?: () => number;
			getFontFamily?: () => string;
			getBold?: () => boolean;
			getItalic?: () => boolean;
			setOpacity?: (value: number) => void;
			setRotationAngle?: (value: number, preventUndo?: boolean) => void;
			setBlur?: (value: number, complete?: boolean) => void;
			setBlurNoUndo?: (value: number) => void;
			setRectRadius?: (value: number) => void;
			getSelectedElements?: () => Element[];
			moveSelectedElements?: (
				dx: number[] | number,
				dy: number[] | number,
				undoable?: boolean
			) => void;
			changeSelectedAttribute?: (name: string, value: number | string, elems?: Element[]) => void;
			alignSelectedElements?: (type: string, relativeTo: string) => void;
			call?: (event: string, args: unknown[]) => void;
		} | null;

	type RawCanvas = NonNullable<ReturnType<typeof getRawCanvas>>;

	const notifyCanvasChanged = (rawCanvas: RawCanvas, elements?: Element[]) => {
		const changedElements = elements?.length ? elements : (rawCanvas.getSelectedElements?.() ?? []);
		rawCanvas.call?.('changed', changedElements);
	};

	const changeSelectedAttribute = (
		rawCanvas: RawCanvas,
		name: string,
		value: number | string,
		elements?: Element[]
	) => {
		rawCanvas.changeSelectedAttribute?.(name, value, elements);
		notifyCanvasChanged(rawCanvas, elements);
	};

	const selectedElements = $derived.by(() => controller.selection.filter(Boolean));
	const selectionCount = $derived(selectedElements.length);
	const hasSelection = $derived(selectionCount > 0);
	const hasSingleSelection = $derived(selectionCount === 1);
	const selectedElement = $derived.by(() => selectedElements[0] ?? null);
	const textElements = $derived.by(() =>
		selectedElements.filter((element: Element) => {
			const tag = element.tagName.toLowerCase();
			return tag === 'text' || tag === 'tspan';
		})
	);
	const textRootElements = $derived.by(() => uniqueTextRoots(textElements));
	const hasTextSelection = $derived(textRootElements.length > 0);
	const primaryTextElement = $derived.by(() => textRootElements[0] ?? null);
	const canEditSize = $derived.by(() => {
		if (!hasSingleSelection) return false;
		const tag = selectedElement?.tagName.toLowerCase();
		return (
			tag === 'rect' ||
			tag === 'image' ||
			tag === 'svg' ||
			tag === 'foreignobject' ||
			tag === 'use' ||
			tag === 'circle' ||
			tag === 'ellipse' ||
			tag === 'line'
		);
	});
	const canEditRoundness = $derived.by(
		() => hasSingleSelection && selectedElement?.tagName.toLowerCase() === 'rect'
	);
	const canEditRotation = $derived(hasSingleSelection);
	const canEditBlur = $derived(hasSingleSelection);
	const canEditOpacity = $derived(hasSelection);
	const canEditStroke = $derived(hasSelection);
	const canEditText = $derived(hasTextSelection);
	const canEditImage = $derived(
		hasSingleSelection && selectedElement?.tagName.toLowerCase() === 'image'
	);
	const fontFamilyOptionsWithCustom = $derived.by(() => {
		const current = fontFamily.trim();
		if (!current) return fontFamilyOptions;
		const normalizedCurrent = current.replace(/['"]/g, '').toLowerCase();
		const matches = fontFamilyOptions.some(
			(option) => option.value.replace(/['"]/g, '').toLowerCase() === normalizedCurrent
		);
		if (matches) return fontFamilyOptions;
		return [{ label: `Custom: ${current}`, value: current }, ...fontFamilyOptions];
	});

	const mergeBBox = (base: BBox, next: BBox): BBox => {
		const minX = Math.min(base.x, next.x);
		const minY = Math.min(base.y, next.y);
		const maxX = Math.max(base.x + base.width, next.x + next.width);
		const maxY = Math.max(base.y + base.height, next.y + next.height);
		return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
	};

	const getSelectionBBox = (elements: Element[]): BBox | null => {
		if (!elements.length) return null;
		const rawCanvas = getRawCanvas();
		if (rawCanvas?.getStrokedBBox) {
			try {
				const bbox = rawCanvas.getStrokedBBox(elements);
				if (bbox) return bbox;
			} catch {
				// Fallback to manual merge.
			}
		}
		let merged: BBox | null = null;
		for (const element of elements) {
			try {
				const bbox =
					rawCanvas?.getStrokedBBox?.([element]) ??
					(element instanceof SVGGraphicsElement ? element.getBBox() : null);
				if (!bbox) continue;
				const normalized = {
					x: toNumber(bbox.x, 0),
					y: toNumber(bbox.y, 0),
					width: toNumber(bbox.width, 0),
					height: toNumber(bbox.height, 0)
				};
				merged = merged ? mergeBBox(merged, normalized) : normalized;
			} catch {
				continue;
			}
		}
		return merged;
	};

	const getGeometryFromElement = (element: Element, bbox: BBox | null): BBox | null => {
		const tag = element.tagName.toLowerCase();
		const attr = (name: string, fallback = 0) => toNumber(element.getAttribute(name), fallback);

		switch (tag) {
			case 'rect':
			case 'image':
			case 'svg':
			case 'foreignobject':
			case 'use': {
				const x = attr('x', bbox?.x ?? 0);
				const y = attr('y', bbox?.y ?? 0);
				const width = attr('width', bbox?.width ?? 0);
				const height = attr('height', bbox?.height ?? 0);
				return { x, y, width, height };
			}
			case 'circle': {
				const cx = attr('cx', bbox?.x ?? 0);
				const cy = attr('cy', bbox?.y ?? 0);
				const r = attr('r', Math.min(bbox?.width ?? 0, bbox?.height ?? 0) / 2);
				return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
			}
			case 'ellipse': {
				const cx = attr('cx', bbox?.x ?? 0);
				const cy = attr('cy', bbox?.y ?? 0);
				const rx = attr('rx', (bbox?.width ?? 0) / 2);
				const ry = attr('ry', (bbox?.height ?? 0) / 2);
				return { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 };
			}
			case 'line': {
				const x1 = attr('x1', bbox?.x ?? 0);
				const y1 = attr('y1', bbox?.y ?? 0);
				const x2 = attr('x2', (bbox?.x ?? 0) + (bbox?.width ?? 0));
				const y2 = attr('y2', (bbox?.y ?? 0) + (bbox?.height ?? 0));
				const minX = Math.min(x1, x2);
				const minY = Math.min(y1, y2);
				return { x: minX, y: minY, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
			}
			case 'text': {
				const x = attr('x', bbox?.x ?? 0);
				const y = attr('y', bbox?.y ?? 0);
				return {
					x,
					y,
					width: bbox?.width ?? 0,
					height: bbox?.height ?? 0
				};
			}
			default:
				return bbox;
		}
	};

	const dashFromAttr = (value: string | null) => {
		if (!value || value === 'none') return 'solid';
		const normalized = value.replace(/\s+/g, '');
		if (normalized === '5,5') return 'dash';
		if (normalized === '2,2') return 'dot';
		return 'dash';
	};

	const dashToAttr = (value: 'solid' | 'dash' | 'dot') => {
		if (value === 'dash') return '5,5';
		if (value === 'dot') return '2,2';
		return 'none';
	};

	const isImmediateNumberInput = (event: Event) =>
		event instanceof InputEvent && event.inputType === 'insertReplacementText';

	const handleDeferredNumberInput = (event: Event, apply: () => void) => {
		if (isImmediateNumberInput(event)) {
			apply();
		}
	};

	const handleNumberCommit = (event: KeyboardEvent, apply: () => void) => {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		apply();
		const target = event.currentTarget;
		if (target instanceof HTMLInputElement) {
			target.blur();
		}
	};

	const handleNumberBlur = () => {
		syncFromSelection();
	};

	const syncFromSelection = () => {
		if (!controller.isReady || !hasSelection) {
			posX = 0;
			posY = 0;
			width = 0;
			height = 0;
			rotation = 0;
			opacity = 100;
			blur = 0;
			roundness = 0;
			strokeWidth = 0;
			strokeDash = 'solid';
			fillColor = '#ffffff';
			strokeColor = '#000000';
			fontBold = false;
			fontItalic = false;
			fontUnderline = false;
			imageHref = '';
			return;
		}

		const elements = selectedElements;
		const bbox = getSelectionBBox(elements);
		const primary = selectedElement;
		const geometry = hasSingleSelection
			? primary
				? getGeometryFromElement(primary, bbox)
				: bbox
			: bbox;
		if (geometry) {
			posX = roundTo(geometry.x);
			posY = roundTo(geometry.y);
			width = roundTo(geometry.width);
			height = roundTo(geometry.height);
		}

		const rawCanvas = getRawCanvas();
		if (primary && rawCanvas?.getRotationAngle) {
			rotation = roundTo(rawCanvas.getRotationAngle(primary));
		} else {
			rotation = 0;
		}

		if (primary) {
			const computedStyle = typeof window !== 'undefined' ? window.getComputedStyle(primary) : null;
			const fillAttr = primary.getAttribute('fill');
			const strokeAttr = primary.getAttribute('stroke');
			fillColor = normalizeColorInput(
				fillAttr && fillAttr !== 'none' ? fillAttr : computedStyle?.fill,
				'#ffffff'
			);
			strokeColor = normalizeColorInput(
				strokeAttr && strokeAttr !== 'none' ? strokeAttr : computedStyle?.stroke,
				'#000000'
			);

			const opacityAttr = toNumber(primary.getAttribute('opacity'), 1);
			opacity = roundTo(clamp(opacityAttr * 100, 0, 100));
			const blurValue = rawCanvas?.getBlur ? rawCanvas.getBlur(primary) : 0;
			blur = roundTo(toNumber(blurValue, 0));

			if (primary.tagName.toLowerCase() === 'rect') {
				const rx = toNumber(primary.getAttribute('rx'), 0);
				const ry = toNumber(primary.getAttribute('ry'), rx);
				roundness = roundTo(Math.max(rx, ry));
			} else {
				roundness = 0;
			}

			const stroke = primary.getAttribute('stroke');
			const hasStroke = Boolean(stroke && stroke !== 'none');
			const strokeWidthAttr = primary.getAttribute('stroke-width');
			strokeWidth = roundTo(toNumber(strokeWidthAttr, hasStroke && !strokeWidthAttr ? 1 : 0));
			strokeDash = dashFromAttr(primary.getAttribute('stroke-dasharray'));
		}

		if (primaryTextElement) {
			const rawCanvas = getRawCanvas();
			const nextSize = getCurrentFontSize();
			if (typeof nextSize === 'number' && Number.isFinite(nextSize) && nextSize > 0) {
				fontSize = roundTo(nextSize, 2);
			}
			const nextFamily = coerceFontFamilyValue(getCurrentFontFamily());
			if (nextFamily) {
				fontFamily = nextFamily;
			}
			const isBold =
				rawCanvas?.getBold?.() ?? primaryTextElement.getAttribute('font-weight') === 'bold';
			const isItalic =
				rawCanvas?.getItalic?.() ?? primaryTextElement.getAttribute('font-style') === 'italic';
			const underlineAttr = primaryTextElement.getAttribute('text-decoration') ?? '';
			const computedStyle =
				typeof window !== 'undefined' ? window.getComputedStyle(primaryTextElement) : null;
			const underlineComputed =
				computedStyle?.textDecorationLine ?? computedStyle?.textDecoration ?? '';
			const isUnderline =
				underlineAttr.includes('underline') || underlineComputed.includes('underline');
			fontBold = isBold;
			fontItalic = isItalic;
			fontUnderline = isUnderline;
			const explicitTextAlign =
				textAlignToAnchor(
					getStyleDeclaration(primaryTextElement.getAttribute('style'), 'text-align')
				) ?? textAlignToAnchor(primaryTextElement.getAttribute('text-align'));
			const isFramedText = hasTextFrame(primaryTextElement);
			const renderedTextAlign = isFramedText ? inferFramedTextAnchor(primaryTextElement) : null;
			const computedTextAlign = isFramedText ? null : textAlignToAnchor(computedStyle?.textAlign);
			const anchor = normalizeTextAnchor(primaryTextElement.getAttribute('text-anchor'));
			textAnchor = isFramedText
				? (explicitTextAlign ?? renderedTextAlign ?? anchor ?? 'start')
				: (explicitTextAlign ?? anchor ?? computedTextAlign ?? 'start');
		} else {
			fontBold = false;
			fontItalic = false;
			fontUnderline = false;
			textAnchor = 'start';
		}

		if (primary?.tagName.toLowerCase() === 'image') {
			imageHref = getImageHref(primary);
		} else {
			imageHref = '';
		}
	};

	const moveSelectionBy = (dx: number, dy: number) => {
		if (!hasSelection) return;
		const rawCanvas = getRawCanvas();
		if (!rawCanvas?.moveSelectedElements) return;
		const elements = selectedElements;
		const dxs = elements.map(() => dx);
		const dys = elements.map(() => dy);
		rawCanvas.moveSelectedElements(dxs, dys, true);
	};

	const applyPosition = () => {
		if (!hasSelection) return;
		const bbox = getSelectionBBox(selectedElements);
		if (!bbox) return;
		const targetX = toNumber(posX, bbox.x);
		const targetY = toNumber(posY, bbox.y);
		const dx = targetX - bbox.x;
		const dy = targetY - bbox.y;
		if (dx === 0 && dy === 0) return;
		moveSelectionBy(dx, dy);
	};

	const applyWidth = () => {
		if (!canEditSize || !selectedElement) return;
		const rawCanvas = getRawCanvas();
		if (!rawCanvas?.changeSelectedAttribute) return;
		const tag = selectedElement.tagName.toLowerCase();
		const nextWidth = Math.max(0, toNumber(width, 0));

		if (tag === 'circle') {
			changeSelectedAttribute(rawCanvas, 'r', nextWidth / 2);
			return;
		}
		if (tag === 'ellipse') {
			changeSelectedAttribute(rawCanvas, 'rx', nextWidth / 2);
			return;
		}
		if (tag === 'line') {
			const x1 = toNumber(selectedElement.getAttribute('x1'), 0);
			const x2 = toNumber(selectedElement.getAttribute('x2'), 0);
			const minX = Math.min(x1, x2);
			const newMaxX = minX + nextWidth;
			const forward = x2 >= x1;
			const newX1 = forward ? minX : newMaxX;
			const newX2 = forward ? newMaxX : minX;
			rawCanvas.changeSelectedAttribute('x1', newX1);
			rawCanvas.changeSelectedAttribute('x2', newX2);
			notifyCanvasChanged(rawCanvas);
			return;
		}
		changeSelectedAttribute(rawCanvas, 'width', nextWidth);
	};

	const applyHeight = () => {
		if (!canEditSize || !selectedElement) return;
		const rawCanvas = getRawCanvas();
		if (!rawCanvas?.changeSelectedAttribute) return;
		const tag = selectedElement.tagName.toLowerCase();
		const nextHeight = Math.max(0, toNumber(height, 0));

		if (tag === 'circle') {
			changeSelectedAttribute(rawCanvas, 'r', nextHeight / 2);
			return;
		}
		if (tag === 'ellipse') {
			changeSelectedAttribute(rawCanvas, 'ry', nextHeight / 2);
			return;
		}
		if (tag === 'line') {
			const y1 = toNumber(selectedElement.getAttribute('y1'), 0);
			const y2 = toNumber(selectedElement.getAttribute('y2'), 0);
			const minY = Math.min(y1, y2);
			const newMaxY = minY + nextHeight;
			const forward = y2 >= y1;
			const newY1 = forward ? minY : newMaxY;
			const newY2 = forward ? newMaxY : minY;
			rawCanvas.changeSelectedAttribute('y1', newY1);
			rawCanvas.changeSelectedAttribute('y2', newY2);
			notifyCanvasChanged(rawCanvas);
			return;
		}
		changeSelectedAttribute(rawCanvas, 'height', nextHeight);
	};

	const applyRotation = () => {
		if (!canEditRotation || !selectedElement) return;
		const rawCanvas = getRawCanvas();
		if (!rawCanvas?.setRotationAngle) return;
		rawCanvas.setRotationAngle(toNumber(rotation, 0), false);
	};

	const applyOpacity = () => {
		if (!canEditOpacity) return;
		const rawCanvas = getRawCanvas();
		if (!rawCanvas?.setOpacity) return;
		const next = clamp(toNumber(opacity, 100), 0, 100);
		rawCanvas.setOpacity(next / 100);
	};

	const applyBlur = () => {
		if (!canEditBlur || !selectedElement) return;
		const rawCanvas = getRawCanvas();
		if (!rawCanvas?.setBlur) return;
		const next = Math.max(0, toNumber(blur, 0));
		rawCanvas.setBlur(next, true);
	};

	const applyRoundness = () => {
		if (!canEditRoundness || !selectedElement) return;
		const rawCanvas = getRawCanvas();
		if (!rawCanvas?.setRectRadius) return;
		const next = Math.max(0, toNumber(roundness, 0));
		rawCanvas.setRectRadius(next);
	};

	const applyStrokeWidth = () => {
		if (!canEditStroke) return;
		const next = Math.max(0, toNumber(strokeWidth, 0));
		controller.setStrokeWidth(next);
	};

	const applyStrokeDash = () => {
		if (!canEditStroke) return;
		const rawCanvas = getRawCanvas();
		if (!rawCanvas?.changeSelectedAttribute) return;
		changeSelectedAttribute(rawCanvas, 'stroke-dasharray', dashToAttr(strokeDash));
	};

	const applyFillColor = () => {
		if (!hasSelection) return;
		controller.setFill(fillColor);
	};

	const applyStrokeColor = () => {
		if (!canEditStroke) return;
		controller.setStroke(strokeColor);
	};

	const getCurrentFontSize = () => {
		const rawCanvas = getRawCanvas();
		const fromApi = rawCanvas?.getFontSize?.();
		if (Number.isFinite(fromApi)) return fromApi;
		const attr = primaryTextElement?.getAttribute('font-size');
		return toNumber(attr, fontSize);
	};

	const getCurrentFontFamily = () => {
		const rawCanvas = getRawCanvas();
		const fromApi = rawCanvas?.getFontFamily?.();
		if (fromApi) return fromApi;
		const attr = primaryTextElement?.getAttribute('font-family');
		if (attr) return attr;
		if (primaryTextElement) {
			const computed = window.getComputedStyle(primaryTextElement).fontFamily;
			if (computed) return computed;
		}
		return fontFamily;
	};

	const applyFontSize = () => {
		if (!canEditText) return;
		const next = Math.max(1, toNumber(fontSize, getCurrentFontSize()));
		fontSize = roundTo(next, 2);
		controller.setFontSize(fontSize);
	};

	const applyFontFamily = () => {
		if (!canEditText) return;
		const next = normalizeFontFamily(fontFamily);
		if (!next) return;
		controller.setFontFamily(next);
	};

	const applyFontStyle = () => {
		if (!canEditText) return;
		controller.setBold(fontBold);
		controller.setItalic(fontItalic);
	};

	const applyFontUnderline = () => {
		if (!canEditText) return;
		const rawCanvas = getRawCanvas();
		if (!rawCanvas?.changeSelectedAttribute) return;
		changeSelectedAttribute(rawCanvas, 'text-decoration', fontUnderline ? 'underline' : 'none');
	};

	const applyTextAnchor = (value: TextAnchor) => {
		if (!canEditText) return;
		const rawCanvas = getRawCanvas();
		if (!rawCanvas?.changeSelectedAttribute) return;
		textAnchor = value;
		const align = anchorToTextAlign(value);
		const framedTextElements = textRootElements.filter(hasTextFrame);
		const unframedTextElements = textRootElements.filter(
			(element: Element) => !hasTextFrame(element)
		);
		if (framedTextElements.length > 0) {
			rawCanvas.changeSelectedAttribute('text-anchor', 'start', framedTextElements);
			rawCanvas.changeSelectedAttribute('text-align', align, framedTextElements);
		}
		if (unframedTextElements.length > 0) {
			rawCanvas.changeSelectedAttribute('text-anchor', value, unframedTextElements);
		}
		for (const element of framedTextElements) {
			const nextStyle = upsertStyleDeclaration(element.getAttribute('style'), 'text-align', align);
			rawCanvas.changeSelectedAttribute('style', nextStyle, [element]);
			reflowFramedTextAlignment(element, value);
		}
		const changedTextElements = [...framedTextElements, ...unframedTextElements];
		if (changedTextElements.length > 0) {
			notifyCanvasChanged(rawCanvas, changedTextElements);
		}
	};

	const getImageHref = (element: Element) =>
		element.getAttribute('data-digitable-original-href') ??
		element.getAttribute('href') ??
		element.getAttribute('xlink:href') ??
		'';

	const applyImageHref = () => {
		if (!canEditImage || !selectedImageHrefApplyAction) return;
		const nextHref = imageHref.trim();
		if (!nextHref || nextHref === (selectedElement ? getImageHref(selectedElement) : '')) return;
		void selectedImageHrefApplyAction(controller, nextHref);
	};

	const handleImageHrefKeydown = (event: KeyboardEvent) => {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		applyImageHref();
	};

	const toggleBold = () => {
		if (!canEditText) return;
		fontBold = !fontBold;
		applyFontStyle();
	};

	const toggleItalic = () => {
		if (!canEditText) return;
		fontItalic = !fontItalic;
		applyFontStyle();
	};

	const toggleUnderline = () => {
		if (!canEditText) return;
		fontUnderline = !fontUnderline;
		applyFontUnderline();
	};

	const nudgeFontSize = (step: number) => {
		if (!canEditText) return;
		const current = getCurrentFontSize();
		if (typeof current !== 'number' || !Number.isFinite(current)) return;
		const next = Math.max(1, stepFontSize(current, step));
		fontSize = roundTo(next, 2);
		controller.setFontSize(fontSize);
	};

	const alignSelection = (mode: string) => {
		if (!hasSelection) return;
		const rawCanvas = getRawCanvas();
		if (!rawCanvas?.alignSelectedElements) return;
		rawCanvas.alignSelectedElements(mode, 'page');
	};

	$effect(() => {
		void controller.elementTree;
		void controller.selection;
		syncFromSelection();
	});
</script>

<Card class={framed ? undefined : 'border-0 bg-transparent py-0 shadow-none'}>
	{#if framed}
		<CardHeader>
			<CardTitle>Inspector</CardTitle>
		</CardHeader>
	{/if}
	<CardContent class={framed ? 'flex flex-col gap-4' : 'flex flex-col gap-4 px-0'}>
		<div class="grid gap-4">
			<div class="grid grid-cols-2 gap-3">
				<div class="grid gap-1.5">
					<Label for="inspector-x">X</Label>
					<Input
						id="inspector-x"
						type="number"
						bind:value={posX}
						class="text-lg font-semibold"
						disabled={!hasSelection}
						oninput={(event) => handleDeferredNumberInput(event, applyPosition)}
						onkeydown={(event) => handleNumberCommit(event, applyPosition)}
						onblur={handleNumberBlur}
					/>
				</div>
				<div class="grid gap-1.5">
					<Label for="inspector-y">Y</Label>
					<Input
						id="inspector-y"
						type="number"
						bind:value={posY}
						class="text-lg font-semibold"
						disabled={!hasSelection}
						oninput={(event) => handleDeferredNumberInput(event, applyPosition)}
						onkeydown={(event) => handleNumberCommit(event, applyPosition)}
						onblur={handleNumberBlur}
					/>
				</div>
				<div class="grid gap-1.5">
					<Label for="inspector-width">Width</Label>
					<Input
						id="inspector-width"
						type="number"
						bind:value={width}
						class="text-lg font-semibold"
						disabled={!canEditSize}
						oninput={(event) => handleDeferredNumberInput(event, applyWidth)}
						onkeydown={(event) => handleNumberCommit(event, applyWidth)}
						onblur={handleNumberBlur}
					/>
				</div>
				<div class="grid gap-1.5">
					<Label for="inspector-height">Height</Label>
					<Input
						id="inspector-height"
						type="number"
						bind:value={height}
						class="text-lg font-semibold"
						disabled={!canEditSize}
						oninput={(event) => handleDeferredNumberInput(event, applyHeight)}
						onkeydown={(event) => handleNumberCommit(event, applyHeight)}
						onblur={handleNumberBlur}
					/>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="grid gap-1.5">
					<Label for="inspector-rotation">Rotation</Label>
					<input
						id="inspector-rotation"
						type="number"
						class="border-input bg-background ring-offset-background focus-visible:ring-ring h-11 w-full rounded-md border px-3 text-lg font-semibold shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						bind:value={rotation}
						disabled={!canEditRotation}
						oninput={applyRotation}
						onkeydown={(event) => handleNumberCommit(event, applyRotation)}
						onblur={handleNumberBlur}
					/>
					<div class="bg-muted/30 flex h-11 items-center justify-center rounded-lg border">
						<div
							class="bg-background relative flex size-11 items-center justify-center rounded-full border"
							style={`transform: rotate(${rotation}deg);`}
						>
							<span
								class="bg-primary absolute top-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full"
							></span>
							<span
								class="text-foreground text-sm font-semibold"
								style={`transform: rotate(${-rotation}deg);`}
							>
								{rotation}
							</span>
						</div>
					</div>
				</div>
				<div class="grid gap-1.5">
					<Label for="inspector-opacity">Opacity</Label>
					<Input
						id="inspector-opacity"
						type="number"
						min="0"
						max="100"
						bind:value={opacity}
						class="text-lg font-semibold"
						disabled={!canEditOpacity}
						oninput={applyOpacity}
					/>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="grid gap-1.5">
					<Label for="inspector-blur">Blur</Label>
					<Input
						id="inspector-blur"
						type="number"
						min="0"
						step="1"
						bind:value={blur}
						class="text-lg font-semibold"
						disabled={!canEditBlur}
						oninput={applyBlur}
					/>
				</div>
				<div class="grid gap-1.5">
					<Label for="inspector-roundness">Roundness</Label>
					<Input
						id="inspector-roundness"
						type="number"
						min="0"
						step="1"
						bind:value={roundness}
						class="text-lg font-semibold"
						disabled={!canEditRoundness}
						oninput={applyRoundness}
					/>
				</div>
			</div>

			<div class="border-t pt-3">
				<p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
					Align to canvas
				</p>
				<div class="mt-3 grid grid-cols-3 gap-2">
					<Button
						size="icon"
						variant="outline"
						class="h-10 w-10"
						aria-label="Align left"
						disabled={!hasSelection}
						onclick={() => alignSelection('l')}
					>
						<svg viewBox="0 0 24 24" class="size-4">
							<rect x="4" y="4" width="2" height="16" rx="1" fill="currentColor" opacity="0.6" />
							<rect x="8" y="7" width="12" height="10" rx="2" fill="currentColor" />
						</svg>
					</Button>
					<Button
						size="icon"
						variant="outline"
						class="h-10 w-10"
						aria-label="Align center"
						disabled={!hasSelection}
						onclick={() => alignSelection('c')}
					>
						<svg viewBox="0 0 24 24" class="size-4">
							<rect x="11" y="4" width="2" height="16" rx="1" fill="currentColor" opacity="0.6" />
							<rect x="6" y="7" width="12" height="10" rx="2" fill="currentColor" />
						</svg>
					</Button>
					<Button
						size="icon"
						variant="outline"
						class="h-10 w-10"
						aria-label="Align right"
						disabled={!hasSelection}
						onclick={() => alignSelection('r')}
					>
						<svg viewBox="0 0 24 24" class="size-4">
							<rect x="18" y="4" width="2" height="16" rx="1" fill="currentColor" opacity="0.6" />
							<rect x="4" y="7" width="12" height="10" rx="2" fill="currentColor" />
						</svg>
					</Button>
					<Button
						size="icon"
						variant="outline"
						class="h-10 w-10"
						aria-label="Align top"
						disabled={!hasSelection}
						onclick={() => alignSelection('t')}
					>
						<svg viewBox="0 0 24 24" class="size-4">
							<rect x="4" y="4" width="16" height="2" rx="1" fill="currentColor" opacity="0.6" />
							<rect x="7" y="8" width="10" height="12" rx="2" fill="currentColor" />
						</svg>
					</Button>
					<Button
						size="icon"
						variant="outline"
						class="h-10 w-10"
						aria-label="Align middle"
						disabled={!hasSelection}
						onclick={() => alignSelection('m')}
					>
						<svg viewBox="0 0 24 24" class="size-4">
							<rect x="4" y="11" width="16" height="2" rx="1" fill="currentColor" opacity="0.6" />
							<rect x="7" y="4" width="10" height="16" rx="2" fill="currentColor" />
						</svg>
					</Button>
					<Button
						size="icon"
						variant="outline"
						class="h-10 w-10"
						aria-label="Align bottom"
						disabled={!hasSelection}
						onclick={() => alignSelection('b')}
					>
						<svg viewBox="0 0 24 24" class="size-4">
							<rect x="4" y="18" width="16" height="2" rx="1" fill="currentColor" opacity="0.6" />
							<rect x="7" y="4" width="10" height="12" rx="2" fill="currentColor" />
						</svg>
					</Button>
				</div>
			</div>

			{#if canEditText}
				<div class="border-t pt-3">
					<p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Text</p>
					<div class="mt-3 grid gap-3">
						<div class="grid gap-1.5">
							<Label for="inspector-font-family">Family</Label>
							<select
								id="inspector-font-family"
								class="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm font-medium shadow-xs focus-visible:ring-[3px]"
								bind:value={fontFamily}
								disabled={!canEditText}
								onchange={applyFontFamily}
							>
								{#each fontFamilyOptionsWithCustom as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
							<span
								class="text-muted-foreground text-xs"
								style={`font-family: ${normalizeFontFamily(fontFamily)};`}
							>
								Preview: Aa Bb 123
							</span>
						</div>
						<div class="grid gap-1.5">
							<Label for="inspector-font-size">Size</Label>
							<div class="flex items-center gap-2">
								<Button
									size="icon-sm"
									variant="outline"
									class="h-9 w-9"
									aria-label="Decrease font size"
									title="Decrease font size (Ctrl/Cmd+Shift+,)"
									disabled={!canEditText}
									onclick={() => nudgeFontSize(-1)}
								>
									<Minus class="size-4" />
								</Button>
								<Input
									id="inspector-font-size"
									type="number"
									min="1"
									step="1"
									bind:value={fontSize}
									class="text-lg font-semibold"
									disabled={!canEditText}
									oninput={(event) => handleDeferredNumberInput(event, applyFontSize)}
									onkeydown={(event) => handleNumberCommit(event, applyFontSize)}
									onblur={handleNumberBlur}
								/>
								<Button
									size="icon-sm"
									variant="outline"
									class="h-9 w-9"
									aria-label="Increase font size"
									title="Increase font size (Ctrl/Cmd+Shift+.)"
									disabled={!canEditText}
									onclick={() => nudgeFontSize(1)}
								>
									<Plus class="size-4" />
								</Button>
							</div>
						</div>
						<div class="grid gap-1.5">
							<Label>Style</Label>
							<ButtonGroup.Root
								class={framed
									? 'bg-background/70 w-fit items-center gap-1 rounded-md border p-1 shadow-xs'
									: 'w-fit items-center gap-1'}
							>
								<Button
									size="icon-sm"
									variant="ghost"
									class={`rounded-md ${
										fontBold
											? 'bg-primary text-primary-foreground shadow-sm'
											: 'text-muted-foreground hover:text-foreground'
									}`}
									title="Bold (Ctrl/Cmd+B)"
									aria-pressed={fontBold}
									disabled={!canEditText}
									onclick={toggleBold}
								>
									<span class="text-sm font-bold">B</span>
									<span class="sr-only">Bold</span>
								</Button>
								<Button
									size="icon-sm"
									variant="ghost"
									class={`rounded-md ${
										fontItalic
											? 'bg-primary text-primary-foreground shadow-sm'
											: 'text-muted-foreground hover:text-foreground'
									}`}
									title="Italic (Ctrl/Cmd+I)"
									aria-pressed={fontItalic}
									disabled={!canEditText}
									onclick={toggleItalic}
								>
									<span class="text-sm italic">I</span>
									<span class="sr-only">Italic</span>
								</Button>
								<Button
									size="icon-sm"
									variant="ghost"
									class={`rounded-md ${
										fontUnderline
											? 'bg-primary text-primary-foreground shadow-sm'
											: 'text-muted-foreground hover:text-foreground'
									}`}
									title="Underline"
									aria-pressed={fontUnderline}
									disabled={!canEditText}
									onclick={toggleUnderline}
								>
									<span class="text-sm underline">U</span>
									<span class="sr-only">Underline</span>
								</Button>
							</ButtonGroup.Root>
						</div>
						<div class="grid gap-1.5">
							<Label>Align</Label>
							<ButtonGroup.Root
								class={framed
									? 'bg-background/70 w-fit items-center gap-1 rounded-md border p-1 shadow-xs'
									: 'w-fit items-center gap-1'}
							>
								<Button
									size="icon-sm"
									variant="ghost"
									class={`rounded-md ${
										textAnchor === 'start'
											? 'bg-primary text-primary-foreground shadow-sm'
											: 'text-muted-foreground hover:text-foreground'
									}`}
									title="Align text left"
									aria-pressed={textAnchor === 'start'}
									disabled={!canEditText}
									onclick={() => applyTextAnchor('start')}
								>
									<AlignLeft class="size-4" />
									<span class="sr-only">Align text left</span>
								</Button>
								<Button
									size="icon-sm"
									variant="ghost"
									class={`rounded-md ${
										textAnchor === 'middle'
											? 'bg-primary text-primary-foreground shadow-sm'
											: 'text-muted-foreground hover:text-foreground'
									}`}
									title="Align text center"
									aria-pressed={textAnchor === 'middle'}
									disabled={!canEditText}
									onclick={() => applyTextAnchor('middle')}
								>
									<AlignCenter class="size-4" />
									<span class="sr-only">Align text center</span>
								</Button>
								<Button
									size="icon-sm"
									variant="ghost"
									class={`rounded-md ${
										textAnchor === 'end'
											? 'bg-primary text-primary-foreground shadow-sm'
											: 'text-muted-foreground hover:text-foreground'
									}`}
									title="Align text right"
									aria-pressed={textAnchor === 'end'}
									disabled={!canEditText}
									onclick={() => applyTextAnchor('end')}
								>
									<AlignRight class="size-4" />
									<span class="sr-only">Align text right</span>
								</Button>
							</ButtonGroup.Root>
						</div>
					</div>
				</div>
			{/if}

			{#if canEditImage && selectedImageChangeAction}
				<div class="border-t pt-3">
					<p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Image</p>
					<div class="mt-3 grid gap-3">
						<div class="grid gap-1.5">
							<Label for="inspector-image-file">File</Label>
							<Input
								id="inspector-image-file"
								bind:value={imageHref}
								disabled={!selectedImageHrefApplyAction}
								onkeydown={handleImageHrefKeydown}
								onblur={applyImageHref}
							/>
						</div>
						<Button
							size="sm"
							variant="outline"
							class="w-full justify-start"
							onclick={() => void selectedImageChangeAction?.(controller)}
						>
							<ImageIcon class="size-4" />
							Change Image
						</Button>
					</div>
				</div>
			{/if}

			<div class="border-t pt-3">
				<p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Paint</p>
				<div class="mt-3 grid grid-cols-2 gap-3">
					<div class="grid gap-1.5">
						<Label for="inspector-fill-color">Fill</Label>
						<Input
							id="inspector-fill-color"
							type="color"
							class="h-10 w-full p-1"
							bind:value={fillColor}
							disabled={!hasSelection}
							oninput={applyFillColor}
						/>
					</div>
					<div class="grid gap-1.5">
						<Label for="inspector-stroke-color">Stroke</Label>
						<Input
							id="inspector-stroke-color"
							type="color"
							class="h-10 w-full p-1"
							bind:value={strokeColor}
							disabled={!canEditStroke}
							oninput={applyStrokeColor}
						/>
					</div>
				</div>
			</div>

			<div class="border-t pt-3">
				<p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Stroke</p>
				<div class="mt-3 grid grid-cols-2 gap-3">
					<div class="grid gap-1.5">
						<Label for="inspector-stroke-width">Width</Label>
						<Input
							id="inspector-stroke-width"
							type="number"
							min="0"
							step="1"
							bind:value={strokeWidth}
							disabled={!canEditStroke}
							oninput={applyStrokeWidth}
							class="text-lg font-semibold"
						/>
					</div>
					<div class="grid gap-1.5">
						<Label for="inspector-stroke-dash">Dash</Label>
						<select
							id="inspector-stroke-dash"
							class="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm font-medium shadow-xs focus-visible:ring-[3px]"
							bind:value={strokeDash}
							disabled={!canEditStroke}
							onchange={applyStrokeDash}
						>
							<option value="solid">Solid</option>
							<option value="dash">Dash</option>
							<option value="dot">Dot</option>
						</select>
					</div>
				</div>
			</div>
		</div>
	</CardContent>
</Card>
