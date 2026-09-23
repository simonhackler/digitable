<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import {
		validateProjectMergeResolutions,
		type ProjectMergeConflict,
		type ProjectMergePlan,
		type ProjectMergeResolution,
		type ProjectSession
	} from '$lib/collaboration';
	import { GitMerge, Loader2 } from '@lucide/svelte';
	import { onDestroy, onMount } from 'svelte';

	let { open = $bindable(false), session }: { open?: boolean; session: ProjectSession } = $props();
	let plan = $state<ProjectMergePlan>();
	let loading = $state(false);
	let committing = $state(false);
	let error = $state('');
	let choices = $state<Record<string, ProjectMergeResolution['choice'] | undefined>>({});
	let names = $state<Record<string, string>>({});
	let paths = $state<Record<string, string>>({});
	let assetUrls = $state<Record<string, Record<string, string>>>({});
	let disposed = false;
	const resolutions = $derived.by((): ProjectMergeResolution[] =>
		Object.entries(choices).flatMap(([conflictId, choice]) =>
			choice
				? [
						{
							conflictId,
							choice,
							...(names[conflictId] ? { name: names[conflictId] } : {}),
							...(paths[conflictId] ? { path: paths[conflictId] } : {})
						}
					]
				: []
		)
	);
	const validation = $derived(
		plan ? validateProjectMergeResolutions($state.snapshot(plan), $state.snapshot(resolutions)) : []
	);
	const complete = $derived(
		!!plan && resolutions.length === plan.conflicts.length && validation.length === 0
	);

	onMount(() => {
		void prepare();
	});
	onDestroy(() => {
		disposed = true;
		revokeAssetUrls();
	});

	function reset() {
		revokeAssetUrls();
		plan = undefined;
		error = '';
		choices = {};
		names = {};
		paths = {};
	}

	async function prepare() {
		reset();
		loading = true;
		const result = await session.prepareMergeToParent();
		if (disposed) return;
		loading = false;
		if (result.error) {
			error = result.error.message;
			return;
		}
		plan = result.data;
		for (const [conflictId, details] of Object.entries(plan.assetDetails)) {
			for (const [side, version] of Object.entries(details)) {
				if (!version || !imageMime(version.path)) continue;
				const bytes = version.bytes.slice().buffer;
				assetUrls[conflictId] ??= {};
				assetUrls[conflictId][side] = URL.createObjectURL(
					new Blob([bytes], { type: imageMime(version.path) })
				);
			}
		}
	}

	function revokeAssetUrls() {
		for (const urls of Object.values(assetUrls)) {
			for (const url of Object.values(urls)) URL.revokeObjectURL(url);
		}
		assetUrls = {};
	}

	function imageMime(path: string): string | undefined {
		if (/\.svg$/i.test(path)) return 'image/svg+xml';
		if (/\.png$/i.test(path)) return 'image/png';
		if (/\.jpe?g$/i.test(path)) return 'image/jpeg';
		if (/\.gif$/i.test(path)) return 'image/gif';
		if (/\.webp$/i.test(path)) return 'image/webp';
		return undefined;
	}

	async function commit() {
		if (!plan || !complete) return;
		committing = true;
		error = '';
		const result = await session.commitMergeToParent(plan.id, resolutions);
		committing = false;
		if (result.error) {
			error = result.error.message;
			if (/stale|changed|review/i.test(error)) {
				revokeAssetUrls();
				plan = undefined;
			}
			return;
		}
		open = false;
	}

	function value(value: ProjectMergeConflict['base']): string {
		if (value === null) return 'Not present';
		if (typeof value === 'string') return value;
		if ('path' in value) return value.hash ? `${value.path} (${value.hash})` : value.path;
		return value.name;
	}

	function allowsRename(conflict: ProjectMergeConflict): boolean {
		return (
			conflict.kind === 'path-collision' ||
			conflict.kind === 'component-name-collision' ||
			conflict.kind === 'member-path' ||
			conflict.kind === 'component-name'
		);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
		closeDisabled={committing}
		onEscapeKeydown={(event) => committing && event.preventDefault()}
		onInteractOutside={(event) => committing && event.preventDefault()}
		aria-busy={loading || committing}
	>
		<Dialog.Header>
			<Dialog.Title>
				{plan
					? `Merge ${plan.sourceBranchName} into ${plan.targetBranchName}`
					: 'Prepare branch merge'}
			</Dialog.Title>
			<Dialog.Description>
				Review the exact Base, Parent, and Branch checkpoints before changing the parent.
			</Dialog.Description>
		</Dialog.Header>
		<p class="sr-only" role="status" aria-live="polite">
			{loading
				? 'Preparing merge preview'
				: committing
					? 'Committing merge'
					: plan
						? `Merge preview ready with ${plan.conflicts.length} conflicts`
						: 'Merge preview unavailable'}
		</p>

		{#if loading}
			<div class="text-muted-foreground flex items-center gap-2 py-10 text-sm">
				<Loader2 class="size-4 animate-spin" /> Preparing merge preview
			</div>
		{:else if plan}
			<div class="grid gap-5 py-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
				<section class="space-y-3">
					<div class="bg-muted/50 grid gap-2 rounded-lg border p-3 text-xs">
						<p><span class="font-medium">Base</span> {plan.baseCheckpointId}</p>
						<p><span class="font-medium">Parent</span> {plan.targetCheckpointId}</p>
						<p><span class="font-medium">Branch</span> {plan.sourceCheckpointId}</p>
					</div>
					<div>
						<h3 class="mb-2 text-sm font-semibold">Changes to merge</h3>
						<ul aria-label="Changes to merge" class="space-y-1.5 text-sm">
							{#each plan.changes as change, index (`${change.kind}:${change.memberId ?? change.componentId ?? index}`)}
								<li class="bg-card rounded-md border px-3 py-2">{change.label}</li>
							{:else}
								<li class="text-muted-foreground">No automatic structural changes.</li>
							{/each}
						</ul>
					</div>
					{#if plan.conflicts.length === 0}
						<p class="border-primary/30 bg-primary/5 rounded-lg border p-3 text-sm">
							No conflicts require resolution.
						</p>
					{/if}
				</section>

				{#if plan.conflicts.length}
					<section class="space-y-3">
						<h3 class="text-sm font-semibold">Conflicts</h3>
						{#each plan.conflicts as conflict (conflict.id)}
							<fieldset class="space-y-3 rounded-lg border p-3" aria-label={conflict.label}>
								<legend class="px-1 text-sm font-medium">{conflict.label}</legend>
								<dl class="grid gap-2 text-xs sm:grid-cols-3">
									<div class="bg-muted/50 rounded p-2">
										<dt class="font-medium">Base</dt>
										<dd class="break-all">{value(conflict.base)}</dd>
									</div>
									<div class="bg-muted/50 rounded p-2">
										<dt class="font-medium">Parent</dt>
										<dd class="break-all">{value(conflict.parent)}</dd>
									</div>
									<div class="bg-muted/50 rounded p-2">
										<dt class="font-medium">Branch</dt>
										<dd class="break-all">{value(conflict.branch)}</dd>
									</div>
								</dl>
								{#if plan.assetDetails[conflict.id]}
									<div class="grid gap-2 sm:grid-cols-3">
										{#each Object.entries(plan.assetDetails[conflict.id]) as [side, version] (side)}
											{#if version}
												<div class="rounded-md border p-2 text-xs">
													<p class="font-medium capitalize">{side}</p>
													<p>{version.size.toLocaleString()} bytes</p>
													<p class="text-muted-foreground font-mono break-all">{version.hash}</p>
													{#if assetUrls[conflict.id]?.[side]}
														<img
															class="mt-2 max-h-32 w-full rounded object-contain"
															src={assetUrls[conflict.id][side]}
															alt={`${side} version of ${version.path}`}
														/>
													{/if}
												</div>
											{/if}
										{/each}
									</div>
								{/if}
								<div class="flex flex-wrap gap-3 text-sm">
									{#each ['parent', 'branch', 'delete'] as choice (choice)}
										<label class="flex items-center gap-1.5">
											<input
												type="radio"
												name={conflict.id}
												value={choice}
												bind:group={choices[conflict.id]}
											/>
											{choice === 'parent'
												? 'Keep Parent'
												: choice === 'branch'
													? 'Use Branch'
													: 'Delete'}
										</label>
									{/each}
									{#if allowsRename(conflict)}
										<label class="flex items-center gap-1.5">
											<input
												type="radio"
												name={conflict.id}
												value="rename"
												bind:group={choices[conflict.id]}
											/> Rename
										</label>
									{/if}
								</div>
								{#if choices[conflict.id] === 'rename'}
									{#if conflict.kind.includes('component')}
										<label class="grid gap-1 text-sm" for={`${conflict.id}-name`}>
											New component name
											<Input id={`${conflict.id}-name`} bind:value={names[conflict.id]} />
										</label>
									{:else}
										<label class="grid gap-1 text-sm" for={`${conflict.id}-path`}>
											New branch path
											<Input id={`${conflict.id}-path`} bind:value={paths[conflict.id]} />
										</label>
									{/if}
								{/if}
							</fieldset>
						{/each}
					</section>
				{/if}
			</div>
		{/if}

		{#if error || (plan && resolutions.length === plan.conflicts.length && validation[0])}
			<p class="text-destructive text-sm" role="alert">{error || validation[0]}</p>
		{/if}

		<Dialog.Footer>
			<Dialog.Close>
				{#snippet child({ props })}
					<Button {...props} variant="outline" disabled={committing}>Cancel</Button>
				{/snippet}
			</Dialog.Close>
			{#if !plan && !loading}
				<Button variant="outline" onclick={prepare}>Review changes again</Button>
			{/if}
			<Button onclick={commit} disabled={!complete || loading || committing}>
				{#if committing}<Loader2 class="animate-spin" />{:else}<GitMerge />{/if}
				{plan ? `Merge into ${plan.targetBranchName}` : 'Merge'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
