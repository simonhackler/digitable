<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Snippet } from 'svelte';
	import { PressedKeys } from 'runed';
	import type {
		ChangeEvent,
		ChangeSvgEmission,
		ReadyEvent,
		SelectionChangeEvent,
		SvgCanvasConfig,
		SvgEditorApi
	} from '../core/types';
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
		centerOnExternalValueChange?: boolean;
		syncExternalValueUpdates?: boolean;
		emitChangeSvg?: ChangeSvgEmission;
		selectedElementId?: string | null;
		initialZoom?: number | 'fit';
		assetBasePath?: string;
		activePanel?: string;
		api?: SvgEditorApi | null;
		toolbarActions?: () => ReturnType<Snippet>;
		tablePanel?: () => ReturnType<Snippet>;
		componentPanel?: () => ReturnType<Snippet>;
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
		centerOnExternalValueChange = centerOnLoad,
		syncExternalValueUpdates = false,
		emitChangeSvg = true,
		selectedElementId = undefined,
		initialZoom,
		assetBasePath,
		activePanel = $bindable('inspector'),
		api = $bindable(null),
		toolbarActions,
		tablePanel,
		componentPanel,
		imageToolAction,
		selectedImageChangeAction,
		selectedImageHrefApplyAction
	}: ReferenceEditorProps = $props();

	const dispatch = createEventDispatcher<{
		change: ChangeEvent;
		selectionchange: SelectionChangeEvent;
	}>();
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
	const extraTablePanel = $derived(tablePanel as Snippet | undefined);
	const extraComponentPanel = $derived(componentPanel as Snippet | undefined);
	let selectionSyncToken = 0;

	const handleChange = (event: CustomEvent<ChangeEvent>) => {
		dispatch('change', event.detail);
		controller.handleChange(event);
		if (event.detail.source === 'external') scheduleControlledSelection();
	};

	const handleSelectionChange = (event: CustomEvent<SelectionChangeEvent>) => {
		controller.handleSelectionChange(event);
		dispatch('selectionchange', event.detail);
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
		scheduleControlledSelection();
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

	const syncControlledSelection = (targetId: string | null, token: number, attempt = 0) => {
		if (token !== selectionSyncToken) return;
		if (targetId === null) {
			controller.clearSelection();
			return;
		}
		if (!controller.api?.getElementById(targetId)) {
			if (attempt < 4) {
				requestAnimationFrame(() => syncControlledSelection(targetId, token, attempt + 1));
			}
			return;
		}
		controller.selectTreeElement(targetId);
	};

	const scheduleControlledSelection = () => {
		if (selectedElementId === undefined) return;
		if (!controller.isReady) return;
		const targetId = selectedElementId;
		const token = ++selectionSyncToken;
		requestAnimationFrame(() => syncControlledSelection(targetId, token));
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
	onModCombo(['d'], () => runIfModShortcut(() => controller.duplicateSelection()));
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
			if ((key === 'a' || key === 'd' || key === 'n') && !event.shiftKey) {
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
								bind:api
								config={resolvedConfig}
								{disabled}
								{readonly}
								{centerOnLoad}
								{centerOnExternalValueChange}
								{syncExternalValueUpdates}
								{emitChangeSvg}
								{initialZoom}
								{assetBasePath}
								on:ready={handleReady}
								on:change={handleChange}
								on:selectionchange={handleSelectionChange}
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
			<Tabs.Root bind:value={activePanel} class="h-full min-h-0 gap-3">
				<Tabs.List class="w-full">
					<Tabs.Trigger value="inspector">Inspector</Tabs.Trigger>
					<Tabs.Trigger value="structure">Structure</Tabs.Trigger>
					{#if extraTablePanel}
						<Tabs.Trigger value="table">Table</Tabs.Trigger>
					{/if}
					{#if extraComponentPanel}
						<Tabs.Trigger value="component">Component</Tabs.Trigger>
					{/if}
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
				{#if extraTablePanel}
					<Tabs.Content value="table" class="min-h-0 overflow-auto pr-1">
						{@render extraTablePanel()}
					</Tabs.Content>
				{/if}
				{#if extraComponentPanel}
					<Tabs.Content value="component" class="min-h-0 overflow-auto pr-1">
						{@render extraComponentPanel()}
					</Tabs.Content>
				{/if}
			</Tabs.Root>
		</div>
	</div>
</div>
