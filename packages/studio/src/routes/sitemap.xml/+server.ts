import * as sitemap from 'super-sitemap';
import type { RequestHandler } from './$types';
import { getAllPosts } from '$lib/blog/posts';
import { siteUrl } from '$lib/blog/site';

export const prerender = true;

export const GET: RequestHandler = async () => {
	const posts = await getAllPosts();

	return sitemap.response({
		origin: siteUrl,
		paramValues: {
			'/blog/[slug]': posts.map((post) => post.slug)
		}
	});
};
