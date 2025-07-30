import type { Adapter } from '$lib/components/file-browser/adapters/adapter';
import { getContext, setContext } from 'svelte';

const key = 'filesystem';

export function setFileSystemContext(fileSystem: { adapter: Adapter | null }) {
    setContext(key, fileSystem);
}

export function getFileSystemContext() {
    if (!getContext(key)) {
        throw new Error('File system context not set');
    }
    return getContext(key).adapter as Adapter;
}
