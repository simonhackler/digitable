<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import Footer from '$lib/components/Footer.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	let { children } = $props();

	const navBaseClass =
		'rounded-full px-3.5 py-1.5 text-lg font-semibold text-[#1c1c20] transition hover:-translate-y-0.5 hover:bg-black/10 hover:text-[#0d0d0f]';

	const isActive = (path: string) => {
		const pathname = $page.url.pathname;
		return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);
	};
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header class="pt-6 pb-3">
	<div
		class="mx-auto grid max-w-[1120px] items-center justify-items-center gap-6 px-6 md:grid-cols-[1fr_auto_1fr] md:justify-items-stretch"
	>
		<a
			href={resolve('/')}
			class="flex items-center gap-3.5 md:justify-start"
			aria-label="Digitable home"
		>
			<div
				class="h-11 w-11 rounded-[14px] bg-[linear-gradient(135deg,#111_0%,#4b5674_55%,#f2b04f_100%)] shadow-[0_12px_24px_rgba(17,17,17,0.18)]"
				aria-hidden="true"
			></div>
			<span class="text-lg font-bold tracking-[0.02em]">Digitable</span>
		</a>
		<nav
			class="flex w-full flex-wrap items-center justify-center gap-3 rounded-full bg-white/70 px-3 py-2 shadow-[0_14px_28px_rgba(21,21,21,0.08),inset_0_0_0_1px_rgba(32,32,36,0.08)] backdrop-blur md:w-auto md:flex-nowrap"
			aria-label="Primary"
		>
			<Button
				href={resolve('/blog')}
				variant="ghost"
				size="default"
				class={`${navBaseClass} ${isActive('/blog') ? 'bg-black/10 text-[#0d0d0f]' : ''}`}
				aria-current={isActive('/blog') ? 'page' : undefined}
			>
				Blog
			</Button>
			<Button
				href={resolve('/philosophy')}
				variant="ghost"
				size="default"
				class={`${navBaseClass} ${isActive('/philosophy') ? 'bg-black/10 text-[#0d0d0f]' : ''}`}
				aria-current={isActive('/philosophy') ? 'page' : undefined}
			>
				Philosophy
			</Button>
			<Button
				href={resolve('/showcase')}
				variant="ghost"
				size="default"
				class={`${navBaseClass} ${isActive('/showcase') ? 'bg-black/10 text-[#0d0d0f]' : ''}`}
				aria-current={isActive('/showcase') ? 'page' : undefined}
			>
				Showcase
			</Button>
			<Button
				href={resolve('/roadmap')}
				variant="ghost"
				size="default"
				class={`${navBaseClass} ${isActive('/roadmap') ? 'bg-black/10 text-[#0d0d0f]' : ''}`}
				aria-current={isActive('/roadmap') ? 'page' : undefined}
			>
				Roadmap
			</Button>
			<Button
				href={resolve('/contact')}
				variant="ghost"
				size="default"
				class={`${navBaseClass} ${isActive('/contact') ? 'bg-black/10 text-[#0d0d0f]' : ''}`}
				aria-current={isActive('/contact') ? 'page' : undefined}
			>
				Contact
			</Button>
		</nav>
		<div class="min-h-[44px]" aria-hidden="true"></div>
	</div>
</header>

{@render children()}

<Footer />
