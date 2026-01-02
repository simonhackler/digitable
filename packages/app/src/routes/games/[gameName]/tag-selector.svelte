<script lang="ts">
	import * as Form from '$lib/components/ui/form/index.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { X, Plus } from '@lucide/svelte';
	import type { SuperForm } from 'sveltekit-superforms';
	import { suggestedTags } from '../suggested-tags.js';
	import type { CreateGameForm } from '../schemas.js';

	type Props = {
		form: SuperForm<CreateGameForm>;
		selectedTags: string[];
		onTagsChange: (tags: string[]) => void;
	};

	let { form, selectedTags, onTagsChange }: Props = $props();

	let newTagInput = $state('');
	let tagDisplayOffset = $state(0);

	const filteredSuggestedTags = $derived.by(() => {
		if (!newTagInput.trim()) return suggestedTags.slice(tagDisplayOffset, tagDisplayOffset + 10);
		return suggestedTags
			.filter((tag) => tag.toLowerCase().includes(newTagInput.toLowerCase()))
			.slice(0, 10);
	});

	function addTag(tag: string) {
		if (!selectedTags.includes(tag) && selectedTags.length < 10) {
			const newTags = [...selectedTags, tag];
			onTagsChange(newTags);
		}
	}

	function removeTag(tag: string) {
		const newTags = selectedTags.filter((t) => t !== tag);
		onTagsChange(newTags);
	}

	function addNewTag() {
		const trimmedTag = newTagInput.trim();
		if (trimmedTag && !selectedTags.includes(trimmedTag) && selectedTags.length < 10) {
			const newTags = [...selectedTags, trimmedTag];
			onTagsChange(newTags);
			newTagInput = '';
		}
	}

	function handleNewTagKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addNewTag();
		}
	}

	function cycleTags() {
		if (!newTagInput.trim()) {
			const maxOffset = Math.max(0, suggestedTags.length - 10);
			tagDisplayOffset = (tagDisplayOffset + 10) % (maxOffset + 10);
		}
	}
</script>

<div class="space-y-3">
	<Form.Field {form} name="tags">
		<div class="text-sm font-medium">Setting (tags)</div>

		<div class="space-y-2">
			<div class="text-muted-foreground text-xs">Suggestions:</div>
			<div class="flex flex-wrap gap-2">
				{#each filteredSuggestedTags as tag (tag)}
					<Button
						variant="outline"
						size="sm"
						type="button"
						onclick={() => addTag(tag)}
						disabled={selectedTags.includes(tag) || selectedTags.length >= 10}
						class="h-8 text-xs"
					>
						{tag}
					</Button>
				{/each}
				<Button
					variant="outline"
					size="sm"
					type="button"
					onclick={cycleTags}
					class="text-muted-foreground hover:text-foreground h-8 px-2"
				>
					→
				</Button>
			</div>
		</div>

		<div class="flex gap-2">
			<Input
				bind:value={newTagInput}
				placeholder="Search or create tag..."
				onkeydown={handleNewTagKeydown}
				class="flex-1"
			/>
			<Button
				type="button"
				onclick={addNewTag}
				disabled={!newTagInput.trim() ||
					selectedTags.includes(newTagInput.trim()) ||
					selectedTags.length >= 10}
				size="sm"
			>
				<Plus class="h-4 w-4" />
			</Button>
		</div>

		{#if selectedTags.length > 0}
			<div class="space-y-2">
				<div class="text-muted-foreground text-xs">Selected:</div>
				<div class="flex flex-wrap gap-2">
					{#each selectedTags as tag (tag)}
						<Badge variant="secondary" class="flex items-center gap-1">
							{tag}
							<button
								type="button"
								onclick={() => removeTag(tag)}
								class="hover:bg-muted-foreground/20 ml-1 h-3 w-3 rounded-sm"
							>
								<X class="h-3 w-3" />
							</button>
						</Badge>
					{/each}
				</div>
			</div>
		{/if}

		<input type="hidden" name="tags" value={JSON.stringify(selectedTags)} />
		<Form.FieldErrors />
	</Form.Field>
</div>
