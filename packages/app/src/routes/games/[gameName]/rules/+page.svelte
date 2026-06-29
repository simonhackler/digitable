<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		Composer,
		ContentEditable,
		RichTextPlugin,
		HistoryPlugin,
		ListPlugin,
		CheckListPlugin,
		HorizontalRulePlugin,
		OnChangePlugin,
		AutoLinkPlugin,
		LinkPlugin,
		MarkdownShortcutPlugin,
		HR,
		CHECK_LIST,
		LINK,
		CODE,
		ELEMENT_TRANSFORMERS,
		TEXT_FORMAT_TRANSFORMERS,
		HeadingNode,
		QuoteNode,
		ListNode,
		ListItemNode,
		HorizontalRuleNode,
		LinkNode,
		AutoLinkNode,
		CodeNode,
		CodeHighlightNode,
		convertFromMarkdownString,
		convertToMarkdownString,
		type EditorThemeClasses,
		type LexicalEditor
	} from 'svelte-lexical';
	import { getFileSystemContext } from '../../context.js';
	import { requireParam } from '$lib/utils/assert';
	import RulesMarkdownToolbar from './rules-markdown-toolbar.svelte';
	import GameTopBar from '../../game-top-bar.svelte';

	const RULES_FILE = 'rules.md';
	const fileSystem = getFileSystemContext();
	const gameName = requireParam('gameName');

	type RulesLoad = {
		markdown: string;
		error?: string;
	};

	async function loadRules(gameName: string): Promise<RulesLoad> {
		const gameDir = await fileSystem.ensureDir(gameName);
		if (gameDir.error) {
			return { markdown: '', error: gameDir.error.message };
		}

		const rules = await gameDir.data.readText(RULES_FILE);
		if (rules.error) {
			if (rules.error.name === 'NotFoundError') return { markdown: '' };
			return { markdown: '', error: rules.error.message };
		}

		return { markdown: rules.data };
	}

	const loadedRules = await loadRules(gameName);
	const markdownTransformers = [
		HR,
		CHECK_LIST,
		LINK,
		CODE,
		...ELEMENT_TRANSFORMERS,
		...TEXT_FORMAT_TRANSFORMERS
	];
	const editorTheme: EditorThemeClasses = {
		code: 'rules-theme-code',
		heading: {
			h1: 'rules-theme-h1',
			h2: 'rules-theme-h2'
		},
		link: 'rules-theme-link',
		list: {
			checklist: 'rules-theme-checklist',
			listitem: 'rules-theme-listitem',
			listitemChecked: 'rules-theme-listitem-checked',
			listitemUnchecked: 'rules-theme-listitem-unchecked',
			nested: {
				listitem: 'rules-theme-nested-listitem'
			},
			olDepth: ['rules-theme-ol1'],
			ul: 'rules-theme-ul'
		},
		ltr: 'rules-theme-ltr',
		paragraph: 'rules-theme-paragraph',
		quote: 'rules-theme-quote',
		text: {
			bold: 'rules-theme-text-bold',
			code: 'rules-theme-text-code',
			italic: 'rules-theme-text-italic',
			strikethrough: 'rules-theme-text-strikethrough'
		}
	};
	const initialConfig = {
		namespace: `GameRules:${gameName}`,
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
		editorState: () => convertFromMarkdownString(loadedRules.markdown, markdownTransformers)
	};

	let saveState = $state<'saved' | 'saving' | 'error'>('saved');
	let saveError = $state<string | null>(loadedRules.error ?? null);
	let lastSavedAt = $state<Date | null>(null);
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let pendingRules: string | null = null;
	let saveVersion = 0;
	let isWriting = false;

	function scheduleSave(serializedRules: string) {
		pendingRules = serializedRules;
		saveVersion += 1;
		saveState = 'saving';
		saveError = null;

		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			void flushSave();
		}, 600);
	}

	async function flushSave() {
		if (isWriting || pendingRules === null) return;

		isWriting = true;
		const version = saveVersion;
		const serializedRules = pendingRules;
		const gameDir = await fileSystem.ensureDir(gameName);

		if (gameDir.error) {
			saveState = 'error';
			saveError = gameDir.error.message;
			isWriting = false;
			return;
		}

		const written = await gameDir.data.write(RULES_FILE, serializedRules);
		isWriting = false;

		if (written.error) {
			saveState = 'error';
			saveError = written.error.message;
			return;
		}

		if (version === saveVersion) {
			saveState = 'saved';
			lastSavedAt = new Date();
			return;
		}

		void flushSave();
	}

	function onRulesChange(
		editorState: { read: <T>(callback: () => T) => T },
		_editor: LexicalEditor
	) {
		scheduleSave(editorState.read(() => convertToMarkdownString(markdownTransformers)));
	}

	onDestroy(() => {
		if (saveTimer) clearTimeout(saveTimer);
		void flushSave();
	});
</script>

<svelte:head>
	<title>Rules - {gameName}</title>
</svelte:head>

<div class="bg-background flex h-full min-h-screen flex-col">
	<Composer {initialConfig}>
		<GameTopBar
			title="Rules"
			status={saveState === 'saving'
				? 'Saving'
				: lastSavedAt
					? `Saved ${lastSavedAt.toLocaleTimeString()}`
					: 'Saved'}
			statusError={saveError}
		>
			<RulesMarkdownToolbar />
		</GameTopBar>

		<div class="flex-1 overflow-auto px-4 py-4 sm:px-6">
			<div class="editor-shell svelte-lexical rules-editor">
				<div class="editor-container">
					<div class="editor-scroller">
						<div class="editor">
							<ContentEditable ariaLabel="Game rules editor" />
						</div>
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
						onChange={onRulesChange}
						ignoreHistoryMergeTagChange={true}
						ignoreSelectionChange={true}
					/>
				</div>
			</div>
		</div>
	</Composer>
</div>

<style>
	.rules-editor {
		max-width: 980px;
		min-height: calc(100vh - 8rem);
		margin: 0 auto;
		border: 1px solid hsl(var(--border));
		border-radius: 8px;
		background: hsl(var(--background));
	}

	.rules-editor :global(.editor-container) {
		min-height: calc(100vh - 12rem);
	}

	.rules-editor :global(.editor-scroller) {
		min-height: calc(100vh - 15rem);
	}

	.rules-editor :global(.editor) {
		min-height: calc(100vh - 15rem);
	}

	.rules-editor :global(.ContentEditable__root) {
		min-height: calc(100vh - 16rem);
		padding: 1.5rem;
		outline: none;
	}

	.rules-editor :global(.rules-theme-paragraph) {
		margin: 0 0 0.75rem;
	}

	.rules-editor :global(.rules-theme-h1) {
		margin: 0 0 1rem;
		font-size: 1.875rem;
		font-weight: 700;
		line-height: 2.25rem;
	}

	.rules-editor :global(.rules-theme-h2) {
		margin: 1.5rem 0 0.75rem;
		font-size: 1.5rem;
		font-weight: 650;
		line-height: 2rem;
	}

	.rules-editor :global(.rules-theme-ul),
	.rules-editor :global(.rules-theme-ol1) {
		margin: 0 0 0.75rem 1.5rem;
		padding: 0;
	}

	.rules-editor :global(.rules-theme-ul) {
		list-style: disc;
	}

	.rules-editor :global(.rules-theme-ol1) {
		list-style: decimal;
	}

	.rules-editor :global(.rules-theme-listitem) {
		margin: 0.25rem 0;
	}

	.rules-editor :global(.rules-theme-nested-listitem) {
		list-style: none;
	}

	.rules-editor :global(.rules-theme-checklist) {
		margin: 0 0 0.75rem;
		padding: 0;
	}

	.rules-editor :global(.rules-theme-listitem-checked),
	.rules-editor :global(.rules-theme-listitem-unchecked) {
		position: relative;
		margin: 0.25rem 0 0.25rem 1.75rem;
		list-style: none;
	}

	.rules-editor :global(.rules-theme-listitem-checked::before),
	.rules-editor :global(.rules-theme-listitem-unchecked::before) {
		position: absolute;
		left: -1.5rem;
		top: 0.2rem;
		display: inline-flex;
		height: 1rem;
		width: 1rem;
		align-items: center;
		justify-content: center;
		border: 1px solid hsl(var(--border));
		border-radius: 4px;
		font-size: 0.75rem;
		line-height: 1;
		content: '';
	}

	.rules-editor :global(.rules-theme-listitem-checked::before) {
		content: '✓';
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
	}

	.rules-editor :global(.rules-theme-quote) {
		margin: 0 0 0.75rem;
		border-left: 3px solid hsl(var(--border));
		padding-left: 1rem;
		color: hsl(var(--muted-foreground));
	}

	.rules-editor :global(.rules-theme-code) {
		display: block;
		margin: 0 0 0.75rem;
		overflow-x: auto;
		border-radius: 6px;
		background: hsl(var(--muted));
		padding: 0.75rem;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: 0.875rem;
	}

	.rules-editor :global(.rules-theme-link) {
		color: hsl(var(--primary));
		text-decoration: underline;
	}

	.rules-editor :global(.rules-theme-text-bold) {
		font-weight: 700;
	}

	.rules-editor :global(.rules-theme-text-italic) {
		font-style: italic;
	}

	.rules-editor :global(.rules-theme-text-strikethrough) {
		text-decoration: line-through;
	}

	.rules-editor :global(.rules-theme-text-code) {
		border-radius: 4px;
		background: hsl(var(--muted));
		padding: 0.125rem 0.25rem;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: 0.875em;
	}
</style>
