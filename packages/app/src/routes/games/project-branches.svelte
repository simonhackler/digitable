<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { Badge } from '$lib/components/ui/badge';
	import type {
		ProjectBranchId,
		ProjectCheckpoint,
		ProjectHistoryDocument,
		ProjectSession
	} from '$lib/collaboration';
	import { GitBranch, History, GitFork, GitMerge, MoreHorizontal, RotateCcw } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import ProjectMergeDialog from './project-merge-dialog.svelte';

	let { session }: { session: ProjectSession } = $props();
	let historyUpdate = $state<ProjectHistoryDocument>();
	const history = $derived(historyUpdate ?? session.getHistory());
	let historyOpen = $state(false);
	let pending = $state(false);
	let error = $state('');
	let mergeOpen = $state(false);
	const checkpointId = $derived(page.url.searchParams.get('checkpoint'));
	const baselineId = $derived(page.url.searchParams.get('baseline'));
	const activeBranchId = $derived(session.branchId);
	const branch = $derived(history.branches[activeBranchId]);
	const branches = $derived(
		Object.entries(history.branches)
			.filter(([, value]) => value.deletedAt === undefined && value.mergedAt === undefined)
			.sort((left, right) => left[1].createdAt - right[1].createdAt)
	);
	const checkpoints = $derived(
		Object.values(history.checkpoints)
			.filter((checkpoint) => checkpoint.branchId === activeBranchId)
			.sort((left, right) => right.createdAt - left.createdAt)
	);
	const chronological = $derived([...checkpoints].reverse());
	const checkpointIndex = $derived(
		Math.max(
			0,
			chronological.findIndex((checkpoint) => checkpoint.id === checkpointId)
		)
	);
	const comparisonPaths = $derived.by(() => {
		if (!checkpointId || !baselineId) return [];
		const target = history.checkpoints[checkpointId];
		const baseline = history.checkpoints[baselineId];
		if (!target || !baseline) return [];
		const ids = new Set([...Object.keys(target.members), ...Object.keys(baseline.members)]);
		return [...ids]
			.filter((id) => {
				const left = baseline.members[id];
				const right = target.members[id];
				return (
					!left ||
					!right ||
					left.url !== right.url ||
					left.heads.length !== right.heads.length ||
					left.heads.some((head) => !right.heads.includes(head))
				);
			})
			.map((id) => target.members[id]?.path ?? baseline.members[id]?.path ?? id)
			.sort();
	});

	onMount(() => session.subscribeHistory((value) => (historyUpdate = value)));

	function branchDepth(branchId: ProjectBranchId): number {
		const seen: ProjectBranchId[] = [];
		let current = history.branches[branchId];
		let depth = 0;
		while (current?.parentBranchId && !seen.includes(current.parentBranchId)) {
			seen.push(current.parentBranchId);
			depth += 1;
			current = history.branches[current.parentBranchId];
		}
		return depth;
	}

	async function run(operation: () => Promise<{ error: { message: string } | null }>) {
		pending = true;
		error = '';
		const result = await operation();
		pending = false;
		if (result.error) error = result.error.message;
	}

	async function selectBranch(branchId: ProjectBranchId) {
		if (branchId === activeBranchId) return;
		await run(() => session.checkoutBranch(branchId));
	}

	async function fork(checkpoint?: ProjectCheckpoint) {
		let source = checkpoint;
		if (!source) {
			const result = await session.createCheckpoint('Branch point');
			if (result.error) {
				error = result.error.message;
				return;
			}
			source = session.getHistory().checkpoints[result.data];
		}
		if (!source) return;
		const count = Object.values(history.branches).filter(
			(candidate) => candidate.parentBranchId === activeBranchId
		).length;
		await run(() => session.forkFromCheckpoint(source!.id, `Branch ${count + 1}`));
	}

	function view(checkpoint: ProjectCheckpoint) {
		const url = new URL(page.url);
		url.searchParams.set('checkpoint', checkpoint.id);
		url.searchParams.delete('baseline');
		void goto(url);
	}

	function compare(checkpoint: ProjectCheckpoint) {
		const url = new URL(page.url);
		if (baselineId === checkpoint.id) url.searchParams.delete('baseline');
		else url.searchParams.set('baseline', checkpoint.id);
		void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function latest() {
		const url = new URL(page.url);
		url.searchParams.delete('checkpoint');
		url.searchParams.delete('baseline');
		void goto(url);
	}

	async function rename() {
		if (!branch) return;
		const name = window.prompt('Branch name', branch.name)?.trim();
		if (!name) return;
		await run(() => session.renameBranch(activeBranchId, name));
	}

	async function remove() {
		if (!branch?.parentBranchId || !window.confirm(`Delete "${branch.name}"?`)) return;
		await run(() => session.deleteBranch(activeBranchId));
	}
</script>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Sidebar.MenuButton {...props} tooltipContent="Switch branch" aria-disabled={pending}>
						<GitBranch />
						<span class="truncate">{branch?.name ?? 'Main'}</span>
					</Sidebar.MenuButton>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-72" align="start" side="right" sideOffset={4}>
				<DropdownMenu.Label>Project branches</DropdownMenu.Label>
				{#each branches as [branchId, item] (branchId)}
					<DropdownMenu.Item
						onSelect={() => selectBranch(branchId)}
						class={branchId === activeBranchId ? 'font-medium' : ''}
					>
						<span style:padding-left={`${branchDepth(branchId) * 0.75}rem`}>{item.name}</span>
						{#if branchId === activeBranchId}
							<DropdownMenu.Shortcut>Current</DropdownMenu.Shortcut>
						{/if}
					</DropdownMenu.Item>
				{/each}
				<DropdownMenu.Separator />
				<DropdownMenu.Item onSelect={() => fork()} disabled={session.readOnly}>
					<GitFork /> Create branch
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => (historyOpen = true)}>
					<History /> View history
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onSelect={rename}>Rename branch</DropdownMenu.Item>
				{#if branch?.parentBranchId}
					<DropdownMenu.Item
						onSelect={() => (mergeOpen = true)}
						disabled={session.readOnly || pending}
					>
						<GitMerge /> Merge into parent
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={remove} variant="destructive"
						>Delete branch</DropdownMenu.Item
					>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
	<Sidebar.MenuItem>
		<Sidebar.MenuButton onclick={() => (historyOpen = true)} tooltipContent="Project history">
			<History />
			<span>History</span>
			{#if checkpointId}<Badge variant="secondary">Viewing</Badge>{/if}
		</Sidebar.MenuButton>
	</Sidebar.MenuItem>
</Sidebar.Menu>

<Sheet.Root bind:open={historyOpen}>
	<Sheet.Content class="w-full sm:max-w-xl">
		<Sheet.Header>
			<Sheet.Title>{branch?.name ?? 'Main'} history</Sheet.Title>
			<Sheet.Description>
				Choose a checkpoint to inspect, compare, or use as a branch point.
			</Sheet.Description>
		</Sheet.Header>
		<div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
			<div class="flex flex-wrap gap-2">
				<Button size="sm" variant="outline" onclick={latest} disabled={!checkpointId}>
					<RotateCcw /> Return to latest
				</Button>
				<Button size="sm" onclick={() => fork()} disabled={session.readOnly || pending}>
					<GitFork /> Create branch
				</Button>
			</div>
			{#if baselineId}
				<p class="bg-muted rounded-md px-3 py-2 text-sm">
					Comparison baseline selected independently from the viewed checkpoint.
					{comparisonPaths.length} changed {comparisonPaths.length === 1 ? 'file' : 'files'}.
				</p>
				{#if comparisonPaths.length}
					<ul class="text-muted-foreground list-disc space-y-1 pl-6 text-xs">
						{#each comparisonPaths as path (path)}<li>{path}</li>{/each}
					</ul>
				{/if}
			{/if}
			{#if error}<p class="text-destructive text-sm" role="alert">{error}</p>{/if}
			{#if chronological.length > 1}
				<div class="space-y-2 rounded-lg border p-3">
					<div class="flex items-center justify-between text-xs">
						<span class="font-medium">History scrubber</span>
						<span class="text-muted-foreground">{checkpointIndex + 1} / {chronological.length}</span
						>
					</div>
					<input
						type="range"
						min="0"
						max={chronological.length - 1}
						value={checkpointIndex}
						aria-label="History checkpoint"
						class="accent-primary w-full"
						onchange={(event) => view(chronological[event.currentTarget.valueAsNumber])}
					/>
				</div>
			{/if}
			<div class="relative space-y-2 border-l pl-4">
				{#each checkpoints as checkpoint (checkpoint.id)}
					{@const merge = Object.values(history.merges).find(
						(candidate) => candidate.resultCheckpointId === checkpoint.id
					)}
					<div
						class="bg-card space-y-2 rounded-lg border p-3 shadow-xs"
						role="group"
						aria-label={`Checkpoint ${checkpoint.message}`}
						class:ring-2={checkpointId === checkpoint.id}
						class:ring-primary={checkpointId === checkpoint.id}
					>
						<div class="flex items-start justify-between gap-3">
							<div>
								<p class="text-sm font-medium">{checkpoint.message}</p>
								<p class="text-muted-foreground text-xs">
									{new Date(checkpoint.createdAt).toLocaleString()} · {Object.keys(
										checkpoint.members
									).length} files
								</p>
							</div>
							<MoreHorizontal class="text-muted-foreground size-4" />
						</div>
						{#if merge && 'baseCheckpointId' in merge}
							<dl class="bg-muted/50 grid gap-1 rounded-md p-2 font-mono text-[10px]">
								<div>
									<dt class="inline font-sans font-medium">Base:</dt>
									<dd class="inline">{merge.baseCheckpointId}</dd>
								</div>
								<div>
									<dt class="inline font-sans font-medium">Source:</dt>
									<dd class="inline">{merge.sourceCheckpointId}</dd>
								</div>
								<div>
									<dt class="inline font-sans font-medium">Target:</dt>
									<dd class="inline">{merge.targetCheckpointId}</dd>
								</div>
								<div>
									<dt class="inline font-sans font-medium">Result:</dt>
									<dd class="inline">{merge.resultCheckpointId}</dd>
								</div>
							</dl>
						{/if}
						<div class="flex flex-wrap gap-2">
							<Button size="sm" variant="outline" onclick={() => view(checkpoint)}>View</Button>
							<Button
								size="sm"
								variant={baselineId === checkpoint.id ? 'secondary' : 'ghost'}
								onclick={() => compare(checkpoint)}
							>
								{baselineId === checkpoint.id ? 'Baseline set' : 'Compare from here'}
							</Button>
							<Button size="sm" variant="ghost" onclick={() => fork(checkpoint)}>
								Branch from here
							</Button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</Sheet.Content>
</Sheet.Root>

{#if mergeOpen}
	<ProjectMergeDialog bind:open={mergeOpen} {session} />
{/if}
