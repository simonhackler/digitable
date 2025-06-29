/*
	Installed from github/simonhackler/svelte-file-explorer
*/

import type { FileFunctions, Folder } from '$lib/components/file-browser/browser-utils/types.svelte';

export interface Adapter extends FileFunctions {
	getRootFolder: () => Promise<{ result: Folder | null; error: Error | null }>;
}
