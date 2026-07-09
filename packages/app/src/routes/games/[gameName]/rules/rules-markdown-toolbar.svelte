<script lang="ts">
	import {
		Toolbar,
		formatParagraph,
		formatHeading,
		formatBulletList,
		formatNumberedList,
		formatCheckList,
		formatQuote,
		formatCode,
		toggleBold,
		toggleItalic,
		toggleStrikethrough,
		undo,
		redo,
		type LexicalEditor
	} from 'svelte-lexical';
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

	type ToolbarAction = {
		label: string;
		active?: (blockType: string) => boolean;
		onclick: (editor: LexicalEditor, blockType: string) => void;
		icon: typeof Bold;
	};

	const blockActions: ToolbarAction[] = [
		{
			label: 'Paragraph',
			active: (blockType) => blockType === 'paragraph',
			onclick: (editor) => formatParagraph(editor),
			icon: Text
		},
		{
			label: 'Heading 1',
			active: (blockType) => blockType === 'h1',
			onclick: (editor, blockType) => formatHeading(editor, blockType, 'h1'),
			icon: Heading1
		},
		{
			label: 'Heading 2',
			active: (blockType) => blockType === 'h2',
			onclick: (editor, blockType) => formatHeading(editor, blockType, 'h2'),
			icon: Heading2
		},
		{
			label: 'Bulleted list',
			active: (blockType) => blockType === 'bullet',
			onclick: (editor, blockType) => formatBulletList(editor, blockType),
			icon: List
		},
		{
			label: 'Numbered list',
			active: (blockType) => blockType === 'number',
			onclick: (editor, blockType) => formatNumberedList(editor, blockType),
			icon: ListOrdered
		},
		{
			label: 'Checklist',
			active: (blockType) => blockType === 'check',
			onclick: (editor, blockType) => formatCheckList(editor, blockType),
			icon: ListChecks
		},
		{
			label: 'Quote',
			active: (blockType) => blockType === 'quote',
			onclick: (editor, blockType) => formatQuote(editor, blockType),
			icon: Quote
		},
		{
			label: 'Code block',
			active: (blockType) => blockType === 'code',
			onclick: (editor, blockType) => formatCode(editor, blockType),
			icon: Code
		}
	];

	const inlineActions: ToolbarAction[] = [
		{ label: 'Bold', onclick: (editor) => toggleBold(editor), icon: Bold },
		{ label: 'Italic', onclick: (editor) => toggleItalic(editor), icon: Italic },
		{
			label: 'Strikethrough',
			onclick: (editor) => toggleStrikethrough(editor),
			icon: Strikethrough
		}
	];
</script>

<div class="markdown-toolbar">
	<Toolbar>
		{#snippet children({ editor, blockType })}
			<button type="button" title="Undo" aria-label="Undo" onclick={() => undo(editor)}>
				<Undo2 size={16} />
			</button>
			<button type="button" title="Redo" aria-label="Redo" onclick={() => redo(editor)}>
				<Redo2 size={16} />
			</button>

			<span class="toolbar-divider"></span>

			{#each blockActions as action (action.label)}
				{@const Icon = action.icon}
				<button
					type="button"
					title={action.label}
					aria-label={action.label}
					class:active={action.active?.(blockType)}
					onclick={() => action.onclick(editor, blockType)}
				>
					<Icon size={16} />
				</button>
			{/each}

			<span class="toolbar-divider"></span>

			{#each inlineActions as action (action.label)}
				{@const Icon = action.icon}
				<button
					type="button"
					title={action.label}
					aria-label={action.label}
					onclick={() => action.onclick(editor, blockType)}
				>
					<Icon size={16} />
				</button>
			{/each}
		{/snippet}
	</Toolbar>
</div>

<style>
	.markdown-toolbar :global(.toolbar) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
	}

	.markdown-toolbar :global(.toolbar button) {
		display: inline-flex;
		height: 2rem;
		width: 2rem;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		color: hsl(var(--muted-foreground));
		transition:
			background-color 120ms ease,
			color 120ms ease;
	}

	.markdown-toolbar :global(.toolbar button:hover),
	.markdown-toolbar :global(.toolbar button.active) {
		background: hsl(var(--accent));
		color: hsl(var(--accent-foreground));
	}

	.markdown-toolbar :global(.toolbar button:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}

	.markdown-toolbar :global(.toolbar-divider) {
		height: 1.5rem;
		width: 1px;
		background: hsl(var(--border));
		margin: 0 0.125rem;
	}
</style>
