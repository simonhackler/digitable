<script lang="ts">
	import type { PageData } from './$types';
	import SubscribeForm from './subscribe/SubscribeForm.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { DISCORD_URL, GITHUB_URL } from './constants';
	import { Star } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();
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
				<div
					class="absolute top-3 right-3 left-3 grid grid-cols-[auto_1fr_auto] items-center gap-2"
				>
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
		<div class="mx-auto grid max-w-[1280px] gap-6 px-6 sm:gap-7">
			<div class="reveal mx-auto grid max-w-[720px] gap-3 text-left md:text-center">
				<h1 class="font-['Newsreader'] text-4xl md:text-5xl lg:text-6xl">
					<span class="block">A free and open source boardgame engine.</span>
				</h1>
				<p class="text-xl text-[#4b4b57]">Design, playtest, and publish your next boardgame.</p>
			</div>

			<div class="flex flex-wrap justify-start gap-4 md:justify-center">
				<Button href={DISCORD_URL} variant="pill-outline" size="huge">
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

					Join the discord</Button
				>
				<Button href="/app/games" variant="hero" size="huge">Create now</Button>
			</div>

			<figure
				class="reveal mx-auto mt-2 w-full max-w-[1280px] overflow-hidden rounded-xl bg-[#f7f4ef] p-1.5 shadow-[0_24px_70px_rgba(21,21,21,0.18),0_0_0_1px_rgba(21,21,21,0.08)] sm:rounded-2xl sm:p-2"
			>
				<img
					src="/screenshots/hero-image-2.png"
					alt="Screenshot of the Digitable editor"
					class="block w-full rounded-b-lg border border-[#ded8cf] object-cover sm:rounded-b-xl"
				/>
			</figure>
		</div>
	</section>

	<section id="design" class="section-soft section-design py-16">
		<div
			class="mx-auto grid max-w-[1120px] [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] items-center gap-10 px-6"
		>
			<div class="reveal order-2 md:order-1">
				<img
					src="/screenshots/design-shot.png"
					alt="Screenshot of designing cards in Digitable"
					loading="lazy"
					class="block w-full rounded-[26px] shadow-[0_30px_60px_rgba(12,12,20,0.25)]"
				/>
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
				<img
					src="/screenshots/playtest-shot.png"
					alt="Screenshot of a Digitable playtest session"
					loading="lazy"
					class="block w-full rounded-[26px] shadow-[0_30px_60px_rgba(12,12,20,0.25)]"
				/>
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
				<p class="mb-4 text-xl text-[#4b4b57]">Publish your game online for the world to play.</p>
				<p class="mb-4 text-xl text-[#4b4b57]">
					Sell your print and play files or host them free to download.
				</p>
			</div>
		</div>
	</section>

	<section id="newsletter" class="section-soft py-16">
		<div class="mx-auto grid max-w-[760px] justify-items-center gap-10 px-6 text-center">
			<div class="reveal w-full">
				<h2 class="mt-2 text-3xl font-semibold md:text-4xl">
					Stay up to date with the development
				</h2>
				<p class="mt-4 mb-2 text-xl text-[#4b4b57]">
					I send out a monthly Newsletter for updates on digitable.
				</p>
				<SubscribeForm {data} />
			</div>
		</div>
	</section>

	<section class="section-community py-16 sm:py-20">
		<div class="reveal mx-auto grid max-w-[760px] justify-items-center gap-6 px-6 text-center">
			<div class="grid gap-4">
				<h2 class="font-['Newsreader'] text-4xl font-medium tracking-tight sm:text-5xl md:text-6xl">
					Join the community
				</h2>
				<p class="mx-auto max-w-[560px] text-xl leading-relaxed text-[#6d6660]">
					Digitable is built in the open. Feedback, ideas, suggestions and pull requests are
					welcome.
				</p>
			</div>

			<div class="grid w-full max-w-[560px] gap-3 sm:grid-cols-2 sm:gap-4">
				<Button
					href={DISCORD_URL}
					variant="pill-outline"
					size="huge"
					class="h-14 rounded-xl bg-white text-xl shadow-none sm:h-16"
					target="_blank"
					rel="noreferrer"
				>
					<svg viewBox="0 0 256 199" class="text-primary h-5 w-5" aria-hidden="true">
						<path
							fill="currentColor"
							d="M216.856 16.597A208.502 208.502 0 0 0 164.042 0c-2.275 4.113-4.856 9.602-6.681 13.904a192.286 192.286 0 0 0-57.722 0C97.814 9.602 95.208 4.113 92.908 0a207.5 207.5 0 0 0-52.81 16.597C6.337 67.332-2.741 117.336.718 166.658a208.09 208.09 0 0 0 62.63 32.272c5.042-6.906 9.546-14.279 13.65-21.95a134.93 134.93 0 0 1-21.56-10.31c1.814-1.324 3.58-2.684 5.303-4.08c41.438 19.431 86.51 19.431 127.34 0c1.723 1.396 3.489 2.756 5.303 4.08a134.67 134.67 0 0 1-21.56 10.31c4.104 7.67 8.608 15.043 13.65 21.95a208.041 208.041 0 0 0 62.63-32.272c4.015-56.733-6.15-106.374-38.053-150.06ZM85.474 135.635c-12.645 0-23.021-11.468-23.021-25.608c0-14.14 10.18-25.608 23.021-25.608c12.84 0 23.216 11.468 23.021 25.608c0 14.14-10.18 25.608-23.021 25.608Zm85.064 0c-12.645 0-23.021-11.468-23.021-25.608c0-14.14 10.18-25.608 23.021-25.608c12.84 0 23.216 11.468 23.021 25.608c0 14.14-10.18 25.608-23.021 25.608Z"
						/>
					</svg>
					Join the Discord
				</Button>
				<Button
					href={GITHUB_URL}
					variant="hero"
					size="huge"
					class="h-14 rounded-xl text-xl sm:h-16"
					target="_blank"
					rel="noreferrer"
				>
					<Star></Star>
					Star on GitHub
				</Button>
			</div>
		</div>
	</section>

	<section id="about" class="section-soft py-16 sm:py-20">
		<div
			class="mx-auto grid max-w-[1120px] [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] items-center gap-10 px-6"
		>
			<div class="reveal">
				<img
					src="/myself.jpg"
					alt="Simon playing a board game"
					loading="lazy"
					class="block w-full rounded-[26px] object-cover shadow-[0_30px_60px_rgba(12,12,20,0.2)]"
				/>
			</div>
			<div class="reveal">
				<h2 class="mb-4 text-3xl font-semibold">About</h2>
				<p class="mb-4 text-lg leading-relaxed text-[#4b4b57]">Hi,</p>
				<p class="text-lg text-[#4b4b57]">
					I am Simon, I made Digitable because I couldn't find the open source board game design
					tool I wanted. I am making digitable to be my personal dream boardgame software. I hope
					digitable can be useful to you as well and can help you make your dream game.
				</p>
				<p class="mb-4 text-lg text-[#4b4b57]">
					If you want to chat with me about games, game design or software development feel free to
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					contact me on <a class="text-blue-500" href={DISCORD_URL}>discord</a> or send me a
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					<a class="text-blue-500" href="mailto:simon.hackler@protonmail.com">mail</a>. And now
					design some great games!
				</p>
				<p class="mb-1 text-lg text-[#4b4b57]">Best,</p>
				<p class="text-lg text-[#4b4b57]">Simon</p>
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

	.section-community {
		background: #f8f2ec;
	}

	@keyframes rise {
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
