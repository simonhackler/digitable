<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import TermsContent from '$lib/legal/terms.md';
</script>

<svelte:head>
	<title>Digitable Studio | Terms &amp; Conditions</title>
</svelte:head>

<main class="min-h-[60vh] bg-[#f7f2ea] text-[#151515]">
	<div class="mx-auto grid max-w-4xl gap-4 px-6 py-16">
		<p class="text-xs font-semibold tracking-[0.3em] text-[#6e5b3a] uppercase">Legal</p>
		<article class="legal-copy">
			<TermsContent />
		</article>
		<div class="mt-6 flex flex-wrap items-center gap-3">
			<Button href="/contact" variant="default" size="lg">Contact us</Button>
			<Button href="/" variant="ghost" size="lg">Back to Studio</Button>
		</div>
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
