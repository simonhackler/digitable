<script lang="ts">
	import { resolve } from '$app/paths';

	const tabIds = ['design', 'playtest', 'publish'] as const;
	type TabId = (typeof tabIds)[number];

	const tabCopy: Record<
		TabId,
		{
			title: string;
			subtitle: string;
			bullets: string[];
		}
	> = {
		design: {
			title: 'Design with intent',
			subtitle: 'Build components, boards, decks, and rules with a visual editor.',
			bullets: ['Snap-to-grid layouts', 'Card and token builders', 'Reusable components']
		},
		playtest: {
			title: 'Playtest fast',
			subtitle: 'Run sessions in minutes and capture feedback in-context.',
			bullets: ['Live turn tracking', 'Session notes', 'Instant reset']
		},
		publish: {
			title: 'Publish everywhere',
			subtitle: 'Package your game for web, print, or tabletop simulators.',
			bullets: ['Print-ready exports', 'Rulebook generator', 'Shareable links']
		}
	};

	let activeTab = $state<TabId>('design');
	const current = $derived(tabCopy[activeTab]);
</script>

<svelte:head>
	<title>Digitable Studio</title>
</svelte:head>

<main class="page min-h-screen text-[#151515]">
	<header class="pt-6 pb-3">
		<div
			class="mx-auto grid max-w-[1120px] items-center justify-items-center gap-6 px-6 md:grid-cols-[1fr_auto_1fr] md:justify-items-stretch"
		>
			<div class="flex items-center gap-3.5 md:justify-start">
				<div
					class="h-11 w-11 rounded-[14px] bg-[linear-gradient(135deg,#111_0%,#4b5674_55%,#f2b04f_100%)] shadow-[0_12px_24px_rgba(17,17,17,0.18)]"
					aria-hidden="true"
				></div>
				<span class="text-lg font-bold tracking-[0.02em]">Digitable</span>
			</div>
			<nav
				class="flex w-full flex-wrap items-center justify-center gap-3 rounded-full bg-white/70 px-3 py-2 shadow-[0_14px_28px_rgba(21,21,21,0.08),inset_0_0_0_1px_rgba(32,32,36,0.08)] backdrop-blur md:w-auto md:flex-nowrap"
				aria-label="Primary"
			>
				<a
					href={resolve('/blog')}
					class="rounded-full px-3.5 py-1.5 text-lg font-semibold text-[#1c1c20] transition hover:-translate-y-0.5 hover:bg-black/10 hover:text-[#0d0d0f]"
				>
					Blog
				</a>
				<a
					href={resolve('/philosophy')}
					class="rounded-full px-3.5 py-1.5 text-lg font-semibold text-[#1c1c20] transition hover:-translate-y-0.5 hover:bg-black/10 hover:text-[#0d0d0f]"
				>
					Philosophy
				</a>
				<a
					href={resolve('/showcase')}
					class="rounded-full px-3.5 py-1.5 text-lg font-semibold text-[#1c1c20] transition hover:-translate-y-0.5 hover:bg-black/10 hover:text-[#0d0d0f]"
				>
					Showcase
				</a>
				<a
					href={resolve('/roadmap')}
					class="rounded-full px-3.5 py-1.5 text-lg font-semibold text-[#1c1c20] transition hover:-translate-y-0.5 hover:bg-black/10 hover:text-[#0d0d0f]"
				>
					Roadmap
				</a>
				<a
					href={resolve('/contact')}
					class="rounded-full px-3.5 py-1.5 text-lg font-semibold text-[#1c1c20] transition hover:-translate-y-0.5 hover:bg-black/10 hover:text-[#0d0d0f]"
				>
					Contact
				</a>
			</nav>
			<div class="min-h-[44px]" aria-hidden="true"></div>
		</div>
	</header>

	<section class="py-12">
		<div class="mx-auto grid max-w-[1120px] gap-10 px-6">
			<div class="reveal mx-auto grid max-w-[720px] gap-4 text-left md:text-center">
				<h1 class="font-['Newsreader'] text-4xl md:text-5xl lg:text-6xl">
					<span class="block">Digitable.</span>
					<span class="block">A free and open source boardgame engine.</span>
				</h1>
				<p class="text-xl text-[#4b4b57]">Design, playtest, and publish your next boardgame.</p>
			</div>

			<div class="reveal grid gap-4">
				<div
					class="mx-auto inline-flex flex-wrap gap-2 rounded-full bg-white/80 p-[0.4rem] shadow-[inset_0_0_0_1px_rgba(36,36,42,0.1)] max-sm:justify-start md:justify-center"
					role="tablist"
					aria-label="Primary actions"
				>
					{#each tabIds as tab (tab)}
						<button
							type="button"
							class="tab-button rounded-full border-0 bg-transparent px-[1.2rem] py-2 text-xl font-semibold text-[#33363f] transition-colors hover:bg-black/10"
							class:tab-active={activeTab === tab}
							role="tab"
							aria-selected={activeTab === tab}
							onclick={() => (activeTab = tab)}
						>
							{tab === 'design' ? '1. Design' : tab === 'playtest' ? '2. Playtest' : '3. Publish'}
						</button>
					{/each}
				</div>

				<div
					class={`relative overflow-hidden rounded-[26px] p-6 text-[#f5f5f5] shadow-[0_30px_60px_rgba(12,12,20,0.25)] sm:p-10 ${
						activeTab === 'design'
							? 'bg-[linear-gradient(130deg,#0c0f1a_0%,#2d3554_45%,#f2b04f_120%)]'
							: activeTab === 'playtest'
								? 'bg-[linear-gradient(130deg,#0d1220_0%,#27465f_50%,#9fe1c2_120%)]'
								: 'bg-[linear-gradient(130deg,#1a1015_0%,#5b2a3a_50%,#f7c26c_120%)]'
					}`}
				>
					<div
						class="relative z-10 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-5 max-sm:grid-cols-1"
					>
						<div class="min-h-[150px] rounded-2xl bg-white/10 p-4">
							<p class="text-base tracking-[0.15em] text-white/70 uppercase">
								{activeTab} panel
							</p>
							<div class="mt-2 h-1.5 rounded-full bg-white/20"></div>
							<div class="mt-2 h-1.5 w-[70%] rounded-full bg-white/20"></div>
							<div class="mt-2 h-1.5 rounded-full bg-white/20"></div>
							<div class="mt-2 h-1.5 w-[70%] rounded-full bg-white/20"></div>
						</div>
						<div class="min-h-[240px] rounded-2xl bg-white/10 p-4">
							<p class="text-base tracking-[0.15em] text-white/70 uppercase">Board</p>
							<div class="mt-4 grid grid-cols-4 gap-1.5">
								<span class="aspect-square rounded-lg bg-[#f2b04f]/80"></span>
								<span class="aspect-square rounded-lg bg-[#f2b04f]/80"></span>
								<span class="aspect-square rounded-lg bg-[#f2b04f]/80"></span>
								<span class="aspect-square rounded-lg bg-[#f2b04f]/80"></span>
								<span class="aspect-square rounded-lg bg-[#f2b04f]/80"></span>
								<span class="aspect-square rounded-lg bg-[#f2b04f]/80"></span>
								<span class="aspect-square rounded-lg bg-[#f2b04f]/80"></span>
								<span class="aspect-square rounded-lg bg-[#f2b04f]/80"></span>
								<span class="aspect-square rounded-lg bg-[#f2b04f]/80"></span>
								<span class="aspect-square rounded-lg bg-[#f2b04f]/80"></span>
								<span class="aspect-square rounded-lg bg-[#f2b04f]/80"></span>
								<span class="aspect-square rounded-lg bg-[#f2b04f]/80"></span>
							</div>
						</div>
						<div class="min-h-[150px] rounded-2xl bg-white/10 p-4">
							<p class="text-base tracking-[0.15em] text-white/70 uppercase">Cards</p>
							<div class="mt-4 grid gap-1.5">
								<div class="h-3 rounded-full bg-white/25"></div>
								<div class="h-3 rounded-full bg-white/25"></div>
								<div class="h-3 rounded-full bg-white/25"></div>
							</div>
						</div>
					</div>
					<div class="preview-glow" aria-hidden="true"></div>
				</div>
			</div>

			<div class="reveal mx-auto grid max-w-[720px] gap-6 text-left md:text-center">
				<p class="text-xl text-[#4b4b57]">{current.subtitle}</p>
				<ul
					class="flex flex-wrap justify-start gap-3 text-xl text-[#2d2d36] md:justify-center md:gap-x-6"
				>
					{#each current.bullets as bullet (bullet)}
						<li class="flex items-center gap-2">
							<span class="h-2.5 w-2.5 rounded-full bg-[#f2b04f]"></span>
							{bullet}
						</li>
					{/each}
				</ul>
				<div class="flex flex-wrap justify-start gap-4 md:justify-center">
					<button
						class="rounded-full bg-[#151515] px-7 py-3.5 text-xl font-semibold text-[#f8f8f8] shadow-[0_12px_24px_rgba(0,0,0,0.18)]"
						type="button"
					>
						Start creating now
					</button>
				</div>
			</div>
		</div>
	</section>

	<section id="design" class="section-soft section-design py-16">
		<div
			class="mx-auto grid max-w-[1120px] [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] items-center gap-10 px-6"
		>
			<div class="reveal order-2 md:order-1">
				<div
					class="relative overflow-hidden rounded-[26px] bg-[linear-gradient(130deg,#0c0f1a_0%,#2d3554_45%,#f2b04f_120%)] p-6 text-white shadow-[0_30px_60px_rgba(12,12,20,0.25)] sm:p-10"
				>
					<div class="mb-4 text-base tracking-[0.2em] text-white/75 uppercase">Design preview</div>
					<div
						class="relative z-10 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-5 max-sm:grid-cols-1"
					>
						<div class="min-h-[150px] rounded-2xl bg-white/10 p-4"></div>
						<div class="min-h-[240px] rounded-2xl bg-white/10 p-4"></div>
						<div class="min-h-[150px] rounded-2xl bg-white/10 p-4"></div>
					</div>
				</div>
			</div>
			<div class="reveal order-1 md:order-2">
				<h2 class="mb-4 text-3xl font-semibold">Design</h2>
				<p class="mb-4 text-xl text-[#4b4b57]">
					Create modular components, snap pieces into place, and prototype rules in minutes.
				</p>
				<ul class="grid gap-2 pl-5 text-xl text-[#2d2d36]">
					<li>Component library with quick duplication</li>
					<li>Token, board, and card templates</li>
					<li>Live rule annotations alongside layout</li>
				</ul>
			</div>
		</div>
	</section>

	<section id="playtest" class="section-soft section-playtest py-16">
		<div
			class="mx-auto grid max-w-[1120px] [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] items-center gap-10 px-6"
		>
			<div class="reveal order-1 md:order-1">
				<h2 class="mb-4 text-3xl font-semibold">Playtest</h2>
				<p class="mb-4 text-xl text-[#4b4b57]">
					Bring your table online, invite testers, and record outcomes with every turn.
				</p>
				<ul class="grid gap-2 pl-5 text-xl text-[#2d2d36]">
					<li>Shared state for remote sessions</li>
					<li>Quick restart and scenario presets</li>
					<li>Feedback tied to components</li>
				</ul>
			</div>
			<div class="reveal order-2 md:order-2">
				<div
					class="relative overflow-hidden rounded-[26px] bg-[linear-gradient(130deg,#0d1220_0%,#27465f_50%,#9fe1c2_120%)] p-6 text-white shadow-[0_30px_60px_rgba(12,12,20,0.25)] sm:p-10"
				>
					<div class="mb-4 text-base tracking-[0.2em] text-white/75 uppercase">
						Playtest preview
					</div>
					<div
						class="relative z-10 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-5 max-sm:grid-cols-1"
					>
						<div class="min-h-[150px] rounded-2xl bg-white/10 p-4"></div>
						<div class="min-h-[240px] rounded-2xl bg-white/10 p-4"></div>
						<div class="min-h-[150px] rounded-2xl bg-white/10 p-4"></div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section id="publish" class="section-soft section-publish py-16">
		<div
			class="mx-auto grid max-w-[1120px] [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] items-center gap-10 px-6"
		>
			<div class="reveal order-2 md:order-1">
				<div
					class="relative overflow-hidden rounded-[26px] bg-[linear-gradient(130deg,#1a1015_0%,#5b2a3a_50%,#f7c26c_120%)] p-6 text-white shadow-[0_30px_60px_rgba(12,12,20,0.25)] sm:p-10"
				>
					<div class="mb-4 text-base tracking-[0.2em] text-white/75 uppercase">Publish preview</div>
					<div
						class="relative z-10 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-5 max-sm:grid-cols-1"
					>
						<div class="min-h-[150px] rounded-2xl bg-white/10 p-4"></div>
						<div class="min-h-[240px] rounded-2xl bg-white/10 p-4"></div>
						<div class="min-h-[150px] rounded-2xl bg-white/10 p-4"></div>
					</div>
				</div>
			</div>
			<div class="reveal order-1 md:order-2">
				<h2 class="mb-4 text-3xl font-semibold">Publish</h2>
				<p class="mb-4 text-xl text-[#4b4b57]">
					Export production-ready assets and publish updates with a single click.
				</p>
				<ul class="grid gap-2 pl-5 text-xl text-[#2d2d36]">
					<li>Print, web, and tabletop simulator outputs</li>
					<li>Versioned changelogs for testers</li>
					<li>Shareable build links</li>
				</ul>
			</div>
		</div>
	</section>
</main>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap');

	:global(body) {
		font-family: 'Space Grotesk', 'Trebuchet MS', sans-serif;
	}

	.page {
		background: #ffffff;
	}

	.preview-glow {
		position: absolute;
		inset: -40% 20% 20% -30%;
		background: radial-gradient(circle, rgba(255, 255, 255, 0.35), transparent 60%);
		filter: blur(12px);
	}

	.reveal {
		opacity: 0;
		transform: translateY(18px);
		animation: rise 0.7s ease forwards;
	}

	.reveal:nth-child(2) {
		animation-delay: 0.1s;
	}

	.reveal:nth-child(3) {
		animation-delay: 0.2s;
	}

	.section-soft {
		background: #f8f6f1;
	}

	.section-soft.section-design {
		background: #f2d9c9;
	}

	.section-soft.section-playtest {
		background: #cfe6df;
	}

	.section-soft.section-publish {
		background: #f2c9d1;
	}

	.tab-button.tab-active {
		background: #121212;
		color: #f6f6f6;
		box-shadow: 0 8px 18px rgba(0, 0, 0, 0.2);
	}

	@keyframes rise {
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
