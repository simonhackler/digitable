<script lang="ts">
	import type { ElementTreeNode } from '../core/types';
	import type { createEditorController } from '../svelte/createEditorController.svelte.ts';
	import { Card, CardContent, CardHeader, CardTitle } from '$svgeditor/components/ui/card/index.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import LockIcon from '@lucide/svelte/icons/lock';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import UnlockIcon from '@lucide/svelte/icons/unlock';
	import { cn } from '$svgeditor/utils.js';

	type EditorController = ReturnType<typeof createEditorController>;

	type FlatRow = {
		id: string;
		node: ElementTreeNode;
		parentId: string | null;
		depth: number;
		index: number;
		ancestors: string[];
	};

	type DropMode = 'before' | 'inside' | 'after';

	type Projection = {
		overId: string | null;
		parentId: string | null;
		targetId: string | null;
		depth: number;
		mode: DropMode;
	};

	type DragState = {
		pointerId: number;
		dragIds: string[];
		projection: Projection | null;
		x: number;
		y: number;
	};

	const INDENT = 18;
	const AUTO_SCROLL_EDGE = 28;
	const AUTO_SCROLL_STEP = 12;

	let { controller, disabled = false } = $props<{
		controller: EditorController;
		disabled?: boolean;
	}>();

	let rootEl = $state<HTMLElement | null>(null);
	let drag = $state<DragState | null>(null);
	let editingId = $state<string | null>(null);
	let editingValue = $state('');
	let dragInvalidParents = new Set<string>();

	const flattenVisible = (
		nodes: ElementTreeNode[],
		parentId: string | null = null,
		depth = 0,
		ancestors: string[] = []
	): FlatRow[] => {
		const out: FlatRow[] = [];
		nodes.forEach((node, index) => {
			out.push({
				id: node.id,
				node,
				parentId,
				depth,
				index,
				ancestors
			});
			if (node.isGroup && node.isExpanded && node.children?.length) {
				out.push(...flattenVisible(node.children, node.id, depth + 1, [...ancestors, node.id]));
			}
		});
		return out;
	};

	const selectedIdSet = $derived.by(() => new Set(controller.selectedIds));

	const rows = $derived.by(() => flattenVisible(controller.elementTree));

	const collectDescendants = (nodes: ElementTreeNode[], dragIds: Set<string>) => {
		const invalid = new Set<string>();
		const gather = (node: ElementTreeNode) => {
			if (!node.children?.length) return;
			for (const child of node.children) {
				invalid.add(child.id);
				gather(child);
			}
		};
		const walk = (node: ElementTreeNode) => {
			if (dragIds.has(node.id)) {
				gather(node);
				return;
			}
			if (node.children?.length) {
				node.children.forEach(walk);
			}
		};
		nodes.forEach(walk);
		return invalid;
	};

	const pickOverRow = (rows: FlatRow[], rects: Map<string, DOMRect>, y: number) => {
		for (const row of rows) {
			const rect = rects.get(row.id);
			if (!rect) continue;
			if (y >= rect.top && y <= rect.bottom) return row;
		}
		let best: FlatRow | null = null;
		let bestDistance = Infinity;
		for (const row of rows) {
			const rect = rects.get(row.id);
			if (!rect) continue;
			const center = rect.top + rect.height / 2;
			const distance = Math.abs(y - center);
			if (distance < bestDistance) {
				best = row;
				bestDistance = distance;
			}
		}
		return best;
	};

	const projectDrop = (
		rows: FlatRow[],
		rects: Map<string, DOMRect>,
		dragIds: string[],
		clientX: number,
		clientY: number
	): Projection | null => {
		const dragIdSet = new Set(dragIds);
		const candidates = rows.filter((row) => !dragIdSet.has(row.id));
		if (!candidates.length) {
			return {
				overId: null,
				parentId: null,
				targetId: null,
				depth: 0,
				mode: 'after'
			};
		}

		const over = pickOverRow(candidates, rects, clientY);
		if (!over) return null;

		const rect = rects.get(over.id);
		if (!rect) return null;

		const topBand = rect.top + rect.height * 0.25;
		const bottomBand = rect.bottom - rect.height * 0.25;

		let mode: DropMode;
		if (clientY < topBand) mode = 'before';
		else if (clientY > bottomBand) mode = 'after';
		else mode = over.node.isGroup ? 'inside' : 'after';

		const contentLeft = rect.left + over.depth * INDENT;
		const depthFromRow = over.depth + Math.round((clientX - contentLeft) / INDENT);
		const desiredDepth = Math.max(0, depthFromRow);

		if (mode === 'inside' && over.node.isGroup) {
			return {
				overId: over.id,
				parentId: over.id,
				targetId: over.id,
				depth: over.depth + 1,
				mode
			};
		}

		const depth = Math.min(desiredDepth, over.depth);
		const anchorId = depth === over.depth ? over.id : over.ancestors[depth];
		if (!anchorId) return null;
		const anchor = rows.find((row) => row.id === anchorId);
		if (!anchor) return null;

		const parentId = depth === 0 ? null : (anchor.ancestors[depth - 1] ?? null);
		return {
			overId: over.id,
			parentId,
			targetId: anchor.id,
			depth,
			mode
		};
	};

	const beginDrag = (row: FlatRow, event: PointerEvent) => {
		if (disabled || !controller.isReady) return;
		if (event.button !== 0) return;
		const handle = event.currentTarget as HTMLElement;
		handle.setPointerCapture(event.pointerId);
		const selectedIds = selectedIdSet.has(row.id) ? controller.selectedIds : [row.id];
		const orderedIds = rows.filter((item) => selectedIds.includes(item.id)).map((item) => item.id);
		dragInvalidParents = collectDescendants(controller.elementTree, new Set(orderedIds));
		for (const id of orderedIds) {
			dragInvalidParents.add(id);
		}
		drag = {
			pointerId: event.pointerId,
			dragIds: orderedIds,
			projection: null,
			x: event.clientX,
			y: event.clientY
		};
		event.preventDefault();
	};

	const handlePointerMove = (event: PointerEvent) => {
		if (!drag || event.pointerId !== drag.pointerId || !rootEl) return;
		drag.x = event.clientX;
		drag.y = event.clientY;

		if (rootEl) {
			const rect = rootEl.getBoundingClientRect();
			if (event.clientY < rect.top + AUTO_SCROLL_EDGE) {
				rootEl.scrollTop -= AUTO_SCROLL_STEP;
			} else if (event.clientY > rect.bottom - AUTO_SCROLL_EDGE) {
				rootEl.scrollTop += AUTO_SCROLL_STEP;
			}
		}

		const rects = new Map<string, DOMRect>();
		const rowElements = rootEl.querySelectorAll<HTMLElement>('[data-row-id]');
		rowElements.forEach((el) => {
			const id = el.dataset.rowId;
			if (id) {
				rects.set(id, el.getBoundingClientRect());
			}
		});
		const projection = projectDrop(rows, rects, drag.dragIds, event.clientX, event.clientY);
		if (projection?.parentId && dragInvalidParents.has(projection.parentId)) {
			drag.projection = null;
		} else if (projection?.targetId && dragInvalidParents.has(projection.targetId)) {
			drag.projection = null;
		} else {
			drag.projection = projection;
		}
	};

	const handlePointerEnd = (event: PointerEvent) => {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const projection = drag.projection;
		const draggedIds = drag.dragIds;
		drag = null;
		dragInvalidParents = new Set<string>();
		if (!projection) return;
		controller.moveTreeElements(draggedIds, projection);
	};

	const selectRow = (row: FlatRow, add: boolean) => {
		if (disabled || !controller.isReady) return;
		controller.selectTreeElement(row.id, { add });
	};

	const handleRowClick = (row: FlatRow, event: MouseEvent) => {
		if (editingId === row.id) return;
		const add = event.metaKey || event.ctrlKey;
		selectRow(row, add);
	};

	const handleRowKeydown = (row: FlatRow, event: KeyboardEvent) => {
		if (disabled) return;

		if (event.key === 'Enter') {
			event.preventDefault();
			if (selectedIdSet.has(row.id) && editingId !== row.id) {
				startRename(row);
			} else {
				const add = event.metaKey || event.ctrlKey;
				selectRow(row, add);
			}
			return;
		}

		if (event.key === ' ') {
			event.preventDefault();
			const add = event.metaKey || event.ctrlKey;
			selectRow(row, add);
			return;
		}

		const key = event.key.toLowerCase();
		if (!event.metaKey && !event.ctrlKey && !event.altKey) {
			if (key === 'h') {
				event.preventDefault();
				controller.setElementHidden(row.id, !row.node.isHidden);
				return;
			}

			if (key === 'l') {
				event.preventDefault();
				controller.setElementLocked(row.id, !row.node.isLocked);
				return;
			}
		}

		if (event.altKey && event.key === 'ArrowUp') {
			event.preventDefault();
			moveRowWithinParent(row, -1);
			return;
		}

		if (event.altKey && event.key === 'ArrowDown') {
			event.preventDefault();
			moveRowWithinParent(row, 1);
		}
	};

	const toggleHidden = (row: FlatRow, event: MouseEvent) => {
		event.stopPropagation();
		if (disabled) return;
		controller.setElementHidden(row.id, !row.node.isHidden);
	};

	const toggleLocked = (row: FlatRow, event: MouseEvent) => {
		event.stopPropagation();
		if (disabled) return;
		controller.setElementLocked(row.id, !row.node.isLocked);
	};

	const toggleExpanded = (row: FlatRow, event: MouseEvent) => {
		event.stopPropagation();
		if (disabled) return;
		controller.toggleExpanded(row.id);
	};

	const beginRename = (row: FlatRow, event: MouseEvent) => {
		event.stopPropagation();
		startRename(row);
	};

	const startRename = (row: FlatRow) => {
		if (disabled) return;
		editingId = row.id;
		editingValue = row.node.label;
	};

	const commitRename = (row: FlatRow) => {
		if (!editingId) return;
		const nextName = editingValue.trim();
		if (nextName) {
			controller.setElementName(row.id, nextName);
		}
		editingId = null;
	};

	const cancelRename = () => {
		editingId = null;
	};

	const handleRenameKeydown = (row: FlatRow, event: KeyboardEvent) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitRename(row);
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			cancelRename();
		}
	};

	const moveRowWithinParent = (row: FlatRow, direction: -1 | 1) => {
		if (disabled || !controller.isReady) return;
		const siblings = rows.filter(
			(item) => item.parentId === row.parentId && item.depth === row.depth
		);
		const index = siblings.findIndex((item) => item.id === row.id);
		const nextIndex = index + direction;
		if (index < 0 || nextIndex < 0 || nextIndex >= siblings.length) return;
		const target = siblings[nextIndex];
		controller.moveTreeElements([row.id], {
			parentId: row.parentId,
			targetId: target.id,
			depth: row.depth,
			mode: direction < 0 ? 'before' : 'after',
			overId: target.id
		});
	};

	const getTagBadge = (tagName: string) => {
		const tag = tagName.toLowerCase();
		if (tag === 'rect') return 'R';
		if (tag === 'circle') return 'C';
		if (tag === 'ellipse') return 'E';
		if (tag === 'path') return 'P';
		if (tag === 'line') return 'L';
		if (tag === 'polyline') return 'PL';
		if (tag === 'polygon') return 'PG';
		if (tag === 'text') return 'T';
		if (tag === 'image') return 'I';
		if (tag === 'g') return 'G';
		return tag.slice(0, 2).toUpperCase();
	};
</script>

<Card>
	<CardHeader>
		<CardTitle>Structure</CardTitle>
	</CardHeader>
	<CardContent class="p-0">
		<div
			bind:this={rootEl}
			class="relative max-h-[40vh] overflow-auto px-2 py-2"
			data-structure-tree
			role="region"
			aria-label="Structure tree"
			onpointermove={handlePointerMove}
			onpointerup={handlePointerEnd}
			onpointercancel={handlePointerEnd}
		>
			{#if rows.length === 0}
				<p class="text-muted-foreground px-3 py-2 text-sm">No elements yet.</p>
			{:else}
				{#each rows as row (row.id)}
					<div class="relative" data-row-id={row.id}>
						{#if drag?.projection?.mode === 'before' && drag.projection.targetId === row.id}
							<div
								class="bg-primary pointer-events-none absolute top-0 right-0 left-0 h-0.5 rounded"
								style={`left:${drag.projection.depth * INDENT}px`}
							></div>
						{/if}
						{#if drag?.projection?.mode === 'after' && drag.projection.targetId === row.id}
							<div
								class="bg-primary pointer-events-none absolute right-0 bottom-0 left-0 h-0.5 rounded"
								style={`left:${drag.projection.depth * INDENT}px`}
							></div>
						{/if}
						{#if drag?.projection?.mode === 'inside' && drag.projection.targetId === row.id}
							<div
								class="bg-primary/10 pointer-events-none absolute inset-y-0 right-0 rounded"
								style={`left:${(row.depth + 1) * INDENT}px`}
							></div>
						{/if}

						<div
							role="button"
							tabindex={disabled ? undefined : 0}
							class={cn(
								'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition',
								disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted/60',
								selectedIdSet.has(row.id) && 'bg-muted text-foreground',
								drag?.dragIds?.includes(row.id) && 'opacity-40'
							)}
							style={`padding-left:${row.depth * INDENT}px`}
							onclick={(event) => handleRowClick(row, event)}
							onkeydown={(event) => handleRowKeydown(row, event)}
						>
							{#if row.node.isGroup}
								<button
									type="button"
									class="text-muted-foreground"
									aria-label={row.node.isExpanded ? 'Collapse group' : 'Expand group'}
									onclick={(event) => toggleExpanded(row, event)}
								>
									{#if row.node.isExpanded}
										<ChevronDownIcon class="size-4" />
									{:else}
										<ChevronRightIcon class="size-4" />
									{/if}
								</button>
							{:else}
								<span class="w-4"></span>
							{/if}

							<button
								type="button"
								class="text-muted-foreground"
								aria-label="Drag element"
								title="Drag element (Alt+Up/Down)"
								onpointerdown={(event) => beginDrag(row, event)}
								onclick={(event) => event.stopPropagation()}
							>
								<GripVerticalIcon class="size-4" />
							</button>

							<span
								class="bg-muted text-muted-foreground inline-flex min-w-[18px] items-center justify-center rounded px-1 text-[10px] font-semibold"
								title={row.node.tagName}
							>
								{getTagBadge(row.node.tagName)}
							</span>

							{#if editingId === row.id}
								<input
									type="text"
									class="bg-background h-7 w-full max-w-[140px] rounded border px-2 text-sm"
									value={editingValue}
									oninput={(event) => (editingValue = event.currentTarget.value)}
									onclick={(event) => event.stopPropagation()}
									onkeydown={(event) => handleRenameKeydown(row, event)}
									onblur={() => commitRename(row)}
								/>
							{:else}
								<span class="truncate">{row.node.label}</span>
							{/if}

							<span class="text-muted-foreground ml-auto flex items-center gap-2">
								<button
									type="button"
									aria-label="Rename element"
									class="hover:text-foreground"
									title="Rename element (Enter)"
									onclick={(event) => beginRename(row, event)}
									{disabled}
								>
									<PencilIcon class="size-4" />
								</button>
								<button
									type="button"
									aria-label={row.node.isHidden ? 'Show element' : 'Hide element'}
									class="hover:text-foreground"
									title={row.node.isHidden ? 'Show element (H)' : 'Hide element (H)'}
									onclick={(event) => toggleHidden(row, event)}
								>
									{#if row.node.isHidden}
										<EyeOffIcon class="size-4" />
									{:else}
										<EyeIcon class="size-4" />
									{/if}
								</button>
								<button
									type="button"
									aria-label={row.node.isLocked ? 'Unlock element' : 'Lock element'}
									class="hover:text-foreground"
									title={row.node.isLocked ? 'Unlock element (L)' : 'Lock element (L)'}
									onclick={(event) => toggleLocked(row, event)}
								>
									{#if row.node.isLocked}
										<LockIcon class="size-4" />
									{:else}
										<UnlockIcon class="size-4" />
									{/if}
								</button>
							</span>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</CardContent>
</Card>
