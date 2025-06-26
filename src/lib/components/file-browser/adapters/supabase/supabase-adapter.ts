/*
	Installed from github/simonhackler/svelte-file-explorer
*/

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Adapter } from '../adapter';
import { buildFileTree } from '$lib/components/file-browser/browser-utils/file-tree.svelte';
import { getAllFilesMetadata } from './helper';

export class SupabaseAdapter implements Adapter {
	private supabase: SupabaseClient;
	private homePath: string;
	constructor(supabase: SupabaseClient, homePath: string) {
		this.supabase = supabase;
		this.homePath = homePath;
	}

	async download(paths: string[]) {
		const files = await Promise.all(
			paths.map(async (path) => {
				const { data, error } = await this.supabase.storage.from('folders').download(`${path}`);
				return { path, data, error };
			})
		);
		return files.map((file) => {
			return { result: { path: file.path, data: file.data! }, error: null };
		});
	}

	async upload(file: File, fullFolderPath: string, overwrite = false) {
		const filepath = `${this.homePath}/${fullFolderPath}/${file.name}`;
		if (!overwrite) {
			const { error } = await this.supabase.storage.from('folders').upload(filepath, file);
			if (error) {
				console.error(error);
				return error;
			}
		} else {
			const { error } = await this.supabase.storage.from('folders').update(filepath, file, {
				upsert: true
			});
			if (error) {
				console.error(error);
				return error;
			}
		}
		return null;
	}

	async move(files: { filePath: string; path: string }[]) {
		const results = await Promise.all(
			files.map(async (file) => {
				return this.supabase.storage.from('folders').move(file.filePath, file.path);
			})
		);
		for (const result of results) {
			if (result.error) {
				console.error(result.error);
			}
		}
		return null;
	}

	async copy(files: { filePath: string; path: string }[]) {
		const results = await Promise.all(
			files.map(async (file) => {
				console.log('copying file ' + file.filePath + ' to ' + file.path);
				return this.supabase.storage.from('folders').copy(file.filePath, file.path);
			})
		);
		for (const result of results) {
			if (result.error) {
				console.error(result.error);
			}
		}
		return null;
	}

	async delete(paths: string[]) {
		const { error } = await this.supabase.storage.from('folders').remove(paths);
		return error;
	}

	async getFolder() {
		const { data, error } = await getAllFilesMetadata(this.supabase, 'folders');
		if (error) {
			return { error: error, result: null };
		} else {
			return { result: buildFileTree(data), error: null };
		}
	}
}
