<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { applyExternalValue } from '../core/applyExternalValue';
	import { createSvgCanvas } from '../core/createSvgCanvas';
	import { normalizeSvg } from '../core/normalizeSvg';
	import type {
		ChangeEvent,
		EditorError,
		ErrorEvent,
		ModeChangeEvent,
		ReadyEvent,
		SelectionChangeEvent,
		SvgCanvasConfig,
		SvgEditorApi
	} from '../core/types';

	type SvgCanvasHostProps = {
		value: string;
		config?: SvgCanvasConfig;
		disabled?: boolean;
		readonly?: boolean;
		centerOnLoad?: boolean;
		initialZoom?: number | 'fit';
		assetBasePath?: string;
		class?: string;
		api?: SvgEditorApi | null;
	};

	let {
		value,
		config,
		disabled = false,
		readonly = false,
		centerOnLoad = true,
		initialZoom,
		assetBasePath,
		class: className = '',
		api = $bindable<SvgEditorApi | null>(null)
	} = $props<SvgCanvasHostProps>();

	const dispatch = createEventDispatcher<{
		ready: ReadyEvent;
		change: ChangeEvent;
		selectionchange: SelectionChangeEvent;
		modechange: ModeChangeEvent;
		error: ErrorEvent;
	}>();

	let workarea: HTMLDivElement | null = null;
	let canvasRoot: HTMLDivElement | null = null;
	let textInput: HTMLInputElement | null = null;
	let rulerFrame: HTMLDivElement | null = null;
	let rulerX: HTMLDivElement | null = null;
	let rulerY: HTMLDivElement | null = null;
	let rulerCorner: HTMLDivElement | null = null;
	let controller: SvgEditorApi | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let lastExternalValue: string | null = null;
	let lastUserValue: string | null = null;
	let suppressChange = false;
	let initialZoomApplied = false;

	const resolvedConfig = $derived.by(() => {
		const base = config ?? {};
		if (assetBasePath && !(base as { imgPath?: string }).imgPath) {
			return { ...base, imgPath: assetBasePath };
		}
		return base;
	});

	const interactionDisabled = $derived(disabled || readonly);

	const emitError = (error: EditorError) => {
		dispatch('error', error);
	};

	const warnMissingAssets = (strict: boolean) => {
		const imgPath = (resolvedConfig as { imgPath?: string } | undefined)?.imgPath;
		if (imgPath) return;

		const error: EditorError = {
			code: 'CONFIG_ERROR',
			message: 'SvgCanvas requires config.imgPath or assetBasePath for assets.'
		};

		if (strict) {
			emitError(error);
			return;
		}

		if (import.meta.env?.DEV) {
			console.warn(error.message);
		}
	};

	onMount(async () => {
		if (!workarea || !canvasRoot || !textInput) return;

		const strictAssets = Boolean((resolvedConfig as { strict?: boolean } | undefined)?.strict);
		warnMissingAssets(strictAssets);

		const normalizedInitial = normalizeSvg(value, resolvedConfig);
		lastExternalValue = normalizedInitial;

		try {
			const { default: SvgCanvas } = await import('@svgedit/svgcanvas');
			suppressChange = true;
			controller = createSvgCanvas({
				container: workarea,
				canvasContainer: canvasRoot,
				textInput,
				value: normalizedInitial,
				config: resolvedConfig,
				centerOnLoad,
				rulers: {
					frame: rulerFrame,
					x: rulerX,
					y: rulerY,
					corner: rulerCorner
				},
				onChange: (svg) => {
					if (suppressChange) return;
					lastUserValue = svg;
					dispatch('change', { svg, source: 'user' });
				},
				onSelectionChange: (payload) => {
					dispatch('selectionchange', payload);
				},
				onModeChange: (mode) => {
					dispatch('modechange', { mode });
				},
				onError: (error) => emitError(error),
				svgCanvasCtor: SvgCanvas
			});
			api = controller;
			dispatch('ready', { api: controller });

			const parseDimension = (value: string | null) => {
				if (!value) return null;
				const num = Number.parseFloat(value);
				if (!Number.isFinite(num) || num <= 0) return null;
				return num;
			};

			const getSvgSize = () => {
				const rawCanvas = controller?._unsafe?.rawCanvas?.() as
					| { getSvgContent?: () => SVGSVGElement | null }
					| undefined;
				const svgContent = rawCanvas?.getSvgContent?.();
				if (!svgContent) return null;

				const viewBox = svgContent.getAttribute('viewBox');
				if (viewBox) {
					const parts = viewBox.split(/[ ,]+/).map((part) => Number(part));
					const width = parts[2];
					const height = parts[3];
					if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
						return { width, height };
					}
				}

				const width = parseDimension(svgContent.getAttribute('width'));
				const height = parseDimension(svgContent.getAttribute('height'));
				if (width && height) return { width, height };

				return null;
			};

			const getFitZoom = () => {
				const size = getSvgSize();
				if (!size) return null;
				const padding = 48;
				const availableWidth = Math.max(1, workarea.clientWidth - padding * 2);
				const availableHeight = Math.max(1, workarea.clientHeight - padding * 2);
				const zoom = Math.min(availableWidth / size.width, availableHeight / size.height);
				if (!Number.isFinite(zoom) || zoom <= 0) return null;
				return Math.min(Math.max(zoom, 0.1), 8);
			};

			const resolveInitialZoom = () => {
				if (initialZoom === 'fit') return getFitZoom();
				if (typeof initialZoom === 'number') return initialZoom;
				return null;
			};

			const applyInitialZoom = () => {
				if (initialZoomApplied) return;
				const nextZoom = resolveInitialZoom();
				if (!nextZoom || !Number.isFinite(nextZoom) || nextZoom <= 0) return;
				initialZoomApplied = true;
				controller?.setZoom(nextZoom);
				controller?.refreshLayout({ center: centerOnLoad });
			};

			if (initialZoom) {
				requestAnimationFrame(() => {
					applyInitialZoom();
				});
			}

			resizeObserver = new ResizeObserver(() => {
				controller?.refreshLayout();
			});
			resizeObserver.observe(workarea);
		} catch (cause) {
			emitError({
				code: 'INIT_FAILED',
				message: 'Failed to initialize SvgCanvas.',
				cause
			});
		} finally {
			suppressChange = false;
		}
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		resizeObserver = null;
		controller?.destroy();
		controller = null;
		api = null;
	});

	$effect(() => {
		if (!controller) return;

		const loadWithSuppression = (svg: string) => {
			suppressChange = true;
			try {
				return controller?.loadSvg(svg, { preventUndo: true, center: centerOnLoad }) ?? false;
			} finally {
				suppressChange = false;
			}
		};

		const { applied, ok, normalizedValue } = applyExternalValue({
			value,
			lastExternalValue,
			lastUserValue,
			normalize: (next) => normalizeSvg(next, resolvedConfig),
			load: loadWithSuppression
		});

		if (!applied) return;

		if (!ok) {
			emitError({
				code: 'LOAD_FAILED',
				message: 'Failed to load SVG content.'
			});
			return;
		}

		lastExternalValue = normalizedValue;
		dispatch('change', { svg: normalizedValue, source: 'external' });
	});
</script>

<div class={`svgcanvas-host ${className}`.trim()} aria-disabled={interactionDisabled}>
	<div class="svgcanvas-frame" bind:this={rulerFrame} data-rulers="false">
		<div class="svgcanvas-ruler svgcanvas-ruler-corner" bind:this={rulerCorner}></div>
		<div class="svgcanvas-ruler svgcanvas-ruler-x" bind:this={rulerX}>
			<div class="svgcanvas-ruler-track">
				<canvas></canvas>
			</div>
		</div>
		<div class="svgcanvas-ruler svgcanvas-ruler-y" bind:this={rulerY}>
			<div class="svgcanvas-ruler-track">
				<canvas></canvas>
			</div>
		</div>
		<div
			class="svgcanvas-workarea"
			bind:this={workarea}
			role="region"
			aria-label="SVG canvas"
			style:pointer-events={interactionDisabled ? 'none' : 'auto'}
		>
			<div class="svgcanvas-canvas" id="svgcanvas" bind:this={canvasRoot}></div>
		</div>
	</div>
	<input
		class="svgcanvas-text-input"
		type="text"
		bind:this={textInput}
		aria-hidden="true"
		tabindex="-1"
	/>
</div>

<style>
	.svgcanvas-host {
		position: relative;
		width: 100%;
		height: 100%;
		display: block;
	}

	.svgcanvas-frame {
		--ruler-size: 0px;
		--ruler-bg: var(--color-muted, #f1f5f9);
		--ruler-fg: var(--color-muted-foreground, #64748b);
		--ruler-border: color-mix(in oklch, var(--ruler-fg) 35%, transparent);
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-columns: var(--ruler-size) minmax(0, 1fr);
		grid-template-rows: var(--ruler-size) minmax(0, 1fr);
	}

	:global(.svgcanvas-frame[data-rulers='true']) {
		--ruler-size: 16px;
	}

	.svgcanvas-ruler {
		background: var(--ruler-bg);
		color: var(--ruler-fg);
		overflow: hidden;
		pointer-events: none;
	}

	.svgcanvas-ruler-corner {
		grid-column: 1;
		grid-row: 1;
		border-right: 1px solid var(--ruler-border);
		border-bottom: 1px solid var(--ruler-border);
	}

	.svgcanvas-ruler-x {
		grid-column: 2;
		grid-row: 1;
		border-bottom: 1px solid var(--ruler-border);
	}

	.svgcanvas-ruler-y {
		grid-column: 1;
		grid-row: 2;
		border-right: 1px solid var(--ruler-border);
	}

	.svgcanvas-ruler-track {
		display: flex;
		flex-direction: row;
	}

	.svgcanvas-ruler-y .svgcanvas-ruler-track {
		flex-direction: column;
	}

	.svgcanvas-ruler-track canvas {
		display: block;
		flex: 0 0 auto;
	}

	.svgcanvas-workarea {
		grid-column: 2;
		grid-row: 2;
		min-width: 0;
		min-height: 0;
		width: 100%;
		height: 100%;
		background: var(--workarea-bg, #1f2a37);
		overflow: auto;
		scrollbar-width: none;
		-ms-overflow-style: none;
		position: relative;
	}

	:global(.svgcanvas-workarea::-webkit-scrollbar) {
		width: 0;
		height: 0;
	}

	.svgcanvas-canvas {
		position: relative;
		display: inline-block;
	}

	.svgcanvas-text-input {
		position: absolute;
		width: 0;
		height: 0;
		opacity: 0;
		pointer-events: none;
	}

	:global(#svgroot) {
		overflow: hidden;
	}
</style>
