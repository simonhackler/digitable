<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { presenceColor, type RemotePresenceState } from '$lib/collaboration';

	let {
		peers,
		pageLabel,
		class: className = ''
	}: {
		peers: RemotePresenceState[];
		pageLabel: string;
		class?: string;
	} = $props();

	const shown = $derived(peers.slice(0, 3));
	const remaining = $derived(Math.max(0, peers.length - shown.length));

	function initials(name: string): string {
		const words = name.trim().split(/\s+/).filter(Boolean);
		return (
			words.length > 1 ? `${words[0][0]}${words.at(-1)?.[0]}` : words[0]?.slice(0, 2) || '?'
		).toUpperCase();
	}
</script>

{#if peers.length}
	<Avatar.Group class={`pointer-events-none -space-x-1.5 ${className}`}>
		{#each shown as peer (peer.peerId)}
			<Avatar.Root
				size="sm"
				class="size-5!"
				aria-label={`${peer.participant.displayName} is viewing ${pageLabel}`}
				title={`${peer.participant.displayName} is viewing ${pageLabel}`}
			>
				<Avatar.Fallback
					class="text-[9px] font-semibold text-white"
					style={`background-color: ${presenceColor(peer.peerId)}`}
				>
					{initials(peer.participant.displayName)}
				</Avatar.Fallback>
			</Avatar.Root>
		{/each}
		{#if remaining}
			<Avatar.GroupCount
				class="size-5! text-[9px]"
				aria-label={`${remaining} more ${remaining === 1 ? 'collaborator' : 'collaborators'} viewing ${pageLabel}`}
			>
				+{remaining}
			</Avatar.GroupCount>
		{/if}
	</Avatar.Group>
{/if}
