/*
	Installed from github/simonhackler/svelte-file-explorer
*/

import { buildFileTree, type InputPath } from '$lib/components/file-browser/browser-utils/file-tree.svelte';
import type { Folder } from '$lib/components/file-browser/browser-utils/types.svelte';
import type { Adapter } from '../adapter';

/**
 * Adapter implementation for the Origin Private File System (OPFS).
 * Uses the File System API to read, write, copy, move, delete, and list files
 * in the browser's sandboxed OPFS storage.
 */
export class OPFSAdapter implements Adapter {
	private root: FileSystemDirectoryHandle;

	public constructor(root: FileSystemDirectoryHandle) {
		this.root = root;
	}

	static async create(): Promise<OPFSAdapter> {
		const root = await navigator.storage.getDirectory();
		return new OPFSAdapter(root);
	}

	/**
	 * Navigates a slash-delimited folder path, optionally creating directories.
	 */
	private async _getDirectoryHandle(
		path: string,
		create = false
	): Promise<FileSystemDirectoryHandle> {
		const parts = path.split('/').filter(Boolean);
		let dir: FileSystemDirectoryHandle = this.root;
		for (const part of parts) {
			dir = await dir.getDirectoryHandle(part, { create });
		}
		return dir;
	}

	private _splitPath(path: string): { parent: string; name: string } {
		const parts = path.split('/').filter(Boolean);
		const name = parts.pop()!;
		const parent = parts.join('/');
		return { parent, name };
	}

	async download(paths: string[]) {
		return await Promise.all(
			paths.map(async (path) => {
				try {
					const { parent, name } = this._splitPath(path);
					const dir = parent ? await this._getDirectoryHandle(parent) : this.root;
					const fileHandle = await dir.getFileHandle(name);
					const file = await fileHandle.getFile();
					return { result: { path, data: file }, error: null };
				} catch (error) {
					return { result: null, error: error as Error };
				}
			})
		);
	}

	async upload(file: File, fullFolderPath: string, overwrite = false): Promise<Error | null> {
		try {
			const folder = await this._getDirectoryHandle(fullFolderPath, true);
			if (!overwrite) {
				try {
					await folder.getFileHandle(file.name);
					return new Error(`File exists: ${fullFolderPath}${file.name}`);
				} catch {
					// File doesn't exist, OK to proceed
				}
			}
			const handle = await folder.getFileHandle(file.name, { create: true });
			const writable = await handle.createWritable();
			await writable.write(file);
			await writable.close();
			return null;
		} catch (error) {
			return error as Error;
		}
	}

	async copy(files: { filePath: string; path: string }[]): Promise<Error | null> {
		try {
			for (const { filePath, path } of files) {
				const { parent: srcParent, name: srcName } = this._splitPath(filePath);
				const srcDir = srcParent ? await this._getDirectoryHandle(srcParent) : this.root;
				const srcHandle = await srcDir.getFileHandle(srcName);
				const fileData = await srcHandle.getFile();

				const { parent: dstParent, name: dstName } = this._splitPath(path);
				const dstDir = await this._getDirectoryHandle(dstParent, true);
				const dstHandle = await dstDir.getFileHandle(dstName, { create: true });
				const writable = await dstHandle.createWritable();
				await writable.write(fileData);
				await writable.close();
			}
			return null;
		} catch (error) {
			return error as Error;
		}
	}

	async move(files: { filePath: string; path: string }[]): Promise<Error | null> {
		try {
			await this.copy(files);
			for (const { filePath } of files) {
				const { parent, name } = this._splitPath(filePath);
				const dir = parent ? await this._getDirectoryHandle(parent) : this.root;
				await dir.removeEntry(name);
			}
			return null;
		} catch (error) {
			return error as Error;
		}
	}

	async delete(paths: string[]): Promise<Error | null> {
		try {
			for (const path of paths) {
				const { parent, name } = this._splitPath(path);
				const dir = parent ? await this._getDirectoryHandle(parent) : this.root;
				await dir.removeEntry(name);
			}
			return null;
		} catch (error) {
			return error as Error;
		}
	}

	async getFolder(): Promise<{ result: Folder | null; error: Error | null }> {
		try {
			const filePathList: InputPath[] = [];

			const walk = async (dir: FileSystemDirectoryHandle, tokens: string[] = []): Promise<void> => {
				for await (const [name, handle] of dir.entries()) {
					const nextTokens = [...tokens, name];

					if (handle.kind === 'directory') {
						await walk(handle, nextTokens); // recurse into sub-folder
					} else {
						const file = await handle.getFile();
						filePathList.push({
							// I don't really like this "home" stuff, build tree skips the root folder and create it's own root folder for the new tree
							pathTokens: ['home', ...nextTokens],
							fileData: {
								size: file.size,
								mimetype: file.type || 'application/octet-stream',
								updatedAt: new Date(file.lastModified),
								blob: file,
								url: Promise.resolve(URL.createObjectURL(file))
							}
						});
					}
				}
			};

			await walk(this.root);

			const result = buildFileTree(filePathList);
			return { result, error: null };
		} catch (error) {
			return { result: null, error: error as Error };
		}
	}
}
