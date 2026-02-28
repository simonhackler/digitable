import type { PageLoad } from './$types';
import { getAllPosts } from '$lib/blog/posts';

export const prerender = true;

export const load: PageLoad = async () => {
	return {
		posts: await getAllPosts()
	};
};
