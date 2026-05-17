<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import {
		AutoLinkNode,
		AutoLinkPlugin,
		CHECK_LIST,
		CODE,
		CheckListPlugin,
		CodeHighlightNode,
		CodeNode,
		Composer,
		ContentEditable,
		ELEMENT_TRANSFORMERS,
		HeadingNode,
		HistoryPlugin,
		HorizontalRuleNode,
		HorizontalRulePlugin,
		HR,
		LinkNode,
		LinkPlugin,
		ListItemNode,
		ListNode,
		ListPlugin,
		MarkdownShortcutPlugin,
		OnChangePlugin,
		QuoteNode,
		RichTextPlugin,
		TEXT_FORMAT_TRANSFORMERS,
		Toolbar,
		convertFromMarkdownString,
		convertToMarkdownString,
		formatBulletList,
		formatCheckList,
		formatHeading,
		formatNumberedList,
		formatParagraph,
		formatQuote,
		toggleBold,
		toggleItalic,
		type EditorThemeClasses,
		type LexicalEditor
	} from 'svelte-lexical';
	import BoldIcon from '@lucide/svelte/icons/bold';
	import Heading1Icon from '@lucide/svelte/icons/heading-1';
	import Heading2Icon from '@lucide/svelte/icons/heading-2';
	import ItalicIcon from '@lucide/svelte/icons/italic';
	import ListIcon from '@lucide/svelte/icons/list';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import ListOrderedIcon from '@lucide/svelte/icons/list-ordered';
	import QuoteIcon from '@lucide/svelte/icons/quote';
	import TextIcon from '@lucide/svelte/icons/text';
	import { onMount } from 'svelte';
	import { Err, tryAsync } from 'wellcrafted/result';

	type ToolbarAction = {
		label: string;
		active?: (blockType: string) => boolean;
		onclick: (editor: LexicalEditor, blockType: string) => void;
		icon: typeof TextIcon;
	};

	let {
		open = $bindable(false),
		hasDraft = $bindable(false),
		playtestId
	}: {
		open: boolean;
		hasDraft: boolean;
		playtestId: string;
	} = $props();

	const markdownTransformers = [
		HR,
		CHECK_LIST,
		CODE,
		...ELEMENT_TRANSFORMERS,
		...TEXT_FORMAT_TRANSFORMERS
	];
	const editorTheme: EditorThemeClasses = {
		heading: {
			h1: 'playtest-note-h1',
			h2: 'playtest-note-h2'
		},
		list: {
			checklist: 'playtest-note-checklist',
			listitem: 'playtest-note-listitem',
			listitemChecked: 'playtest-note-listitem-checked',
			listitemUnchecked: 'playtest-note-listitem-unchecked',
			olDepth: ['playtest-note-ol'],
			ul: 'playtest-note-ul'
		},
		paragraph: 'playtest-note-paragraph',
		quote: 'playtest-note-quote',
		text: {
			bold: 'playtest-note-bold',
			italic: 'playtest-note-italic'
		}
	};
	const blockActions: ToolbarAction[] = [
		{
			label: 'Paragraph',
			active: (blockType) => blockType === 'paragraph',
			onclick: (editor) => formatParagraph(editor),
			icon: TextIcon
		},
		{
			label: 'Heading 1',
			active: (blockType) => blockType === 'h1',
			onclick: (editor, blockType) => formatHeading(editor, blockType, 'h1'),
			icon: Heading1Icon
		},
		{
			label: 'Heading 2',
			active: (blockType) => blockType === 'h2',
			onclick: (editor, blockType) => formatHeading(editor, blockType, 'h2'),
			icon: Heading2Icon
		},
		{
			label: 'Bulleted list',
			active: (blockType) => blockType === 'bullet',
			onclick: (editor, blockType) => formatBulletList(editor, blockType),
			icon: ListIcon
		},
		{
			label: 'Numbered list',
			active: (blockType) => blockType === 'number',
			onclick: (editor, blockType) => formatNumberedList(editor, blockType),
			icon: ListOrderedIcon
		},
		{
			label: 'Checklist',
			active: (blockType) => blockType === 'check',
			onclick: (editor, blockType) => formatCheckList(editor, blockType),
			icon: ListChecksIcon
		},
		{
			label: 'Quote',
			active: (blockType) => blockType === 'quote',
			onclick: (editor, blockType) => formatQuote(editor, blockType),
			icon: QuoteIcon
		}
	];

	let markdown = $state('');
	let initialMarkdown = $state('');
	let editorKey = $state(0);
	let submitState = $state<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
	let submitError = $state<string | null>(null);
	const draftStorageKey = $derived(`digitable:playtest-note-draft:${playtestId}`);

	let initialConfig = $derived({
		namespace: `PlaytestFeedback:${playtestId}:${editorKey}`,
		theme: editorTheme,
		nodes: [
			HeadingNode,
			QuoteNode,
			ListNode,
			ListItemNode,
			HorizontalRuleNode,
			LinkNode,
			AutoLinkNode,
			CodeNode,
			CodeHighlightNode
		],
		onError: (error: Error) => {
			throw error;
		},
		...(initialMarkdown.trim()
			? {
					editorState: () => {
						convertFromMarkdownString(initialMarkdown, markdownTransformers);
					}
				}
			: {})
	});

	onMount(() => {
		const savedMarkdown = localStorage.getItem(draftStorageKey) ?? '';
		if (!savedMarkdown) {
			hasDraft = false;
			return;
		}

		markdown = savedMarkdown;
		initialMarkdown = savedMarkdown;
		hasDraft = true;
		editorKey += 1;
	});

	function onNoteChange(editorState: { read: <T>(callback: () => T) => T }) {
		markdown = editorState.read(() => convertToMarkdownString(markdownTransformers));
		initialMarkdown = markdown;
		hasDraft = markdown.trim().length > 0;
		if (hasDraft) {
			localStorage.setItem(draftStorageKey, markdown);
		} else {
			localStorage.removeItem(draftStorageKey);
		}
		if (submitState === 'submitted') {
			submitState = 'idle';
		}
	}

	async function submitNote() {
		if (submitState === 'submitting') return;
		const trimmedMarkdown = markdown.trim();
		if (!trimmedMarkdown) {
			submitState = 'error';
			submitError = 'Write a note before submitting.';
			return;
		}

		submitState = 'submitting';
		submitError = null;

		const submitted = await tryAsync({
			try: async () => {
				const response = await fetch(
					resolve('/api/playtests/[playtestId]/feedback', { playtestId }),
					{
						method: 'POST',
						headers: {
							'content-type': 'application/json'
						},
						body: JSON.stringify({
							markdown: trimmedMarkdown
						})
					}
				);

				if (!response.ok) {
					throw new Error(await response.text());
				}

				return undefined;
			},
			catch: (error) => Err(error instanceof Error ? error : new Error(String(error)))
		});

		if (submitted.error) {
			submitState = 'error';
			submitError = submitted.error.message;
			return;
		}

		submitState = 'submitted';
		markdown = '';
		initialMarkdown = '';
		hasDraft = false;
		localStorage.removeItem(draftStorageKey);
		editorKey += 1;
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content class="w-full sm:max-w-xl">
		<Sheet.Header>
			<Sheet.Title>Playtest Notes</Sheet.Title>
			<Sheet.Description>Submit private feedback for this playtest.</Sheet.Description>
		</Sheet.Header>

		<div class="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
			{#key editorKey}
				<Composer {initialConfig}>
					<div class="note-editor svelte-lexical">
						<Toolbar>
							{#snippet children({ editor, blockType })}
								<div class="note-toolbar">
									{#each blockActions as action (action.label)}
										{@const Icon = action.icon}
										<button
											type="button"
											title={action.label}
											aria-label={action.label}
											class:active={action.active?.(blockType)}
											onclick={() => action.onclick(editor, blockType)}
										>
											<Icon class="size-4" />
										</button>
									{/each}
									<span class="toolbar-divider"></span>
									<button
										type="button"
										title="Bold"
										aria-label="Bold"
										onclick={() => toggleBold(editor)}
									>
										<BoldIcon class="size-4" />
									</button>
									<button
										type="button"
										title="Italic"
										aria-label="Italic"
										onclick={() => toggleItalic(editor)}
									>
										<ItalicIcon class="size-4" />
									</button>
								</div>
							{/snippet}
						</Toolbar>
						<div class="note-editor-container">
							<ContentEditable ariaLabel="Playtest note" />
						</div>
						<RichTextPlugin />
						<HistoryPlugin />
						<ListPlugin />
						<CheckListPlugin />
						<HorizontalRulePlugin />
						<AutoLinkPlugin />
						<LinkPlugin />
						<MarkdownShortcutPlugin transformers={markdownTransformers} />
						<OnChangePlugin
							onChange={onNoteChange}
							ignoreHistoryMergeTagChange={true}
							ignoreSelectionChange={true}
						/>
					</div>
				</Composer>
			{/key}

			<div class="flex items-center justify-between gap-3">
				<p class="text-muted-foreground text-sm" aria-live="polite">
					{#if submitState === 'submitting'}
						Submitting
					{:else if submitState === 'submitted'}
						Submitted
					{:else if submitError}
						<span class="text-destructive">{submitError}</span>
					{/if}
				</p>
				<Button onclick={submitNote} disabled={submitState === 'submitting'}>
					{submitState === 'submitting' ? 'Submitting...' : 'Submit note'}
				</Button>
			</div>
		</div>
	</Sheet.Content>
</Sheet.Root>

<style>
	.note-editor {
		min-height: 22rem;
		overflow: hidden;
		border: 1px solid hsl(var(--border));
		border-radius: 8px;
	}

	.note-toolbar {
		display: flex;
		min-height: 2.5rem;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		border-bottom: 1px solid hsl(var(--border));
		background: hsl(var(--muted) / 0.35);
		padding: 0.375rem 0.5rem;
	}

	.note-toolbar button {
		display: inline-flex;
		height: 2rem;
		width: 2rem;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		color: hsl(var(--muted-foreground));
	}

	.note-toolbar button:hover,
	.note-toolbar button.active {
		background: hsl(var(--accent));
		color: hsl(var(--accent-foreground));
	}

	.toolbar-divider {
		height: 1.5rem;
		width: 1px;
		background: hsl(var(--border));
		margin: 0 0.125rem;
	}

	.note-editor-container {
		min-height: 18rem;
	}

	.note-editor :global(.ContentEditable__root) {
		min-height: 18rem;
		padding: 1rem;
		outline: none;
	}

	.note-editor :global(.playtest-note-paragraph) {
		margin: 0 0 0.75rem;
	}

	.note-editor :global(.playtest-note-h1) {
		margin: 0 0 1rem;
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 2rem;
	}

	.note-editor :global(.playtest-note-h2) {
		margin: 1rem 0 0.75rem;
		font-size: 1.25rem;
		font-weight: 650;
		line-height: 1.75rem;
	}

	.note-editor :global(.playtest-note-ul),
	.note-editor :global(.playtest-note-ol) {
		margin: 0 0 0.75rem 1.5rem;
		padding: 0;
	}

	.note-editor :global(.playtest-note-ul) {
		list-style: disc;
	}

	.note-editor :global(.playtest-note-ol) {
		list-style: decimal;
	}

	.note-editor :global(.playtest-note-listitem) {
		margin: 0.25rem 0;
	}

	.note-editor :global(.playtest-note-quote) {
		border-left: 3px solid hsl(var(--border));
		margin: 0 0 0.75rem;
		padding-left: 0.75rem;
		color: hsl(var(--muted-foreground));
	}

	.note-editor :global(.playtest-note-bold) {
		font-weight: 700;
	}

	.note-editor :global(.playtest-note-italic) {
		font-style: italic;
	}
</style>
