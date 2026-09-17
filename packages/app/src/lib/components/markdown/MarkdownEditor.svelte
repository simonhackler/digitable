<script lang="ts">
	import type { MarkdownFileDocument } from '$lib/collaboration/model';
	import {
		createPresenceRegionAttachment,
		type PresenceCoordinateSpace
	} from '$lib/collaboration/presence-surfaces';
	import { markdownSchemaAdapter } from '$lib/collaboration/markdown/markdown-schema-adapter';
	import { parseMarkdown, serializeMarkdownNode } from '$lib/collaboration/markdown/markdown-codec';
	import * as A from '@automerge/automerge';
	import {
		init,
		pmDocFromSpans,
		type DocHandle as ProseMirrorDocHandle
	} from '@automerge/prosemirror';
	import type { DocHandle } from '@automerge/automerge-repo';
	import { baseKeymap } from 'prosemirror-commands';
	import { history, redo, undo } from 'prosemirror-history';
	import {
		inputRules,
		textblockTypeInputRule,
		wrappingInputRule,
		type InputRule
	} from 'prosemirror-inputrules';
	import { keymap } from 'prosemirror-keymap';
	import { splitListItem } from 'prosemirror-schema-list';
	import { EditorState, type Plugin } from 'prosemirror-state';
	import { EditorView } from 'prosemirror-view';
	import 'prosemirror-view/style/prosemirror.css';

	let {
		handle,
		initialMarkdown = '',
		ariaLabel,
		presenceRegionId = 'markdown-editor',
		presenceSpace = 'box',
		view = $bindable<EditorView | undefined>(),
		state = $bindable<EditorState | undefined>(),
		onchange
	}: {
		handle?: DocHandle<MarkdownFileDocument>;
		initialMarkdown?: string;
		ariaLabel: string;
		presenceRegionId?: string;
		presenceSpace?: PresenceCoordinateSpace;
		view?: EditorView;
		state?: EditorState;
		onchange?: (markdown: string) => void;
	} = $props();
	const presenceRegion = createPresenceRegionAttachment({
		id: () => presenceRegionId,
		space: () => presenceSpace
	});

	function editorInputRules(): Plugin {
		const schema = markdownSchemaAdapter.schema;
		const rules: InputRule[] = [
			wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
			wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
			wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({
				order: Number(match[1])
			})),
			textblockTypeInputRule(/^```$/, schema.nodes.code_block)
		];
		for (let level = 1; level <= 6; level += 1) {
			rules.push(
				textblockTypeInputRule(new RegExp(`^(#{${level}})\\s$`), schema.nodes.heading, {
					level
				})
			);
		}
		return inputRules({ rules });
	}

	function mountEditor(root: HTMLDivElement) {
		const initialized = handle
			? init(handle as unknown as ProseMirrorDocHandle<unknown>, ['content'], {
					schemaAdapter: markdownSchemaAdapter
				})
			: { schema: markdownSchemaAdapter.schema, pmDoc: parseMarkdown(initialMarkdown) };
		const plugins = [
			editorInputRules(),
			history(),
			keymap({
				'Mod-z': undo,
				'Mod-y': redo,
				'Shift-Mod-z': redo,
				Enter: splitListItem(initialized.schema.nodes.list_item)
			}),
			keymap(baseKeymap),
			...('plugin' in initialized ? [initialized.plugin] : [])
		];
		const editor = new EditorView(root, {
			attributes: {
				role: 'textbox',
				'aria-label': ariaLabel,
				'aria-multiline': 'true'
			},
			state: EditorState.create({
				schema: initialized.schema,
				doc: initialized.pmDoc,
				plugins
			}),
			dispatchTransaction(transaction) {
				const next = editor.state.apply(transaction);
				editor.updateState(next);
				state = next;
				if (transaction.docChanged && !handle) onchange?.(serializeMarkdownNode(next.doc));
			}
		});
		view = editor;
		state = editor.state;
		let destroyed = false;
		const recover = () => {
			queueMicrotask(() => {
				if (destroyed || !handle) return;
				const document = handle.doc();
				if (!document) return;
				const expected = pmDocFromSpans(markdownSchemaAdapter, A.spans(document, ['content']));
				if (editor.state.doc.eq(expected)) return;
				const next = EditorState.create({ schema: initialized.schema, doc: expected, plugins });
				editor.updateState(next);
				state = next;
			});
		};
		handle?.on('change', recover);

		return () => {
			destroyed = true;
			handle?.off('change', recover);
			editor.destroy();
			if (view === editor) view = undefined;
		};
	}
</script>

<div
	class="markdown-editor min-h-full outline-none"
	{@attach presenceRegion}
	{@attach mountEditor}
></div>

<style>
	.markdown-editor :global(.ProseMirror) {
		min-height: inherit;
		padding: 1.5rem;
		outline: none;
	}

	.markdown-editor :global(.ProseMirror > * + *) {
		margin-top: 0.75rem;
	}

	.markdown-editor :global(h1) {
		font-size: 2rem;
		font-weight: 700;
		line-height: 2.5rem;
	}

	.markdown-editor :global(h2) {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 2rem;
	}

	.markdown-editor :global(h3) {
		font-size: 1.25rem;
		font-weight: 650;
	}

	.markdown-editor :global(blockquote) {
		border-left: 3px solid hsl(var(--border));
		padding-left: 1rem;
		color: hsl(var(--muted-foreground));
	}

	.markdown-editor :global([data-horizontal-rule]) {
		border-top: 1px solid hsl(var(--border));
	}

	.markdown-editor :global(ul),
	.markdown-editor :global(ol) {
		margin-left: 1.5rem;
	}

	.markdown-editor :global(ul) {
		list-style: disc;
	}

	.markdown-editor :global(ol) {
		list-style: decimal;
	}

	.markdown-editor :global(pre) {
		overflow-x: auto;
		border-radius: 6px;
		background: hsl(var(--muted));
		padding: 1rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	}

	.markdown-editor :global(code) {
		border-radius: 4px;
		background: hsl(var(--muted));
		padding: 0.125rem 0.25rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	}

	.markdown-editor :global(pre code) {
		background: transparent;
		padding: 0;
	}

	.markdown-editor :global(a) {
		color: hsl(var(--primary));
		text-decoration: underline;
	}
</style>
