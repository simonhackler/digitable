import { Feed } from 'feed';
import type { RequestHandler } from './$types';
import { getAllPosts } from '$lib/blog/posts';
import { site, siteUrl } from '$lib/blog/site';

export const prerender = true;

export const GET: RequestHandler = async () => {
	const posts = await getAllPosts();
	const feed = new Feed({
		title: site.blogTitle,
		description: site.tagline,
		id: `${siteUrl}/blog`,
		link: `${siteUrl}/blog`,
		language: 'en',
		favicon: `${siteUrl}/favicon.svg`,
		updated: posts.length ? new Date(posts[0].date) : new Date(),
		author: {
			name: site.name
		}
	});

	posts.forEach((post) => {
		feed.addItem({
			title: post.title,
			id: `${siteUrl}/blog/${post.slug}`,
			link: `${siteUrl}/blog/${post.slug}`,
			description: post.description,
			date: new Date(post.date)
		});
	});

	return new Response(feed.rss2(), {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8'
		}
	});
};
