import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageLoad } from './$types';
import { getAllPosts, getPost } from '$lib/blog/posts';

export const prerender = true;

export const entries: EntryGenerator = async () => {
	const posts = await getAllPosts();
	return posts.map((post) => ({ slug: post.slug }));
};

export const load: PageLoad = async ({ params }) => {
	const post = await getPost(params.slug);

	if (!post) {
		error(404, 'Post not found');
	}

	return post;
};
