<script lang="ts">
	import type { PresenceCursor, ProjectPresence, RemotePresenceState } from './project-presence';
	import { onMount } from 'svelte';
	import type { Attachment } from 'svelte/attachments';

	let {
		presence,
		name,
		scope
	}: {
		presence: ProjectPresence;
		name: string;
		scope: string;
	} = $props();

	let peers = $state.raw<RemotePresenceState[]>([]);
	let bounds = $state.raw({ left: 0, width: 0, height: 0 });
	let cursor: PresenceCursor | null = null;
	let timer: number | undefined;
	let lastSentAt = 0;
	let root: HTMLElement | null = null;
	const visible = $derived(peers.filter((peer) => peer.scope === scope && peer.cursor));

	function publish(next: PresenceCursor | null): void {
		cursor = next;
		presence.setLocalState({ name, scope, cursor });
		lastSentAt = performance.now();
	}

	function updateBounds(): void {
		if (!root) return;
		const rect = root.getBoundingClientRect();
		const left = Math.max(0, rect.left);
		bounds = {
			left,
			width: Math.max(0, Math.min(window.innerWidth, rect.right) - left),
			height: window.innerHeight
		};
	}

	function onPointerMove(event: MouseEvent): void {
		if (!bounds.width || !bounds.height) return;
		if (event.clientX < bounds.left || event.clientX > bounds.left + bounds.width) return;
		const next = {
			x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
			y: Math.min(1, Math.max(0, event.clientY / bounds.height))
		};
		const remaining = 50 - (performance.now() - lastSentAt);
		if (remaining <= 0) {
			publish(next);
			return;
		}
		cursor = next;
		if (timer !== undefined) return;
		timer = window.setTimeout(() => {
			timer = undefined;
			publish(cursor);
		}, remaining);
	}

	function hideCursor(): void {
		if (timer !== undefined) {
			window.clearTimeout(timer);
			timer = undefined;
		}
		if (cursor) publish(null);
	}

	function color(peerId: string): string {
		let hash = 0;
		for (const character of peerId) hash = (hash * 31 + character.charCodeAt(0)) | 0;
		return `hsl(${Math.abs(hash) % 360} 72% 45%)`;
	}

	onMount(() => {
		const unsubscribe = presence.subscribe((next) => (peers = next));
		publish(null);
		return () => {
			publish(null);
			unsubscribe();
			if (timer !== undefined) window.clearTimeout(timer);
		};
	});

	const trackRoot: Attachment<HTMLElement> = (element) => {
		root = element.parentElement;
		if (!root) return;
		updateBounds();
		const observer = new ResizeObserver(updateBounds);
		observer.observe(root);
		const onVisibilityChange = () => {
			if (document.hidden) hideCursor();
		};
		document.addEventListener('visibilitychange', onVisibilityChange);

		return () => {
			observer.disconnect();
			document.removeEventListener('visibilitychange', onVisibilityChange);
			root = null;
		};
	};
</script>

<svelte:window
	onmousemove={onPointerMove}
	onmouseleave={hideCursor}
	onblur={hideCursor}
	onresize={updateBounds}
/>

<div
	class="pointer-events-none fixed inset-0 z-40 overflow-hidden"
	data-collaborative-cursor-layer
	aria-hidden="false"
	{@attach trackRoot}
>
	{#each visible as peer (peer.peerId)}
		{@const peerColor = color(peer.peerId)}
		<div
			class="absolute"
			style:left={`${bounds.left + (peer.cursor?.x ?? 0) * bounds.width}px`}
			style:top={`${(peer.cursor?.y ?? 0) * bounds.height}px`}
			role="img"
			aria-label={`${peer.name} cursor`}
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
				{peer.name}
			</span>
		</div>
	{/each}
</div>
