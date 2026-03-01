<script lang="ts">
	import { resolve } from '$app/paths';

	const year = new Date().getFullYear();
</script>

<footer class="mt-16 border-t border-black/10 bg-[#121216] text-[#f7f4ef]">
	<div class="mx-auto grid max-w-[1120px] gap-10 px-6 py-12 md:grid-cols-[1.3fr_1fr_1fr]">
		<div class="grid gap-4">
			<div class="flex items-center gap-3">
				<div
					class="h-9 w-9 rounded-[12px] bg-[linear-gradient(135deg,#111_0%,#4b5674_55%,#f2b04f_100%)] shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
					aria-hidden="true"
				></div>
				<span class="text-lg font-semibold tracking-[0.02em]">Digitable Studio</span>
			</div>
			<p class="max-w-sm text-sm text-white/70">
				Design, playtest, and publish tabletop games with a visual editor built for iteration.
			</p>
			<p class="text-xs tracking-[0.25em] text-white/50 uppercase">© {year} Digitable</p>
		</div>

		<nav class="grid gap-3 text-sm" aria-label="Product">
			<p class="text-xs font-semibold tracking-[0.3em] text-white/50 uppercase">Product</p>
			<a class="text-white/80 transition hover:text-white" href={resolve('/showcase')}>
				Showcase
			</a>
			<a class="text-white/80 transition hover:text-white" href={resolve('/roadmap')}> Roadmap </a>
			<a class="text-white/80 transition hover:text-white" href={resolve('/blog')}> Blog </a>
		</nav>

		<nav class="grid gap-3 text-sm" aria-label="Legal">
			<p class="text-xs font-semibold tracking-[0.3em] text-white/50 uppercase">Legal</p>
			<a class="text-white/80 transition hover:text-white" href={resolve('/impressum')}>
				Impressum
			</a>
			<a class="text-white/80 transition hover:text-white" href={resolve('/privacy-policy')}>
				Privacy Policy
			</a>
			<a class="text-white/80 transition hover:text-white" href={resolve('/terms-and-conditions')}>
				Terms &amp; Conditions
			</a>
			<a class="text-white/80 transition hover:text-white" href={resolve('/cookie-policy')}>
				Cookie Policy
			</a>
		</nav>
	</div>
</footer>
