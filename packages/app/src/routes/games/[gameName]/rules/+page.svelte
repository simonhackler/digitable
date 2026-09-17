<script lang="ts">
	import MarkdownEditor from '$lib/components/markdown/MarkdownEditor.svelte';
	import MarkdownToolbar from '$lib/components/markdown/MarkdownToolbar.svelte';
	import { assert, requireParam } from '$lib/utils/assert';
	import type { EditorState } from 'prosemirror-state';
	import type { EditorView } from 'prosemirror-view';
	import { getActiveProjectContext, getActiveProjectState } from '../../context.js';
	import GameTopBar from '../../game-top-bar.svelte';

	const project = getActiveProjectContext();
	const projectState = getActiveProjectState();
	const gameName = requireParam('gameName');
	const handle = project.session.getRulesHandle();
	assert(handle, 'The project session is missing its rules document.');

	let view = $state<EditorView>();
	let editorState = $state<EditorState>();
	const rulesStatus = $derived(
		projectState.reconciliation.state === 'syncing'
			? 'Saving'
			: projectState.reconciliation.state === 'error' &&
				  projectState.reconciliation.path === 'rules.md'
				? 'Save failed'
				: 'Saved'
	);
	const rulesError = $derived(
		projectState.reconciliation.state === 'error' && projectState.reconciliation.path === 'rules.md'
			? projectState.reconciliation.message
			: null
	);
</script>

<svelte:head>
	<title>Rules - {gameName}</title>
</svelte:head>

<div class="bg-background flex h-full min-h-screen flex-col">
	<GameTopBar title="Rules" status={rulesStatus} statusError={rulesError}>
		<MarkdownToolbar {view} state={editorState} />
	</GameTopBar>

	<div class="flex-1 overflow-auto px-4 py-4 sm:px-6">
		<div
			class="bg-background mx-auto min-h-[calc(100vh-8rem)] max-w-[980px] overflow-hidden rounded-lg border"
		>
			<MarkdownEditor
				{handle}
				ariaLabel="Game rules editor"
				presenceRegionId="rules-editor"
				presenceSpace="visible"
				bind:view
				bind:state={editorState}
			/>
		</div>
	</div>
</div>
