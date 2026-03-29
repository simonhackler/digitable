export type PostMeta = {
	title: string;
	description: string;
	date: string;
	tags?: string[];
	ogImage?: string;
	draft?: boolean;
};

export type PostListItem = PostMeta & {
	slug: string;
};

export type PostDetail = {
	slug: string;
	metadata: PostMeta;
	component: unknown;
};

const postModules = import.meta.glob('/src/lib/content/blog/*.svx');

const getSlug = (path: string) => path.split('/').pop()?.replace('.svx', '') ?? '';

export const getAllPosts = async (): Promise<PostListItem[]> => {
	const entries = await Promise.all(
		Object.entries(postModules).map(async ([path, resolver]) => {
			const mod = (await resolver()) as { metadata: PostMeta };
			return {
				...mod.metadata,
				slug: getSlug(path)
			};
		})
	);

	return entries
		.filter((entry) => !entry.draft)
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getPost = async (slug: string): Promise<PostDetail | null> => {
	const resolver = postModules[`/src/lib/content/blog/${slug}.svx`];

	if (!resolver) {
		return null;
	}

	const mod = (await resolver()) as { default: unknown; metadata: PostMeta };

	return {
		slug,
		metadata: mod.metadata,
		component: mod.default
	};
};
