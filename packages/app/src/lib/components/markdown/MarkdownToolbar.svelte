<script lang="ts">
	import {
		Bold,
		Code,
		Heading1,
		Heading2,
		Italic,
		List,
		ListChecks,
		ListOrdered,
		Quote,
		Redo2,
		Strikethrough,
		Text,
		Undo2
	} from '@lucide/svelte';
	import { setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
	import { redo, undo } from 'prosemirror-history';
	import { liftListItem, wrapInList } from 'prosemirror-schema-list';
	import type { Command, EditorState } from 'prosemirror-state';
	import type { EditorView } from 'prosemirror-view';

	let {
		view,
		state,
		readonly = false
	}: { view?: EditorView; state?: EditorState; readonly?: boolean } = $props();

	function run(command: Command) {
		if (!view || readonly) return;
		command(view.state, view.dispatch, view);
		view.focus();
	}

	function activeNode(name: string, attrs?: Record<string, unknown>): boolean {
		if (!state) return false;
		for (let depth = state.selection.$from.depth; depth >= 0; depth -= 1) {
			const node = state.selection.$from.node(depth);
			if (node.type.name !== name) continue;
			return !attrs || Object.entries(attrs).every(([key, value]) => node.attrs[key] === value);
		}
		return false;
	}

	function activeMark(name: string): boolean {
		if (!state) return false;
		const mark = state.schema.marks[name];
		if (!mark) return false;
		const { from, to, empty } = state.selection;
		return empty
			? Boolean(mark.isInSet(state.storedMarks ?? state.selection.$from.marks()))
			: state.doc.rangeHasMark(from, to, mark);
	}

	function toggleList(name: 'bullet_list' | 'ordered_list') {
		if (!state) return;
		if (activeNode(name)) {
			run(liftListItem(state.schema.nodes.list_item));
			return;
		}
		run(wrapInList(state.schema.nodes[name]));
	}

	function toggleChecklist() {
		if (!view || readonly) return;
		if (!activeNode('bullet_list')) run(wrapInList(view.state.schema.nodes.bullet_list));
		const current = view.state;
		let paragraphDepth = current.selection.$from.depth;
		while (
			paragraphDepth > 0 &&
			current.selection.$from.node(paragraphDepth).type !== current.schema.nodes.paragraph
		) {
			paragraphDepth -= 1;
		}
		if (paragraphDepth === 0) return;
		const paragraph = current.selection.$from.node(paragraphDepth);
		const start = current.selection.$from.start(paragraphDepth);
		const prefix = /^\[[ xX]\]\s/.exec(paragraph.textContent)?.[0];
		view.dispatch(
			prefix
				? current.tr.delete(start, start + prefix.length)
				: current.tr.insertText('[ ] ', start)
		);
		view.focus();
	}
</script>

<fieldset class="contents" disabled={readonly}>
	<div
		class="flex flex-wrap items-center gap-1"
		role="toolbar"
		aria-label="Markdown editor toolbar"
	>
		<button type="button" title="Undo" aria-label="Undo" onclick={() => run(undo)}
			><Undo2 size={16} /></button
		>
		<button type="button" title="Redo" aria-label="Redo" onclick={() => run(redo)}
			><Redo2 size={16} /></button
		>
		<span class="toolbar-divider"></span>
		<button
			class:active={activeNode('paragraph')}
			type="button"
			aria-label="Paragraph"
			title="Paragraph"
			onclick={() => state && run(setBlockType(state.schema.nodes.paragraph))}
			><Text size={16} /></button
		>
		<button
			class:active={activeNode('heading', { level: 1 })}
			type="button"
			aria-label="Heading 1"
			title="Heading 1"
			onclick={() => state && run(setBlockType(state.schema.nodes.heading, { level: 1 }))}
			><Heading1 size={16} /></button
		>
		<button
			class:active={activeNode('heading', { level: 2 })}
			type="button"
			aria-label="Heading 2"
			title="Heading 2"
			onclick={() => state && run(setBlockType(state.schema.nodes.heading, { level: 2 }))}
			><Heading2 size={16} /></button
		>
		<button
			class:active={activeNode('bullet_list')}
			type="button"
			aria-label="Bulleted list"
			title="Bulleted list"
			onclick={() => toggleList('bullet_list')}><List size={16} /></button
		>
		<button
			class:active={activeNode('ordered_list')}
			type="button"
			aria-label="Numbered list"
			title="Numbered list"
			onclick={() => toggleList('ordered_list')}><ListOrdered size={16} /></button
		>
		<button type="button" aria-label="Checklist" title="Checklist" onclick={toggleChecklist}
			><ListChecks size={16} /></button
		>
		<button
			class:active={activeNode('blockquote')}
			type="button"
			aria-label="Quote"
			title="Quote"
			onclick={() => state && run(wrapIn(state.schema.nodes.blockquote))}
			><Quote size={16} /></button
		>
		<button
			class:active={activeNode('code_block')}
			type="button"
			aria-label="Code block"
			title="Code block"
			onclick={() => state && run(setBlockType(state.schema.nodes.code_block))}
			><Code size={16} /></button
		>
		<span class="toolbar-divider"></span>
		<button
			class:active={activeMark('strong')}
			type="button"
			aria-label="Bold"
			title="Bold"
			onclick={() => state && run(toggleMark(state.schema.marks.strong))}><Bold size={16} /></button
		>
		<button
			class:active={activeMark('em')}
			type="button"
			aria-label="Italic"
			title="Italic"
			onclick={() => state && run(toggleMark(state.schema.marks.em))}><Italic size={16} /></button
		>
		<button
			class:active={activeMark('strike')}
			type="button"
			aria-label="Strikethrough"
			title="Strikethrough"
			onclick={() => state && run(toggleMark(state.schema.marks.strike))}
			><Strikethrough size={16} /></button
		>
	</div>
</fieldset>

<style>
	button {
		display: inline-flex;
		height: 2rem;
		width: 2rem;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		color: hsl(var(--muted-foreground));
	}

	button:hover,
	button.active {
		background: hsl(var(--accent));
		color: hsl(var(--accent-foreground));
	}

	button:focus-visible {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}

	.toolbar-divider {
		height: 1.5rem;
		width: 1px;
		margin: 0 0.125rem;
		background: hsl(var(--border));
	}
</style>
