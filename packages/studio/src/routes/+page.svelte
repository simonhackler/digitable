<script lang="ts">
	import type { PageData } from './$types';
	import SubscribeForm from './subscribe/SubscribeForm.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';

	let { data }: { data: PageData } = $props();

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

{#snippet previewScene(tab: TabId, compact: boolean)}
	<div
		class={`relative z-10 overflow-hidden rounded-xl bg-white/[0.09] p-4 ring-1 ring-white/10 ${
			compact ? 'min-h-[170px] sm:min-h-[190px]' : 'min-h-[250px] sm:p-5'
		}`}
	>
		{#if compact}
			<div class="flex items-center justify-between gap-3">
				<p class="text-xs font-semibold tracking-[0.16em] text-white/65 uppercase">
					{tab === 'design'
						? 'Design preview'
						: tab === 'playtest'
							? 'Playtest preview'
							: 'Publish preview'}
				</p>
				<span class="rounded-full bg-white/12 px-2.5 py-1 text-xs font-semibold text-white/80">
					{tab === 'design' ? 'Edit' : tab === 'playtest' ? 'Live' : 'Build'}
				</span>
			</div>
		{/if}

		{#if tab === 'design'}
			<div
				class={`relative overflow-hidden rounded-xl bg-[linear-gradient(rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px)] bg-[length:18px_18px] ring-1 ring-white/10 ${compact ? 'mt-4' : ''} ${
					compact ? 'h-[118px] sm:h-[140px]' : 'h-[190px] sm:h-[210px]'
				}`}
			>
				<div class="absolute top-3 left-3 flex gap-1.5">
					<span class="h-2 w-2 rounded-full bg-[#f2c9d1]"></span>
					<span class="h-2 w-2 rounded-full bg-[#f2b04f]"></span>
					<span class="h-2 w-2 rounded-full bg-[#9fe1c2]"></span>
				</div>
				<div
					class={`absolute rounded-lg bg-[#f2b04f] p-2 text-[#181818] shadow-[0_14px_26px_rgba(0,0,0,0.18)] ring-2 ring-white/80 ${
						compact
							? 'top-8 left-5 h-[76px] w-[58px] sm:h-[92px] sm:w-[68px]'
							: 'top-10 left-[13%] h-[128px] w-[92px]'
					}`}
				>
					<div class="h-3 rounded bg-white/70"></div>
					<div class="mt-2 h-8 rounded bg-white/25 sm:h-12"></div>
					<div class="mt-2 grid grid-cols-2 gap-1">
						<span class="h-2 rounded bg-white/55"></span>
						<span class="h-2 rounded bg-white/55"></span>
					</div>
				</div>
				<div
					class={`absolute rounded-lg bg-white/12 ring-1 ring-white/10 ${
						compact ? 'top-8 right-5 h-9 w-[42%] sm:h-11' : 'top-10 right-[11%] h-14 w-[44%]'
					}`}
				></div>
				<div
					class={`absolute rounded-lg bg-[#9fe1c2]/80 ${
						compact
							? 'right-[30%] bottom-4 h-9 w-9 sm:h-11 sm:w-11'
							: 'right-[34%] bottom-10 h-16 w-16'
					}`}
				></div>
				<div
					class={`absolute rounded-lg bg-white/14 ${
						compact ? 'right-5 bottom-4 h-9 w-[24%] sm:h-11' : 'right-[11%] bottom-10 h-16 w-[24%]'
					}`}
				></div>
			</div>
		{:else if tab === 'playtest'}
			<div
				class={`relative overflow-hidden rounded-xl bg-white/[0.07] ring-1 ring-white/10 ${compact ? 'mt-4' : ''} ${
					compact ? 'h-[118px] sm:h-[140px]' : 'h-[190px] sm:h-[210px]'
				}`}
			>
				<div class="absolute top-3 left-3 right-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
					<span class="rounded-full bg-[#f2b04f] px-2 py-1 text-xs font-semibold text-[#181818]">
						Room open
					</span>
					<div class="h-1 rounded-full bg-white/15"></div>
					<span class="rounded-full bg-white/15 px-2 py-1 text-xs text-white/80">3 players</span>
				</div>
				<div
					class={`absolute rounded-xl bg-[#9fe1c2]/25 p-2 ring-1 ring-[#9fe1c2]/35 ${
						compact ? 'inset-x-[27%] top-12 bottom-4' : 'inset-x-[30%] top-16 bottom-8'
					}`}
				>
					<div class="grid h-full grid-cols-3 gap-1.5">
						{#each ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] as square (square)}
							<span class="rounded bg-white/18"></span>
						{/each}
					</div>
				</div>
				<div class="absolute top-12 left-4 flex gap-1.5 sm:left-6">
					<span class="h-8 w-6 rounded bg-white/20"></span>
					<span class="h-8 w-6 rounded bg-white/20"></span>
					<span class="h-8 w-6 rounded bg-[#f2c9d1]/80"></span>
				</div>
				<div class="absolute right-4 bottom-4 flex gap-1.5 sm:right-6 sm:bottom-6">
					<span class="h-8 w-6 rounded bg-[#f2b04f]/80"></span>
					<span class="h-8 w-6 rounded bg-white/20"></span>
					<span class="h-8 w-6 rounded bg-white/20"></span>
				</div>
			</div>
		{:else}
			<div
				class={`relative overflow-hidden rounded-xl bg-white/[0.07] p-3 ring-1 ring-white/10 ${compact ? 'mt-4' : ''} ${
					compact ? 'h-[118px] sm:h-[140px]' : 'h-[190px] sm:h-[210px]'
				}`}
			>
				<div class="grid h-full grid-cols-3 gap-3">
					<div class="grid content-between rounded-lg bg-white/[0.1] p-2 ring-1 ring-white/10">
						<div class="grid grid-cols-2 gap-1 rounded bg-white/8 p-1">
							{#each ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as card (card)}
								<span class="aspect-[3/4] rounded bg-[#f2b04f]/80"></span>
							{/each}
						</div>
						<p class="truncate text-xs text-white/70">Paper</p>
					</div>
					<div class="grid content-between rounded-lg bg-white/[0.1] p-2 ring-1 ring-white/10">
						<div class="rounded bg-[#9fe1c2]/75 p-2">
							<div class="h-2 rounded bg-white/40"></div>
							<div class="mt-2 h-2 rounded bg-white/25"></div>
							<div class="mt-1.5 h-2 w-2/3 rounded bg-white/25"></div>
						</div>
						<p class="truncate text-xs text-white/70">TTS JSON</p>
					</div>
					<div class="grid content-between rounded-lg bg-white/[0.1] p-2 ring-1 ring-white/10">
						<div class="grid grid-cols-2 gap-1">
							<span class="h-8 rounded bg-[#f2c9d1]/75"></span>
							<span class="h-8 rounded bg-white/20"></span>
							<span class="h-8 rounded bg-white/20"></span>
							<span class="h-8 rounded bg-[#9fe1c2]/70"></span>
						</div>
						<p class="truncate text-xs text-white/70">Sheets</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/snippet}

<svelte:head>
	<title>Digitable Studio</title>
</svelte:head>

<main class="page min-h-screen text-[#151515]">
	<section class="py-5 sm:py-6">
		<div class="mx-auto grid max-w-[1120px] gap-6 px-6 sm:gap-7">
			<div class="reveal mx-auto grid max-w-[720px] gap-3 text-left md:text-center">
				<h1 class="font-['Newsreader'] text-4xl md:text-5xl lg:text-6xl">
					<span class="block">A free and open source boardgame engine.</span>
				</h1>
				<p class="text-xl text-[#4b4b57]">Design, playtest, and publish your next boardgame.</p>
			</div>

			<div class="reveal grid gap-4">
				<Tabs.Root bind:value={activeTab} class="mx-auto w-full max-w-[720px] gap-4">
					<Tabs.List
						class="grid h-auto w-full grid-cols-3 rounded-[2rem] bg-white/85 p-2 shadow-[inset_0_0_0_1px_rgba(36,36,42,0.1)]"
						aria-label="Primary actions"
					>
						{#each tabIds as tab (tab)}
							<Tabs.Trigger
								value={tab}
								class="h-auto rounded-full px-2 py-3 text-sm font-semibold text-[#33363f] data-[state=active]:bg-[#121212] data-[state=active]:text-[#f6f6f6] data-[state=active]:shadow-[0_8px_18px_rgba(0,0,0,0.2)] sm:px-4 sm:text-base"
							>
								{tab === 'design' ? '1. Design' : tab === 'playtest' ? '2. Playtest' : '3. Publish'}
							</Tabs.Trigger>
						{/each}
					</Tabs.List>
				</Tabs.Root>

				<div
					class={`relative overflow-hidden rounded-[26px] p-5 text-[#f5f5f5] shadow-[0_30px_60px_rgba(12,12,20,0.25)] sm:p-7 ${
						activeTab === 'design'
							? 'bg-[linear-gradient(130deg,#0c0f1a_0%,#2d3554_45%,#f2b04f_120%)]'
							: activeTab === 'playtest'
								? 'bg-[linear-gradient(130deg,#0d1220_0%,#27465f_50%,#9fe1c2_120%)]'
								: 'bg-[linear-gradient(130deg,#1a1015_0%,#5b2a3a_50%,#f7c26c_120%)]'
					}`}
				>
					{@render previewScene(activeTab, true)}
					<div class="preview-glow" aria-hidden="true"></div>
				</div>
			</div>

			<div class="reveal mx-auto grid max-w-[720px] gap-5 text-left md:text-center">
				<p class="text-xl text-[#4b4b57]">{current.subtitle}</p>
				<ul
					class="hidden flex-wrap justify-start gap-3 text-xl text-[#2d2d36] sm:flex md:justify-center md:gap-x-6"
				>
					{#each current.bullets as bullet (bullet)}
						<li class="flex items-center gap-2">
							<span class="h-2.5 w-2.5 rounded-full bg-[#f2b04f]"></span>
							{bullet}
						</li>
					{/each}
				</ul>
				<div class="flex flex-wrap justify-start gap-4 md:justify-center">
					<Button href="/sign-in" variant="pill-outline" size="xl">Sign in</Button>
					<Button href="/app/games" variant="hero" size="xl">Create now</Button>
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
					{@render previewScene('design', false)}
				</div>
			</div>
			<div class="reveal order-1 md:order-2">
				<h2 class="mb-4 text-3xl font-semibold">Design</h2>
				<p class="mb-4 text-xl text-[#4b4b57]">
					Create templates for cards and generate concrete cards based on spreadsheets
				</p>
				<p class="mb-4 text-xl text-[#4b4b57]">
					Digitable uses normal files, svg and csv. Use our inbuilt editors or edit them with
					whatever program you like.
				</p>
				<p class="mb-4 text-xl text-[#4b4b57]">Your game and your data. All files stay with you.</p>
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
					Just one click to turn your design into a playtest. No need for a bunch of setup.
				</p>
				<p class="mb-4 text-xl text-[#4b4b57]">
					Share a link with your friends to playtest online.
				</p>
				<p class="mb-4 text-xl text-[#4b4b57]">
					Go old school and print out your design on paper. Digitable makes it easy to print out all
					components or only the components that changed.
				</p>
			</div>
			<div class="reveal order-2 md:order-2">
				<div
					class="relative overflow-hidden rounded-[26px] bg-[linear-gradient(130deg,#0d1220_0%,#27465f_50%,#9fe1c2_120%)] p-6 text-white shadow-[0_30px_60px_rgba(12,12,20,0.25)] sm:p-10"
				>
					<div class="mb-4 text-base tracking-[0.2em] text-white/75 uppercase">
						Playtest preview
					</div>
					{@render previewScene('playtest', false)}
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
					{@render previewScene('publish', false)}
				</div>
			</div>
			<div class="reveal order-1 md:order-2">
				<h2 class="mb-4 text-3xl font-semibold">Publish</h2>
				<p class="mb-4 text-xl text-[#4b4b57]">
					Publish your game online for the world to play.
				</p>
				<p class="mb-4 text-xl text-[#4b4b57]">
					Sell your print and play files or host them free to download.
				</p>
			</div>
		</div>
	</section>

	<section id="newsletter" class="section-soft py-16">
		<div class="mx-auto grid max-w-[1120px] items-center gap-10 px-6 md:grid-cols-[1.05fr_0.95fr]">
			<div class="reveal">
				<p class="text-sm tracking-[0.35em] text-[#4b4b57] uppercase">Newsletter</p>
				<h2 class="mt-2 text-3xl font-semibold md:text-4xl">
					Stay up to date with the development
				</h2>
				<p class="mt-4 mb-2 text-xl text-[#4b4b57]">
					I send out a monthly Newsletter for updates on digitable. 100% written by me. No lazy ai
					content.
				</p>
				<SubscribeForm {data} />
			</div>
		</div>
	</section>

	<!-- TODO join the Community. Github/Discord. I am always open to feature requests, feedback and suggestions. -->
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

	@keyframes rise {
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
