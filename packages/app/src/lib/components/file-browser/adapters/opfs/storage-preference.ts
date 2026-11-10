import { del, get, set } from 'idb-keyval';

const SAVED_FOLDER_KEY = 'saved-folder';
const STORAGE_PREFERENCE_KEY = 'storage-preference';

export type StoragePreference = 'directory' | 'opfs' | 'dev-projects';

export async function saveFolderHandle(handle: FileSystemDirectoryHandle) {
	await set(SAVED_FOLDER_KEY, handle);
	await set(STORAGE_PREFERENCE_KEY, 'directory');
	localStorage.setItem(STORAGE_PREFERENCE_KEY, 'directory');
}

export async function loadFolderHandle() {
	const folder = await get(SAVED_FOLDER_KEY);
	return folder ? (folder as FileSystemDirectoryHandle) : null;
}

export async function saveOpfsPreference() {
	localStorage.setItem(STORAGE_PREFERENCE_KEY, 'opfs');
	await del(SAVED_FOLDER_KEY);
	await set(STORAGE_PREFERENCE_KEY, 'opfs');
}

export async function saveDevProjectsPreference() {
	localStorage.setItem(STORAGE_PREFERENCE_KEY, 'dev-projects');
	await del(SAVED_FOLDER_KEY);
	await set(STORAGE_PREFERENCE_KEY, 'dev-projects');
}

export async function loadStoragePreference(): Promise<StoragePreference | null> {
	const preference =
		(await get(STORAGE_PREFERENCE_KEY)) ?? localStorage.getItem(STORAGE_PREFERENCE_KEY);
	if (preference === 'directory' || preference === 'opfs' || preference === 'dev-projects') {
		return preference;
	}
	return null;
}
