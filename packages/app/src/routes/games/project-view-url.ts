export function projectViewHref(href: string, current: URL): string {
	const target = new URL(href, current);
	for (const key of ['checkpoint', 'baseline']) {
		const value = current.searchParams.get(key);
		if (value) target.searchParams.set(key, value);
	}
	return `${target.pathname}${target.search}`;
}
