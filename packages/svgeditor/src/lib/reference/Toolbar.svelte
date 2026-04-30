<script lang="ts">
	import type { EditorMode } from '../core/types';
	import type { createEditorController } from '../svelte/createEditorController.svelte.ts';
	import {
		Circle,
		CircleDot,
		Copy,
		Eraser,
		Grid3x3,
		Image as ImageIcon,
		Minus,
		MousePointer2,
		PenTool,
		Redo2,
		Square,
		Trash2,
		Type as TypeIcon,
		Undo2
	} from '@lucide/svelte';
	import { Button } from '$svgeditor/components/ui/button/index.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$svgeditor/components/ui/dialog/index.js';
	import { Input } from '$svgeditor/components/ui/input/index.js';
	import { Label } from '$svgeditor/components/ui/label/index.js';
	import * as ButtonGroup from '$svgeditor/components/ui/button-group/index.js';
	import {
		Popover,
		PopoverContent,
		PopoverTrigger
	} from '$svgeditor/components/ui/popover/index.js';
	import GridControls from './GridControls.svelte';

	type EditorController = ReturnType<typeof createEditorController>;
	type ToolbarVariant = 'full' | 'modes' | 'actions';
	type ToolbarOrientation = 'horizontal' | 'vertical';

	let {
		controller,
		variant = 'full',
		orientation = 'horizontal'
	} = $props<{
		controller: EditorController;
		variant?: ToolbarVariant;
		orientation?: ToolbarOrientation;
	}>();

	const unitOptions = ['px', 'mm'] as const;
	type UnitOption = (typeof unitOptions)[number];

	let newDialogOpen = $state(false);
	let newWidth = $state(300);
	let newHeight = $state(150);
	let newUnit = $state<UnitOption>('px');
	let copyState = $state<'idle' | 'copied' | 'error'>('idle');
	let copyTimeout: ReturnType<typeof setTimeout> | null = null;

	const modes: { id: EditorMode; label: string; icon: typeof MousePointer2; shortcut: string }[] = [
		{ id: 'select', label: 'Select', icon: MousePointer2, shortcut: 'V' },
		{ id: 'rect', label: 'Rect', icon: Square, shortcut: 'R' },
		{ id: 'circle', label: 'Circle', icon: Circle, shortcut: 'C' },
		{ id: 'ellipse', label: 'Ellipse', icon: CircleDot, shortcut: 'E' },
		{ id: 'line', label: 'Line', icon: Minus, shortcut: 'L' },
		{ id: 'path', label: 'Path', icon: PenTool, shortcut: 'P' },
		{ id: 'text', label: 'Text', icon: TypeIcon, shortcut: 'T' },
		{ id: 'image', label: 'Image', icon: ImageIcon, shortcut: 'I' }
	];

	const handleNewSubmit = (event: Event) => {
		event.preventDefault();
		controller.newSvg({ width: newWidth, height: newHeight, unit: newUnit });
		newDialogOpen = false;
	};

	const handleCopySvg = async () => {
		const ok = await controller.copySvgToClipboard();
		copyState = ok ? 'copied' : 'error';
		if (copyTimeout) {
			clearTimeout(copyTimeout);
		}
		copyTimeout = setTimeout(() => {
			copyState = 'idle';
		}, 1500);
	};

	const canUndo = $derived(controller.isReady && controller.undoCount > 0);
	const canRedo = $derived(controller.isReady && controller.redoCount > 0);
	const undoTooltip = $derived.by(() =>
		controller.nextUndoLabel ? `Undo ${controller.nextUndoLabel} (Ctrl/Cmd+Z)` : 'Undo (Ctrl/Cmd+Z)'
	);
	const redoTooltip = $derived.by(() =>
		controller.nextRedoLabel
			? `Redo ${controller.nextRedoLabel} (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y)`
			: 'Redo (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y)'
	);
	const showModes = $derived(variant === 'full' || variant === 'modes');
	const showActions = $derived(variant === 'full' || variant === 'actions');
	const toolbarClass = $derived.by(() => {
		const base =
			orientation === 'vertical'
				? 'flex flex-col items-center gap-3'
				: 'flex flex-wrap items-center gap-3';
		const distribute = variant === 'full' && orientation !== 'vertical' ? 'justify-between' : '';
		return `${base} ${distribute}`.trim();
	});
	const modeGroupClass = $derived.by(() =>
		orientation === 'vertical'
			? 'items-center gap-1 rounded-xl border bg-background/70 p-1 shadow-sm'
			: 'flex-wrap items-center gap-1 rounded-xl border bg-background/70 p-1 shadow-sm'
	);
</script>

<div class={toolbarClass} role="toolbar" aria-label="Editor tools">
	{#if showModes}
		<ButtonGroup.Root {orientation} class={modeGroupClass}>
			{#each modes as mode (mode.id)}
				<Button
					size="icon-sm"
					variant="ghost"
					class={`rounded-lg ${
						controller.mode === mode.id
							? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-sm'
							: 'text-muted-foreground hover:bg-accent hover:text-foreground'
					}`}
					title={`${mode.label} (${mode.shortcut})`}
					aria-pressed={controller.mode === mode.id}
					onclick={() => controller.setMode(mode.id)}
				>
					<mode.icon class="size-4" />
					<span class="sr-only">{mode.label}</span>
				</Button>
			{/each}
		</ButtonGroup.Root>
	{/if}
	{#if showActions}
		<div class="flex flex-wrap items-center gap-2">
			<ButtonGroup.Root
				class="bg-background/70 flex-wrap items-center gap-1 rounded-xl border p-1 shadow-sm"
			>
				<Button
					size="sm"
					variant="ghost"
					class="rounded-lg px-3 text-xs font-semibold tracking-wide uppercase"
					title={undoTooltip}
					disabled={!canUndo}
					onclick={() => controller.undo()}
				>
					<Undo2 class="size-4" />
					Undo
				</Button>
				<Button
					size="sm"
					variant="ghost"
					class="rounded-lg px-3 text-xs font-semibold tracking-wide uppercase"
					title={redoTooltip}
					disabled={!canRedo}
					onclick={() => controller.redo()}
				>
					<Redo2 class="size-4" />
					Redo
				</Button>
				<Button
					size="sm"
					variant="ghost"
					class="rounded-lg px-3 text-xs font-semibold tracking-wide uppercase"
					disabled={!controller.isReady}
					title="Select all (Ctrl/Cmd+A)"
					onclick={() => controller.selectAll()}
				>
					Select all
				</Button>
				<Button
					size="sm"
					variant="ghost"
					class="rounded-lg px-3 text-xs font-semibold tracking-wide uppercase"
					disabled={!controller.isReady}
					title="New SVG (Ctrl/Cmd+N)"
					onclick={() => (newDialogOpen = true)}
				>
					New
				</Button>
				<Button
					size="sm"
					variant="ghost"
					class="rounded-lg px-3 text-xs font-semibold tracking-wide uppercase"
					disabled={!controller.isReady}
					title="Copy SVG (Ctrl/Cmd+Shift+C)"
					onclick={handleCopySvg}
				>
					<Copy class="size-4" />
					{copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy SVG'}
				</Button>
				<Popover>
					<PopoverTrigger>
						<Button
							size="sm"
							variant="ghost"
							class="rounded-lg px-3 text-xs font-semibold tracking-wide uppercase"
							title="Grid settings (Ctrl/Cmd+')"
						>
							<Grid3x3 class="size-4" />
							Grid
						</Button>
					</PopoverTrigger>
					<PopoverContent align="end" class="w-80 border-none p-0 shadow-none">
						<GridControls {controller} />
					</PopoverContent>
				</Popover>
				<Button
					size="sm"
					variant="ghost"
					class="rounded-lg px-3 text-xs font-semibold tracking-wide uppercase"
					title="Clear canvas (Ctrl/Cmd+Shift+Delete)"
					onclick={() => controller.clear()}
				>
					<Eraser class="size-4" />
					Clear
				</Button>
			</ButtonGroup.Root>
			<Button
				size="sm"
				variant="destructive"
				title="Delete selection (Delete/Backspace)"
				onclick={() => controller.deleteSelection()}
			>
				<Trash2 class="size-4" />
				Delete
			</Button>
		</div>
	{/if}
</div>

<Dialog bind:open={newDialogOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>New SVG</DialogTitle>
			<DialogDescription>Set canvas dimensions in px or mm.</DialogDescription>
		</DialogHeader>
		<form class="grid gap-4" onsubmit={handleNewSubmit}>
			<div class="grid gap-2">
				<Label for="new-svg-width">Width</Label>
				<Input
					id="new-svg-width"
					type="number"
					min="1"
					step={newUnit === 'mm' ? '0.1' : '1'}
					bind:value={newWidth}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="new-svg-height">Height</Label>
				<Input
					id="new-svg-height"
					type="number"
					min="1"
					step={newUnit === 'mm' ? '0.1' : '1'}
					bind:value={newHeight}
				/>
			</div>
			<div class="grid gap-2">
				<Label>Units</Label>
				<div class="flex flex-wrap gap-2">
					{#each unitOptions as unit (unit)}
						<Button
							type="button"
							size="sm"
							variant={newUnit === unit ? 'default' : 'secondary'}
							aria-pressed={newUnit === unit}
							onclick={() => (newUnit = unit)}
						>
							{unit}
						</Button>
					{/each}
				</div>
			</div>
			<DialogFooter>
				<Button type="button" variant="secondary" onclick={() => (newDialogOpen = false)}>
					Cancel
				</Button>
				<Button type="submit">Create</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
