import { env } from '$env/dynamic/public';

export const site = {
	name: 'Digitable blog',
	tagline: 'Product updates, roadmap updates and the occasional rambling on boardgame design.',
	blogTitle: 'Digitable Blog'
};

export const siteUrl = env.PUBLIC_SITE_URL ?? 'https://digitable.studio';
