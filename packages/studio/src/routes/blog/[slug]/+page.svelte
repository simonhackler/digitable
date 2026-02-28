<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/Seo.svelte';
	import { formatDate } from '$lib/blog/format';
	import { site, siteUrl } from '$lib/blog/site';
	import type { PageProps } from './$types';

	let { data } = $props<PageProps>();

	const title = $derived.by(() => data.metadata.title);
	const description = $derived.by(() => data.metadata.description);
	const canonical = $derived.by(() => `${siteUrl}/blog/${data.slug}`);
	const ogImage = $derived.by(() =>
		data.metadata.ogImage ? `${siteUrl}${data.metadata.ogImage}` : undefined
	);
	const Post = $derived.by(() => data.component);

	const jsonLd = $derived.by(() => ({
		'@context': 'https://schema.org',
		'@type': 'BlogPosting',
		headline: title,
		description,
		datePublished: data.metadata.date,
		dateModified: data.metadata.date,
		url: canonical,
		author: {
			'@type': 'Organization',
			name: site.name
		},
		...(ogImage ? { image: ogImage } : {})
	}));
</script>

<Seo
	{title}
	{description}
	{canonical}
	openGraph={{
		title,
		description,
		url: canonical,
		siteName: site.name,
		type: 'article',
		images: ogImage ? [{ url: ogImage, alt: title }] : undefined
	}}
	{jsonLd}
/>

<main class="min-h-screen bg-[#f7f2ea] text-[#151515]">
	<article class="mx-auto max-w-3xl px-6 pt-14 pb-16">
		<a
			href={resolve('/blog')}
			class="text-xs font-semibold tracking-[0.3em] text-[#6e5b3a] uppercase"
		>
			← Back to blog
		</a>
		<h1 class="mt-4 text-4xl leading-tight font-semibold">{title}</h1>
		<p class="mt-4 text-lg text-[#4a424a]">{description}</p>
		<div
			class="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold tracking-[0.2em] text-[#6d5c3e] uppercase"
		>
			<span>{formatDate(data.metadata.date)}</span>
			{#if data.metadata.tags?.length}
				<span class="h-1.5 w-1.5 rounded-full bg-[#6d5c3e]"></span>
				<span>{data.metadata.tags.join(' · ')}</span>
			{/if}
		</div>
		<div class="mt-10 space-y-6 text-base leading-relaxed text-[#2d2d36]">
			<Post />
		</div>
	</article>
</main>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap');

	:global(body) {
		font-family: 'Space Grotesk', 'Trebuchet MS', sans-serif;
	}

	:global(.prose) {
		font-family: 'Newsreader', 'Times New Roman', serif;
	}
</style>
