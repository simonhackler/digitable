<script lang="ts">
	import PrivacyContent from '$lib/legal/privacy-policy.md';
</script>

<svelte:head>
	<title>Digitable Studio | Privacy Policy</title>
</svelte:head>

<main class="min-h-[60vh] bg-[#f7f2ea] text-[#151515]">
	<div class="mx-auto grid max-w-4xl gap-4 px-6 py-16">
		<p class="text-xs font-semibold tracking-[0.3em] text-[#6e5b3a] uppercase">Legal</p>
		<article class="legal-copy">
			<PrivacyContent />
		</article>
	</div>
</main>

<style>
	.legal-copy :global(h1) {
		font-size: var(--text-4xl);
		font-weight: 600;
		line-height: 1.1;
	}

	.legal-copy :global(p) {
		margin-top: 1rem;
		font-size: var(--text-base);
		line-height: 1.75;
		color: #49424c;
	}
</style>
