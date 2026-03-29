<script lang="ts">
	import { JsonLd, MetaTags } from 'svelte-meta-tags';

	type OpenGraph = {
		type?: string;
		title?: string;
		description?: string;
		url?: string;
		siteName?: string;
		images?: { url: string; width?: number; height?: number; alt?: string }[];
	};

	type Twitter = {
		cardType?: 'summary' | 'summary_large_image' | 'app' | 'player';
		site?: string;
		handle?: string;
		title?: string;
		description?: string;
		image?: string;
	};

	let {
		title,
		description,
		canonical,
		openGraph = {},
		twitter = {},
		jsonLd
	} = $props<{
		title: string;
		description: string;
		canonical: string;
		openGraph?: OpenGraph;
		twitter?: Twitter;
		jsonLd?: Record<string, unknown>;
	}>();

	const metaOpenGraph = $derived.by(() => ({
		type: 'website',
		title,
		description,
		url: canonical,
		...openGraph
	}));

	const metaTwitter = $derived.by(() => ({
		cardType: 'summary_large_image',
		title,
		description,
		...twitter
	}));
</script>

<MetaTags {title} {description} {canonical} openGraph={metaOpenGraph} twitter={metaTwitter} />

{#if jsonLd}
	<JsonLd schema={jsonLd} />
{/if}
