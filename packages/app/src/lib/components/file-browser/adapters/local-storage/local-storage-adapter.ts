/*
	Installed from github/simonhackler/svelte-file-explorer
*/

import type { Adapter } from '../adapter';
import {
	buildTreeFromLocalStorage,
	parseStoredFileData
} from '$lib/components/file-browser/browser-utils/file-tree.svelte';
import type { Folder } from '$lib/components/file-browser/browser-utils/types.svelte';

export class LocalStorageAdapter implements Adapter {
	private homePath: string;
	private rootFolder: Folder | null = null;

	constructor(homePath: string) {
		this.homePath = homePath;
	}

	private keyFor(path: string): string {
		return `${path}`;
	}

	private async fileToDataURL(file: File): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	async download(paths: string[]) {
		const results = await Promise.all(
			paths.map(async (path) => {
				try {
					const dataURL = localStorage.getItem(this.keyFor(path));
					if (!dataURL) {
						return { result: null, error: new Error(`File not found: ${path}`) };
					}

					const fileData = await parseStoredFileData(dataURL);
					const blob = fileData.blob || (await fetch(dataURL).then((r) => r.blob()));
					if (!blob) {
						throw Error("couldn't parse data file");
					}

					return { result: { path, data: blob }, error: null };
				} catch (error) {
					return { result: null, error: error as Error };
				}
			})
		);

		return results;
	}

	async upload(file: File, fullFolderPath: string, overwrite = false): Promise<Error | null> {
		const key = this.keyFor(`${this.homePath}/${fullFolderPath}${file.name}`);

		if (!overwrite && localStorage.getItem(key)) {
			return new Error(`File exists: ${key}`);
		}

		try {
			const dataURL = await this.fileToDataURL(file);
			const payload = {
				dataURL,
				size: file.size,
				mimetype: file.type || 'application/octet-stream',
				updatedAt: Date.now()
			};

			localStorage.setItem(key, JSON.stringify(payload));
			return null;
		} catch (error) {
			return error as Error;
		}
	}

	async move(files: { filePath: string; path: string }[]): Promise<Error | null> {
		try {
			for (const file of files) {
				const sourceKey = this.keyFor(file.filePath);
				const dataURL = localStorage.getItem(sourceKey);
				if (!dataURL) continue;

				const destKey = this.keyFor(file.path);
				localStorage.setItem(destKey, dataURL);
				localStorage.removeItem(sourceKey);
			}
			return null;
		} catch (error) {
			return error as Error;
		}
	}

	async copy(files: { filePath: string; path: string }[]): Promise<Error | null> {
		try {
			for (const file of files) {
				const sourceKey = this.keyFor(file.filePath);
				const dataURL = localStorage.getItem(sourceKey);
				if (!dataURL) continue;

				const destKey = this.keyFor(file.path);
				localStorage.setItem(destKey, dataURL);
			}
			return null;
		} catch (error) {
			return error as Error;
		}
	}

	async delete(paths: string[]): Promise<Error | null> {
		try {
			paths.forEach((path) => localStorage.removeItem(this.keyFor(path)));
			return null;
		} catch (error) {
			return error as Error;
		}
	}

	async getRootFolder() {
		if (this.rootFolder) {
			return { result: this.rootFolder, error: null };
		}
		try {
			const tree = await buildTreeFromLocalStorage(this.homePath);
			this.rootFolder = tree;
			return { result: tree, error: null };
		} catch (error) {
			return { result: null, error: error as Error };
		}
	}
}
