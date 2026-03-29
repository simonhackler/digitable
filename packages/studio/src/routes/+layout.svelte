<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import Footer from '$lib/components/Footer.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	let { children } = $props();

	const isActive = (path: string) => {
		const pathname = $page.url.pathname;
		return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);
	};

	async function fetchStars(o: string, r: string): Promise<number | null> {
		// if (!browser) return null; // client-only
		const res = await fetch(`https://api.github.com/repos/${o}/${r}`, {
			headers: {
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28'
			}
		});
		if (!res.ok) return null;
		const { stargazers_count } = await res.json();
		return Number(stargazers_count ?? 0);
	}

	let githubStars = $derived(await fetchStars('RightNow-AI', 'openfang'));

	const discordUrl = 'https://discord.gg/sasxJ5MRWX';
	const githubUrl = 'https://github.com/your-org/your-repo';
	// const githubStars = '2.3k';
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
				variant="nav"
				size="unset"
				aria-current={isActive('/blog') ? 'page' : undefined}
			>
				Blog
			</Button>
			<Button
				href={resolve('/philosophy')}
				variant="nav"
				size="unset"
				aria-current={isActive('/philosophy') ? 'page' : undefined}
			>
				Philosophy
			</Button>
			<Button
				href={resolve('/showcase')}
				variant="nav"
				size="unset"
				aria-current={isActive('/showcase') ? 'page' : undefined}
			>
				Showcase
			</Button>
			<Button
				href={resolve('/roadmap')}
				variant="nav"
				size="unset"
				aria-current={isActive('/roadmap') ? 'page' : undefined}
			>
				Roadmap
			</Button>
			<Button
				href={resolve('/contact')}
				variant="nav"
				size="unset"
				aria-current={isActive('/contact') ? 'page' : undefined}
			>
				Contact
			</Button>
		</nav>
		<div class="flex items-center justify-end gap-3">
			<a
				href={discordUrl}
				class="group inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/70 shadow-[0_14px_28px_rgba(21,21,21,0.08),inset_0_0_0_1px_rgba(32,32,36,0.08)] transition hover:-translate-y-0.5 hover:bg-white"
				aria-label="Join the Digitable Discord"
				rel="noreferrer"
				target="_blank"
			>
				<svg
					viewBox="0 0 256 199"
					class="h-5 w-5 text-[#1c1c20] transition group-hover:text-[#0d0d0f]"
					aria-hidden="true"
				>
					<path
						fill="currentColor"
						d="M216.856 16.597A208.502 208.502 0 0 0 164.042 0c-2.275 4.113-4.856 9.602-6.681 13.904a192.286 192.286 0 0 0-57.722 0C97.814 9.602 95.208 4.113 92.908 0a207.5 207.5 0 0 0-52.81 16.597C6.337 67.332-2.741 117.336.718 166.658a208.09 208.09 0 0 0 62.63 32.272c5.042-6.906 9.546-14.279 13.65-21.95a134.93 134.93 0 0 1-21.56-10.31c1.814-1.324 3.58-2.684 5.303-4.08c41.438 19.431 86.51 19.431 127.34 0c1.723 1.396 3.489 2.756 5.303 4.08a134.67 134.67 0 0 1-21.56 10.31c4.104 7.67 8.608 15.043 13.65 21.95a208.041 208.041 0 0 0 62.63-32.272c4.015-56.733-6.15-106.374-38.053-150.06ZM85.474 135.635c-12.645 0-23.021-11.468-23.021-25.608c0-14.14 10.18-25.608 23.021-25.608c12.84 0 23.216 11.468 23.021 25.608c0 14.14-10.18 25.608-23.021 25.608Zm85.064 0c-12.645 0-23.021-11.468-23.021-25.608c0-14.14 10.18-25.608 23.021-25.608c12.84 0 23.216 11.468 23.021 25.608c0 14.14-10.18 25.608-23.021 25.608Z"
					/>
				</svg>
			</a>
			<a
				href={githubUrl}
				class="group inline-flex items-center gap-2 rounded-full bg-white/70 px-3.5 py-2 text-sm font-semibold text-[#1c1c20] shadow-[0_14px_28px_rgba(21,21,21,0.08),inset_0_0_0_1px_rgba(32,32,36,0.08)] transition hover:-translate-y-0.5 hover:bg-white hover:text-[#0d0d0f]"
				aria-label="View the Digitable GitHub repository"
				rel="noreferrer"
				target="_blank"
			>
				<svg
					viewBox="0 0 24 24"
					class="h-5 w-5 text-[#1c1c20] transition group-hover:text-[#0d0d0f]"
					aria-hidden="true"
				>
					<path
						fill="currentColor"
						d="M12 0.297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385 0.6 0.113 0.82-0.258 0.82-0.577 0-0.285-0.01-1.04-0.015-2.04-3.338 0.724-4.042-1.61-4.042-1.61-0.546-1.387-1.333-1.757-1.333-1.757-1.089-0.744 0.084-0.729 0.084-0.729 1.205 0.084 1.84 1.236 1.84 1.236 1.07 1.835 2.809 1.305 3.495 0.998 0.108-0.776 0.418-1.305 0.762-1.605-2.665-0.303-5.466-1.332-5.466-5.93 0-1.31 0.469-2.381 1.235-3.221-0.135-0.303-0.54-1.523 0.105-3.176 0 0 1.005-0.322 3.3 1.23 0.96-0.267 1.98-0.399 3-0.405 1.02 0.006 2.04 0.138 3 0.405 2.28-1.552 3.285-1.23 3.285-1.23 0.645 1.653 0.24 2.873 0.12 3.176 0.765 0.84 1.23 1.911 1.23 3.221 0 4.61-2.805 5.625-5.475 5.921 0.429 0.372 0.81 1.102 0.81 2.222 0 1.606-0.015 2.896-0.015 3.286 0 0.315 0.21 0.69 0.825 0.57 4.77-1.585 8.205-6.082 8.205-11.385 0-6.627-5.373-12-12-12Z"
					/>
				</svg>
				<svg
					viewBox="0 0 24 24"
					class="h-5 w-5 text-[#1c1c20] transition group-hover:text-[#0d0d0f]"
					aria-hidden="true"
				>
					<path
						fill="currentColor"
						d="M12 2l2.866 5.808 6.41.93-4.638 4.52 1.094 6.376L12 16.97l-5.732 3.663 1.094-6.376L2.724 8.738l6.41-.93L12 2z"
					/>
				</svg>
				<span class="leading-none">{githubStars}</span>
				<span class="sr-only">GitHub stars</span>
			</a>
		</div>
	</div>
</header>

{@render children()}

<Footer />
