<script lang="ts">
	import { resolve } from '$app/paths';
	import MarkdownEditor from '$lib/components/markdown/MarkdownEditor.svelte';
	import MarkdownToolbar from '$lib/components/markdown/MarkdownToolbar.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import type { EditorState } from 'prosemirror-state';
	import type { EditorView } from 'prosemirror-view';
	import { onMount } from 'svelte';
	import { Err, tryAsync } from 'wellcrafted/result';

	let {
		open = $bindable(false),
		hasDraft = $bindable(false),
		playtestId
	}: {
		open: boolean;
		hasDraft: boolean;
		playtestId: string;
	} = $props();

	let markdown = $state('');
	let initialMarkdown = $state('');
	let editorKey = $state(0);
	let view = $state<EditorView>();
	let editorState = $state<EditorState>();
	let submitState = $state<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
	let submitError = $state<string | null>(null);
	const draftStorageKey = $derived(`digitable:playtest-note-draft:${playtestId}`);

	onMount(() => {
		const saved = localStorage.getItem(draftStorageKey) ?? '';
		if (!saved) {
			hasDraft = false;
			return;
		}
		markdown = saved;
		initialMarkdown = saved;
		hasDraft = true;
		editorKey += 1;
	});

	function onNoteChange(value: string) {
		markdown = value;
		hasDraft = markdown.trim().length > 0;
		if (hasDraft) localStorage.setItem(draftStorageKey, markdown);
		if (!hasDraft) localStorage.removeItem(draftStorageKey);
		if (submitState === 'submitted') submitState = 'idle';
	}

	async function submitNote() {
		if (submitState === 'submitting') return;
		const trimmed = markdown.trim();
		if (!trimmed) {
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
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ markdown: trimmed })
					}
				);
				if (!response.ok) throw new Error(await response.text());
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
			<div class="min-h-88 overflow-hidden rounded-lg border">
				<div class="bg-muted/35 flex min-h-10 flex-wrap items-center border-b px-2 py-1.5">
					<MarkdownToolbar {view} state={editorState} />
				</div>
				<div class="min-h-72">
					{#key editorKey}
						<MarkdownEditor
							{initialMarkdown}
							ariaLabel="Playtest note"
							bind:view
							bind:state={editorState}
							onchange={onNoteChange}
						/>
					{/key}
				</div>
			</div>

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
