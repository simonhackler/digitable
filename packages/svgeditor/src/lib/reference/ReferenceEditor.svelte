<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Snippet } from 'svelte';
	import { PressedKeys } from 'runed';
	import type { ChangeEvent, ReadyEvent, SvgCanvasConfig, SvgEditorApi } from '../core/types';
	import { createEditorController } from '../svelte/createEditorController.svelte.ts';
	import SvgCanvasHost from '../svelte/SvgCanvasHost.svelte';
	import Inspector from './Inspector.svelte';
	import StructureTree from './StructureTree.svelte';
	import * as Tabs from '$svgeditor/components/ui/tabs/index.js';
	import Toolbar from './Toolbar.svelte';
	import ZoomControls from './ZoomControls.svelte';

	type ReferenceEditorProps = {
		value: string;
		config?: SvgCanvasConfig;
		disabled?: boolean;
		readonly?: boolean;
		centerOnLoad?: boolean;
		initialZoom?: number | 'fit';
		assetBasePath?: string;
		toolbarActions?: () => ReturnType<Snippet>;
		imageToolAction?: (controller: EditorController) => void | Promise<void>;
		selectedImageChangeAction?: (controller: EditorController) => void | Promise<void>;
		selectedImageHrefApplyAction?: (
			controller: EditorController,
			href: string
		) => void | Promise<void>;
	};

	type EditorController = ReturnType<typeof createEditorController>;

	let {
		value,
		config,
		disabled = false,
		readonly = false,
		centerOnLoad = true,
		initialZoom,
		assetBasePath,
		toolbarActions,
		imageToolAction,
		selectedImageChangeAction,
		selectedImageHrefApplyAction
	}: ReferenceEditorProps = $props();

	const dispatch = createEventDispatcher<{ change: ChangeEvent }>();
	const controller = createEditorController();
	const keys = new PressedKeys();

	const interactionDisabled = $derived(disabled || readonly);
	const resolvedConfig = $derived.by(() => ({
		canvas_expansion: 1,
		show_outside_canvas: false,
		showRulers: true,
		...(config ?? {})
	}));
	const extraActions = $derived(toolbarActions as Snippet | undefined);

	const handleChange = (event: CustomEvent<ChangeEvent>) => {
		dispatch('change', event.detail);
		controller.handleChange(event);
	};

	const shouldExposeE2E = () => {
		if (typeof window === 'undefined') return false;
		return new URLSearchParams(window.location.search).has('e2e');
	};

	const handleReady = (event: CustomEvent<ReadyEvent> | ReadyEvent) => {
		controller.handleReady(event);
		if (shouldExposeE2E()) {
			const global = window as Window & {
				__svgEditorApi?: SvgEditorApi | null;
				__svgEditorController?: EditorController;
			};
			global.__svgEditorApi = controller.api;
			global.__svgEditorController = controller;
		}
	};

	const isEditableTarget = (target: EventTarget | null) => {
		if (!(target instanceof HTMLElement)) return false;
		const tag = target.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
		if (target.isContentEditable) return true;
		return Boolean(target.closest('[contenteditable="true"]'));
	};

	const isEditableActive = () => {
		if (typeof document === 'undefined') return false;
		return isEditableTarget(document.activeElement);
	};

	const isInStructureTree = () => {
		if (typeof document === 'undefined') return false;
		const active = document.activeElement;
		if (!(active instanceof HTMLElement)) return false;
		return Boolean(active.closest('[data-structure-tree]'));
	};

	const canHandleGlobalShortcut = () =>
		!interactionDisabled && controller.isReady && !isEditableActive();

	const isTextMode = () => controller.mode === 'text';

	const canHandleTextFormatting = () => !interactionDisabled && controller.isReady && isTextMode();

	const hasNonShiftModifier = () => keys.has('meta') || keys.has('control') || keys.has('alt');

	const runIfPlainKey = (
		action: () => void,
		{ requireShift = false, allowShift = false, allowInTree = true } = {}
	) => {
		if (!canHandleGlobalShortcut()) return;
		if (!allowInTree && isInStructureTree()) return;
		if (hasNonShiftModifier()) return;
		if (requireShift && !keys.has('shift')) return;
		if (!requireShift && !allowShift && keys.has('shift')) return;
		action();
	};

	const runIfModShortcut = (
		action: () => void,
		{ requireShift = false, allowShift = false } = {}
	) => {
		if (!canHandleGlobalShortcut()) return;
		if (keys.has('alt')) return;
		if (requireShift && !keys.has('shift')) return;
		if (!requireShift && !allowShift && keys.has('shift')) return;
		action();
	};

	const runIfTextShortcut = (action: () => void, { requireShift = false } = {}) => {
		if (!canHandleTextFormatting()) return;
		if (keys.has('alt')) return;
		if (requireShift && !keys.has('shift')) return;
		if (!requireShift && keys.has('shift')) return;
		action();
	};

	const onModCombo = (combo: string[], handler: () => void) => {
		keys.onKeys(['meta', ...combo], handler);
		keys.onKeys(['control', ...combo], handler);
	};

	const nudgeFontSize = (delta: number) => {
		const current = controller.getFontSize();
		const base = Number.isFinite(current) && current > 0 ? current : 1;
		controller.setFontSize(Math.max(1, base + delta));
	};

	const handleImageTool = () => {
		if (imageToolAction) {
			void imageToolAction(controller);
			return;
		}
		controller.setMode('image');
	};

	keys.onKeys('v', () => runIfPlainKey(() => controller.setMode('select'), { allowInTree: false }));
	keys.onKeys('r', () => runIfPlainKey(() => controller.setMode('rect'), { allowInTree: false }));
	keys.onKeys('c', () => runIfPlainKey(() => controller.setMode('circle'), { allowInTree: false }));
	keys.onKeys('e', () =>
		runIfPlainKey(() => controller.setMode('ellipse'), { allowInTree: false })
	);
	keys.onKeys('l', () => runIfPlainKey(() => controller.setMode('line'), { allowInTree: false }));
	keys.onKeys('p', () => runIfPlainKey(() => controller.setMode('path'), { allowInTree: false }));
	keys.onKeys('p', () =>
		runIfPlainKey(() => controller.setMode('fhpath'), { requireShift: true, allowInTree: false })
	);
	keys.onKeys('t', () => runIfPlainKey(() => controller.setMode('text'), { allowInTree: false }));
	keys.onKeys('i', () => runIfPlainKey(handleImageTool, { allowInTree: false }));

	onModCombo(['z'], () =>
		runIfModShortcut(() => {
			if (controller.undoCount > 0) controller.undo();
		})
	);
	onModCombo(['shift', 'z'], () =>
		runIfModShortcut(
			() => {
				if (controller.redoCount > 0) controller.redo();
			},
			{ requireShift: true }
		)
	);
	onModCombo(['y'], () =>
		runIfModShortcut(() => {
			if (controller.redoCount > 0) controller.redo();
		})
	);
	onModCombo(['shift', 'delete'], () =>
		runIfModShortcut(() => controller.clear(), { requireShift: true })
	);
	onModCombo(['shift', 'backspace'], () =>
		runIfModShortcut(() => controller.clear(), { requireShift: true })
	);
	onModCombo(['a'], () => runIfModShortcut(() => controller.selectAll()));
	onModCombo(['='], () => runIfModShortcut(() => controller.zoomIn()));
	onModCombo(['+'], () => runIfModShortcut(() => controller.zoomIn(), { allowShift: true }));
	onModCombo(['-'], () => runIfModShortcut(() => controller.zoomOut()));
	onModCombo(['0'], () => runIfModShortcut(() => controller.setZoom(1)));
	onModCombo(["'"], () =>
		runIfModShortcut(() => controller.setGridVisible(!controller.gridVisible))
	);
	onModCombo(['shift', '"'], () =>
		runIfModShortcut(() => controller.setGridSnapping(!controller.gridSnapping), {
			requireShift: true
		})
	);
	onModCombo(['shift', "'"], () =>
		runIfModShortcut(() => controller.setGridSnapping(!controller.gridSnapping), {
			requireShift: true
		})
	);
	onModCombo([';'], () =>
		runIfModShortcut(() => controller.setRulersVisible(!controller.rulersVisible))
	);
	onModCombo(['n'], () =>
		runIfModShortcut(() => controller.newSvg({ width: 300, height: 150, unit: 'px' }))
	);
	onModCombo(['shift', 'c'], () =>
		runIfModShortcut(
			() => {
				void controller.copySvgToClipboard();
			},
			{ requireShift: true }
		)
	);

	keys.onKeys('delete', () => runIfPlainKey(() => controller.deleteSelection()));
	keys.onKeys('backspace', () => runIfPlainKey(() => controller.deleteSelection()));
	keys.onKeys('escape', () => runIfPlainKey(() => controller.clearSelection()));
	keys.onKeys('enter', () =>
		runIfPlainKey(
			() => {
				if (isTextMode()) {
					controller.api?.focusTextInput();
				}
			},
			{ allowInTree: false }
		)
	);

	onModCombo(['b'], () => runIfTextShortcut(() => controller.setBold(!controller.getBold())));
	onModCombo(['i'], () => runIfTextShortcut(() => controller.setItalic(!controller.getItalic())));
	onModCombo(['shift', '>'], () =>
		runIfTextShortcut(() => nudgeFontSize(1), { requireShift: true })
	);
	onModCombo(['shift', '.'], () =>
		runIfTextShortcut(() => nudgeFontSize(1), { requireShift: true })
	);
	onModCombo(['shift', '<'], () =>
		runIfTextShortcut(() => nudgeFontSize(-1), { requireShift: true })
	);
	onModCombo(['shift', ','], () =>
		runIfTextShortcut(() => nudgeFontSize(-1), { requireShift: true })
	);

	const handleKeydown = (event: KeyboardEvent) => {
		if (interactionDisabled || !controller.isReady) return;
		if (event.defaultPrevented || event.altKey) return;

		const key = event.key.toLowerCase();
		const modKey = event.metaKey || event.ctrlKey;
		const isEditable = isEditableTarget(event.target);
		const isTextFormatting =
			isTextMode() &&
			modKey &&
			(!event.shiftKey
				? key === 'b' || key === 'i'
				: key === '>' || key === '.' || key === '<' || key === ',');

		if (isEditable && !isTextFormatting) return;

		if (modKey) {
			if (key === 'z' || (key === 'y' && !event.shiftKey)) {
				event.preventDefault();
				return;
			}
			if ((key === 'a' || key === 'n') && !event.shiftKey) {
				event.preventDefault();
				return;
			}
			if (key === '0' || key === '+' || key === '-') {
				event.preventDefault();
				return;
			}
			if (key === '=' && !event.shiftKey) {
				event.preventDefault();
				return;
			}
			if (key === 'c' && event.shiftKey) {
				event.preventDefault();
				return;
			}
			if ((key === 'delete' || key === 'backspace') && event.shiftKey) {
				event.preventDefault();
				return;
			}
			if (key === "'" || key === '"') {
				event.preventDefault();
				return;
			}
			if (key === ';' && !event.shiftKey) {
				event.preventDefault();
				return;
			}
			if (isTextFormatting) {
				event.preventDefault();
				return;
			}
		} else {
			if (key === 'delete' || key === 'backspace' || key === 'escape') {
				event.preventDefault();
				return;
			}
			if (key === 'enter' && isTextMode()) {
				event.preventDefault();
			}
		}
	};
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="bg-background flex h-full min-h-0 flex-col overflow-hidden rounded-lg border">
	<div class="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
		<div class="flex min-h-0 min-w-0 flex-col gap-3">
			<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
				<div class="bg-muted/40 px-4 py-3">
					<Toolbar {controller} variant="actions" framed={false} {extraActions} />
				</div>
				<div class="flex min-h-0 flex-1">
					<div class="flex w-12 shrink-0 justify-center py-4">
						<Toolbar
							{controller}
							variant="modes"
							orientation="vertical"
							framed={false}
							{imageToolAction}
						/>
					</div>
					<div class="min-h-0 min-w-0 flex-1">
						<div class="h-full py-4 pr-4">
							<SvgCanvasHost
								{value}
								config={resolvedConfig}
								{disabled}
								{readonly}
								{centerOnLoad}
								{initialZoom}
								{assetBasePath}
								on:ready={handleReady}
								on:change={handleChange}
								on:selectionchange={controller.handleSelectionChange}
								on:modechange={controller.handleModeChange}
								on:error={controller.handleError}
							/>
						</div>
					</div>
				</div>
			</div>
			<div class="flex justify-end">
				<ZoomControls {controller} />
			</div>
		</div>
		<div class="min-h-0 min-w-0">
			<Tabs.Root value="inspector" class="h-full min-h-0 gap-3">
				<Tabs.List class="w-full">
					<Tabs.Trigger value="inspector">Inspector</Tabs.Trigger>
					<Tabs.Trigger value="structure">Structure</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="inspector" class="min-h-0 overflow-auto pr-1">
					<Inspector
						{controller}
						framed={false}
						{selectedImageChangeAction}
						{selectedImageHrefApplyAction}
					/>
				</Tabs.Content>
				<Tabs.Content value="structure" class="min-h-0 overflow-auto pr-1">
					<StructureTree {controller} framed={false} disabled={interactionDisabled} />
				</Tabs.Content>
			</Tabs.Root>
		</div>
	</div>
</div>
