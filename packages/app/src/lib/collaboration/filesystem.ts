import type { FsDir, FsWriteData } from '$lib/components/file-browser/adapters/adapter';
import { blake3 } from '@noble/hashes/blake3.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type FileSnapshot = {
	bytes: Uint8Array;
	hash: string;
	lastModified: number;
	size: number;
};

export async function readFile(fs: FsDir, path: string): Promise<File | undefined> {
	const result = await fs.read(path);
	if (!result.error) return result.data;
	if (result.error.name === 'NotFoundError') return undefined;
	throw new Error(result.error.message, { cause: result.error });
}

export async function readText(fs: FsDir, path: string): Promise<string | undefined> {
	const result = await fs.readText(path);
	if (!result.error) return result.data;
	if (result.error.name === 'NotFoundError') return undefined;
	throw new Error(result.error.message, { cause: result.error });
}

export async function writeFile(fs: FsDir, path: string, data: FsWriteData): Promise<void> {
	const result = await fs.write(path, data);
	if (result.error) throw new Error(result.error.message, { cause: result.error });
}

export async function removeFile(
	fs: FsDir,
	path: string,
	options?: { recursive?: boolean }
): Promise<void> {
	const result = await fs.remove(path, options);
	if (!result.error || result.error.name === 'NotFoundError') return;
	throw new Error(result.error.message, { cause: result.error });
}

export async function snapshotFile(fs: FsDir, path: string): Promise<FileSnapshot | undefined> {
	const file = await readFile(fs, path);
	if (!file) return undefined;
	const bytes = new Uint8Array(await file.arrayBuffer());
	return {
		bytes,
		hash: await hashBytes(bytes),
		lastModified: file.lastModified,
		size: file.size
	};
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
	return bytesToHex(blake3(bytes));
}

export function encodeText(value: string): Uint8Array {
	return encoder.encode(value);
}

export function decodeText(value: Uint8Array): string {
	return decoder.decode(value);
}
