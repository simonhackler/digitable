import { env } from '$env/dynamic/public';

export const site = {
	name: 'Digitable Studio',
	tagline: 'Design notes, playtest stories, and product updates for Digitable Studio.',
	blogTitle: 'Digitable Studio Blog'
};

export const siteUrl = env.PUBLIC_SITE_URL ?? 'https://digitable.studio';
