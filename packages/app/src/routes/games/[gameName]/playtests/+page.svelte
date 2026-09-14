<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import type { FsDir } from '$lib/components/file-browser/adapters/adapter';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input';
	import {
		importRegisteredPlaytestFeedback,
		readPlaytestFeedbackRegistry,
		registerPlaytestFeedbackImport,
		type PlaytestFeedbackRegistry,
		type RemotePlaytestFeedback
	} from '$lib/playtests/feedback';
	import { exportProjectForPlaytest } from '$lib/playtests/project-transfer';
	import { requireParam } from '$lib/utils/assert';
	import { Clipboard, ExternalLink } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { Err, tryAsync } from 'wellcrafted/result';
	import { getActiveProjectContext, getFileSystemContext } from '../../context';
	import CreateRoomModal from '../../../playtests/[playtestId]/create-room-modal.svelte';

	type RegisteredPlaytest = PlaytestFeedbackRegistry['playtests'][number];

	const fileSystem = getFileSystemContext();
	const project = getActiveProjectContext();
	const projectName = $derived(requireParam('gameName'));
	const dateFormatter = new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	let playtests = $state<RegisteredPlaytest[]>([]);
	let feedbackByPlaytest = $state<Record<string, RemotePlaytestFeedback[]>>({});
	let feedbackErrors = $state<Record<string, string>>({});
	let loadingFeedback = $state<Record<string, boolean>>({});
	let isStartingPlaytest = $state(false);
	let isImportingFeedback = $state(false);
	let statusMessage = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let origin = $state('');

	const sortedPlaytests = $derived(
		[...playtests].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
	);

	function messageFrom(error: unknown, fallback: string): string {
		if (error && typeof error === 'object' && 'message' in error) {
			const message = error.message;
			if (typeof message === 'string' && message.length > 0) return message;
		}

		return fallback;
	}

	function buildInviteUrl(playtestId: string): string {
		const path = resolve('/playtests/[playtestId]', { playtestId });
		if (!origin) return path;
		return new URL(path, origin).toString();
	}

	function formatDate(value: string): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return dateFormatter.format(date);
	}

	function visibleMarkdown(markdown: string): string {
		const withoutFrontmatter = markdown.replace(/^---\n[\s\S]*?\n---\n\n?/, '');
		return withoutFrontmatter.trim();
	}

	async function openGameDir(): Promise<FsDir> {
		const gameDir = await fileSystem.openDir(projectName);
		if (gameDir.error) {
			throw new Error(gameDir.error.message);
		}

		return gameDir.data;
	}

	async function fetchPlaytestFeedback(playtestId: string): Promise<RemotePlaytestFeedback[]> {
		const response = await fetch(resolve('/api/playtests/[playtestId]/feedback', { playtestId }));
		if (response.status === 403 || response.status === 404) {
			return [];
		}

		if (!response.ok) {
			throw new Error(await response.text());
		}

		const body = (await response.json()) as { feedback: RemotePlaytestFeedback[] };
		return body.feedback;
	}

	async function loadFeedbackFor(playtestId: string) {
		loadingFeedback = { ...loadingFeedback, [playtestId]: true };
		feedbackErrors = { ...feedbackErrors, [playtestId]: '' };

		const loaded = await tryAsync({
			try: () => fetchPlaytestFeedback(playtestId),
			catch: (cause) => Err(cause instanceof Error ? cause : new Error(String(cause)))
		});

		loadingFeedback = { ...loadingFeedback, [playtestId]: false };
		if (loaded.error) {
			feedbackErrors = {
				...feedbackErrors,
				[playtestId]: messageFrom(loaded.error, 'Could not load feedback')
			};
			return;
		}

		feedbackByPlaytest = { ...feedbackByPlaytest, [playtestId]: loaded.data };
	}

	async function loadPlaytests() {
		errorMessage = null;
		const gameDir = await tryAsync({
			try: openGameDir,
			catch: (cause) => Err(cause instanceof Error ? cause : new Error(String(cause)))
		});
		if (gameDir.error) {
			errorMessage = messageFrom(gameDir.error, 'Could not open game folder');
			return;
		}

		const registry = await readPlaytestFeedbackRegistry(gameDir.data);
		if (registry.error) {
			errorMessage = registry.error.message;
			return;
		}

		playtests = registry.data.playtests;
		console.log(playtests);
		await Promise.all(
			registry.data.playtests.map((playtest) => loadFeedbackFor(playtest.playtestId))
		);
		await importFeedback();
	}

	// TODO use forms
	async function startPlaytest(_name: string, playtestPassword?: string) {
		if (isStartingPlaytest) return;
		const password = playtestPassword?.trim();
		const name = _name.trim();

		isStartingPlaytest = true;
		statusMessage = null;
		errorMessage = null;

		const created = await tryAsync({
			try: async () => {
				const synchronized = await project.session.sync();
				if (synchronized.error) throw new Error(synchronized.error.message);
				const gameDir = await openGameDir();
				const files = await exportProjectForPlaytest(fileSystem, projectName);
				// TODO: This shouldn't be an untyped api call.
				const response = await fetch(resolve('/api/playtests'), {
					method: 'POST',
					headers: {
						'content-type': 'application/json'
					},
					body: JSON.stringify({
						projectName,
						name,
						files,
						password: password || undefined
					})
				});

				if (!response.ok) {
					throw new Error(await response.text());
				}

				const result = (await response.json()) as { playtestId: string };
				console.log('registering playtest');
				const registered = await registerPlaytestFeedbackImport(gameDir, result.playtestId, name);
				if (registered.error) {
					throw new Error(registered.error.message);
				}
				const feedbackSynchronized = await project.session.sync();
				if (feedbackSynchronized.error) console.error(feedbackSynchronized.error);

				return result.playtestId;
			},
			catch: (cause) => Err(cause instanceof Error ? cause : new Error(String(cause)))
		});

		isStartingPlaytest = false;
		if (created.error) {
			errorMessage = messageFrom(created.error, 'Could not start playtest');
			return;
		}

		statusMessage = 'Playtest started';
		playtestPassword = '';
		await loadPlaytests();
	}

	async function importFeedback() {
		if (isImportingFeedback) return;

		isImportingFeedback = true;
		errorMessage = null;
		const gameDir = await tryAsync({
			try: openGameDir,
			catch: (cause) => Err(cause instanceof Error ? cause : new Error(String(cause)))
		});
		if (gameDir.error) {
			isImportingFeedback = false;
			errorMessage = messageFrom(gameDir.error, 'Could not open game folder');
			return;
		}

		const imported = await importRegisteredPlaytestFeedback({
			gameDir: gameDir.data,
			fetchFeedback: fetchPlaytestFeedback
		});

		if (imported.error) {
			await project.session.sync();
			isImportingFeedback = false;
			errorMessage = messageFrom(imported.error, 'Could not import playtest feedback');
			return;
		}
		const synchronized = await project.session.sync();
		isImportingFeedback = false;
		if (synchronized.error) {
			errorMessage = synchronized.error.message;
			return;
		}

		if (imported.data > 0) {
			statusMessage = `Imported ${imported.data} feedback ${imported.data === 1 ? 'note' : 'notes'}`;
		}
	}

	onMount(() => {
		if (browser) origin = window.location.href;
		void loadPlaytests();
	});
</script>

<div class="mx-auto flex max-w-5xl flex-col gap-6 p-6">
	<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<div>
			<h1 class="text-2xl font-semibold">Playtests</h1>
			<p class="text-muted-foreground text-sm">{projectName}</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<CreateRoomModal
				onSubmit={startPlaytest}
				title="Create Playtest"
				actionName="Create Playtest"
				creatingName="Creating..."
			/>
		</div>
	</div>

	{#if statusMessage}
		<p class="text-muted-foreground text-sm" aria-live="polite">{statusMessage}</p>
	{/if}
	{#if errorMessage}
		<p class="text-destructive text-sm" aria-live="polite">{errorMessage}</p>
	{/if}

	{#if sortedPlaytests.length === 0}
		<Card.Root>
			<Card.Content class="text-muted-foreground py-10 text-center text-sm">
				No playtests have been started for this game.
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-4">
			{#each sortedPlaytests as playtest (playtest.playtestId)}
				{@const feedback = feedbackByPlaytest[playtest.playtestId] ?? []}
				<Card.Root>
					<Card.Header class="gap-3">
						<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
							<div>
								<Card.Title class="text-lg">
									Playtest {playtest.playtestId.slice(0, 8)}
									{playtest.name}
								</Card.Title>
								<p class="text-muted-foreground text-sm">
									Started {formatDate(playtest.createdAt)}
								</p>
							</div>
							<div class="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									onclick={() => navigator.clipboard.writeText(buildInviteUrl(playtest.playtestId))}
								>
									<Clipboard class="mr-2 h-4 w-4" />
									Copy
								</Button>
								<Button variant="outline" size="sm" href={`/playtests/${playtest.playtestId}`}>
									<ExternalLink class="mr-2 h-4 w-4" />
									Open
								</Button>
							</div>
						</div>
						<Input
							readonly
							value={buildInviteUrl(playtest.playtestId)}
							aria-label="Playtest invite link"
						/>
					</Card.Header>
					<Card.Content class="space-y-4">
						<div class="flex items-center justify-between gap-3">
							<h2 class="text-base font-medium">Feedback</h2>
							<p class="text-muted-foreground text-sm">
								{feedback.length}
								{feedback.length === 1 ? 'note' : 'notes'}
							</p>
						</div>

						{#if loadingFeedback[playtest.playtestId]}
							<p class="text-muted-foreground text-sm">Loading feedback...</p>
						{:else if feedbackErrors[playtest.playtestId]}
							<p class="text-destructive text-sm">{feedbackErrors[playtest.playtestId]}</p>
						{:else if feedback.length === 0}
							<p class="text-muted-foreground text-sm">No feedback submitted yet.</p>
						{:else}
							<div class="space-y-3">
								{#each feedback as note (note.id)}
									<article class="border-border rounded-md border p-4">
										<div
											class="mb-3 flex flex-col gap-1 md:flex-row md:items-start md:justify-between"
										>
											<div>
												<h3 class="font-medium">{note.title}</h3>
												<p class="text-muted-foreground text-sm">
													{note.authorName || 'Player'}
												</p>
											</div>
											<time class="text-muted-foreground text-sm" datetime={note.submittedAt}>
												{formatDate(note.submittedAt)}
											</time>
										</div>
										<pre
											class="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap">{visibleMarkdown(
												note.markdown
											)}</pre>
									</article>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
