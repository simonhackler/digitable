<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/Seo.svelte';
	import { formatDate } from '$lib/blog/format';
	import { site, siteUrl } from '$lib/blog/site';
	import type { PageProps } from './$types';

	let { data } = $props<PageProps>();
	const posts = $derived(data.posts);

	const title = site.blogTitle;
	const description = site.tagline;
	const canonical = `${siteUrl}/blog`;
</script>

<Seo
	{title}
	{description}
	{canonical}
	openGraph={{
		title,
		description,
		url: canonical,
		siteName: site.name
	}}
/>

<main class="min-h-screen bg-[#f7f2ea] text-[#151515]">
	<header class="relative overflow-hidden">
		<div class="absolute inset-0" aria-hidden="true">
			<div
				class="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,#f7b964_0%,rgba(247,185,100,0)_70%)]"
			></div>
			<div
				class="absolute right-0 bottom-0 h-64 w-64 translate-x-1/3 translate-y-1/3 rounded-full bg-[radial-gradient(circle,#b7d3cc_0%,rgba(183,211,204,0)_70%)]"
			></div>
		</div>
		<div class="relative mx-auto max-w-5xl px-6 pt-14 pb-10">
			<p class="text-xs font-semibold tracking-[0.3em] text-[#6e5b3a] uppercase">Studio blog</p>
			<h1 class="mt-4 max-w-2xl text-4xl leading-tight font-semibold">
				Design notes from the table
			</h1>
			<p class="mt-4 max-w-2xl text-lg text-[#49424c]">{site.tagline}</p>
			<div class="mt-6 flex flex-wrap items-center gap-4 text-sm font-semibold">
				<a
					href={resolve('/')}
					class="rounded-full border border-black/10 bg-white/80 px-4 py-2 shadow-[0_12px_24px_rgba(15,15,15,0.08)]"
				>
					Back to studio
				</a>
				<a
					href={resolve('/rss.xml')}
					class="rounded-full border border-black/10 bg-[#141414] px-4 py-2 text-white shadow-[0_12px_24px_rgba(15,15,15,0.08)]"
				>
					RSS feed
				</a>
			</div>
		</div>
	</header>

	<section class="mx-auto max-w-5xl px-6 pb-16">
		<div class="grid gap-6">
			{#each posts as post (post.slug)}
				<article
					class="group overflow-hidden rounded-3xl border border-black/10 bg-white/80 shadow-[0_24px_60px_rgba(15,15,15,0.08)] transition hover:-translate-y-1"
				>
					<div class="flex flex-col gap-5 p-5 md:flex-row md:items-center">
						{#if post.ogImage}
							<div
								class="relative h-40 w-full overflow-hidden rounded-2xl bg-[#efe6d9] md:h-36 md:w-56"
							>
								<img
									src={post.ogImage}
									alt={post.title}
									class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
									loading="lazy"
								/>
							</div>
						{/if}
						<div class="flex-1">
							<div
								class="flex flex-wrap items-center gap-3 text-xs font-semibold tracking-[0.2em] text-[#6d5c3e] uppercase"
							>
								<span>{formatDate(post.date)}</span>
								{#if post.tags?.length}
									<span class="h-1.5 w-1.5 rounded-full bg-[#6d5c3e]"></span>
									<span>{post.tags.join(' · ')}</span>
								{/if}
							</div>
							<h2 class="mt-4 text-2xl leading-tight font-semibold">{post.title}</h2>
							<p class="mt-3 text-base text-[#3f3a42]">{post.description}</p>
							<a
								href={resolve(`/blog/${post.slug}`)}
								class="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#111]"
							>
								Read the post
								<span class="text-lg">→</span>
							</a>
						</div>
					</div>
				</article>
			{/each}
		</div>
	</section>
</main>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap');

	:global(body) {
		font-family: 'Space Grotesk', 'Trebuchet MS', sans-serif;
	}
</style>
