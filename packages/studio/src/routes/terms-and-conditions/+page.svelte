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
	.legal-copy {
		max-width: 72ch;
		color: #49424c;
	}

	.legal-copy :global(h1) {
		font-size: var(--text-4xl);
		font-weight: 600;
		line-height: 1.1;
		color: #151515;
	}

	.legal-copy :global(h2) {
		margin-top: 2rem;
		font-size: var(--text-2xl);
		font-weight: 600;
		line-height: 1.25;
		color: #151515;
	}

	.legal-copy :global(p) {
		margin-top: 1rem;
		font-size: var(--text-base);
		line-height: 1.75;
	}

	.legal-copy :global(ul),
	.legal-copy :global(ol) {
		margin-top: 1rem;
		padding-left: 1.5rem;
		font-size: var(--text-base);
		line-height: 1.75;
	}

	.legal-copy :global(ul) {
		list-style: disc;
	}

	.legal-copy :global(ol) {
		list-style: decimal;
	}

	.legal-copy :global(li) {
		margin-top: 0.5rem;
	}

	.legal-copy :global(a) {
		font-weight: 500;
		color: #151515;
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.legal-copy :global(strong) {
		font-weight: 600;
		color: #151515;
	}
</style>
