<script lang="ts">
	import {
		presenceColor,
		type ProjectPresence,
		type RemotePresenceState
	} from './project-presence';
	import type { PresenceSurfaceRegistry } from './presence-surfaces';
	import { onMount } from 'svelte';

	let {
		presence,
		pageId,
		surfaces,
		peers
	}: {
		presence: ProjectPresence;
		pageId: string;
		surfaces: PresenceSurfaceRegistry;
		peers: RemotePresenceState[];
	} = $props();

	let timer: number | undefined;
	let pointer = $state.raw<ReturnType<PresenceSurfaceRegistry['capture']>>(null);
	let geometryRevision = $state(0);
	let lastSentAt = 0;
	const visible = $derived(peers.filter((peer) => peer.pageId === pageId && peer.pointer));
	const resolvedPeers = $derived.by(() => {
		void geometryRevision;
		return visible.flatMap((peer) => {
			const resolved = peer.pointer ? surfaces.resolve(peer.pointer) : null;
			return resolved ? [{ peer, resolved }] : [];
		});
	});

	function publish(next: ReturnType<PresenceSurfaceRegistry['capture']>): void {
		pointer = next;
		presence.setPointer(pointer);
		lastSentAt = performance.now();
	}

	function onPointerMove(event: PointerEvent): void {
		const next = surfaces.capture(event);
		if (!next) {
			hideCursor();
			return;
		}
		const remaining = 50 - (performance.now() - lastSentAt);
		if (remaining <= 0) {
			publish(next);
			return;
		}
		pointer = next;
		if (timer !== undefined) return;
		timer = window.setTimeout(() => {
			timer = undefined;
			publish(pointer);
		}, remaining);
	}

	function hideCursor(): void {
		if (timer !== undefined) {
			window.clearTimeout(timer);
			timer = undefined;
		}
		if (pointer) publish(null);
	}

	onMount(() => {
		const onVisibilityChange = () => {
			if (document.hidden) {
				hideCursor();
				return;
			}
			presence.reannounce();
			updateGeometry();
		};
		document.addEventListener('scroll', updateGeometry, true);
		document.addEventListener('visibilitychange', onVisibilityChange);
		window.visualViewport?.addEventListener('resize', updateGeometry);
		window.visualViewport?.addEventListener('scroll', updateGeometry);

		return () => {
			hideCursor();
			document.removeEventListener('scroll', updateGeometry, true);
			document.removeEventListener('visibilitychange', onVisibilityChange);
			window.visualViewport?.removeEventListener('resize', updateGeometry);
			window.visualViewport?.removeEventListener('scroll', updateGeometry);
		};
	});

	function updateGeometry(): void {
		geometryRevision += 1;
	}
</script>

<svelte:window
	onpointermove={onPointerMove}
	onpointerleave={hideCursor}
	onblur={hideCursor}
	onresize={updateGeometry}
/>

<div
	class="pointer-events-none fixed inset-0 z-40 overflow-hidden"
	data-collaborative-cursor-layer
	aria-hidden="false"
>
	{#each resolvedPeers as entry (entry.peer.peerId)}
		{@const peerColor = presenceColor(entry.peer.peerId)}
		<div
			class="absolute"
			style:left={`${entry.resolved.x}px`}
			style:top={`${entry.resolved.y}px`}
			role="img"
			aria-label={`${entry.peer.participant.displayName} cursor`}
			data-presence-region={entry.resolved.regionId ?? undefined}
		>
			<svg viewBox="0 0 24 24" class="h-5 w-5 drop-shadow-sm" aria-hidden="true">
				<path
					d="M4 2.8v16.4l4.4-4.4 3.1 6.2 3-1.5-3.1-6.1h6.2L4 2.8Z"
					fill={peerColor}
					stroke="white"
					stroke-width="1.5"
					stroke-linejoin="round"
				/>
			</svg>
			<span
				class="ml-3 block max-w-40 truncate rounded-r-md rounded-bl-md px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-sm"
				style:background-color={peerColor}
			>
				{entry.peer.participant.displayName}
			</span>
		</div>
	{/each}
</div>
