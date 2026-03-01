<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';

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
			<a
				href={resolve('/blog')}
				class={`${navBaseClass} ${isActive('/blog') ? 'bg-black/10 text-[#0d0d0f]' : ''}`}
				aria-current={isActive('/blog') ? 'page' : undefined}
			>
				Blog
			</a>
			<a
				href={resolve('/philosophy')}
				class={`${navBaseClass} ${isActive('/philosophy') ? 'bg-black/10 text-[#0d0d0f]' : ''}`}
				aria-current={isActive('/philosophy') ? 'page' : undefined}
			>
				Philosophy
			</a>
			<a
				href={resolve('/showcase')}
				class={`${navBaseClass} ${isActive('/showcase') ? 'bg-black/10 text-[#0d0d0f]' : ''}`}
				aria-current={isActive('/showcase') ? 'page' : undefined}
			>
				Showcase
			</a>
			<a
				href={resolve('/roadmap')}
				class={`${navBaseClass} ${isActive('/roadmap') ? 'bg-black/10 text-[#0d0d0f]' : ''}`}
				aria-current={isActive('/roadmap') ? 'page' : undefined}
			>
				Roadmap
			</a>
			<a
				href={resolve('/contact')}
				class={`${navBaseClass} ${isActive('/contact') ? 'bg-black/10 text-[#0d0d0f]' : ''}`}
				aria-current={isActive('/contact') ? 'page' : undefined}
			>
				Contact
			</a>
		</nav>
		<div class="min-h-[44px]" aria-hidden="true"></div>
	</div>
</header>

{@render children()}
