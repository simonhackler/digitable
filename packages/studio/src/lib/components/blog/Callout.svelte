<script lang="ts">
	let { title = 'Studio Note', children } = $props<{ title?: string; children?: () => unknown }>();
</script>

<div
	class="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(15,15,15,0.08)]"
>
	<p class="text-xs font-semibold tracking-[0.2em] text-[#5a513f] uppercase">{title}</p>
	<div class="mt-3 text-base leading-relaxed text-[#2d2d36]">
		{@render children?.()}
	</div>
</div>
