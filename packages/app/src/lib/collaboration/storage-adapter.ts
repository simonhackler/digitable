import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';
import type { Chunk, StorageAdapterInterface, StorageKey } from '@automerge/automerge-repo';
import { readFile, removeFile, writeFile } from './filesystem';
import { withProjectLock } from './project-lock';

export class FsDirStorageAdapter implements StorageAdapterInterface {
	private mutationTail: Promise<void> = Promise.resolve();

	constructor(
		private readonly root: FsDir,
		private readonly lockId = root.name
	) {}

	async load(key: StorageKey): Promise<Uint8Array | undefined> {
		validateKey(key);
		await this.mutationTail;
		return withProjectLock(`storage:${this.lockId}`, async () => {
			const file = await readFile(this.root, joinFsPath(...valuePath(key)));
			return file ? new Uint8Array(await file.arrayBuffer()) : undefined;
		});
	}

	save(key: StorageKey, data: Uint8Array): Promise<void> {
		const copy = data.slice();
		return this.enqueue(key, () => writeFile(this.root, joinFsPath(...valuePath(key)), copy));
	}

	remove(key: StorageKey): Promise<void> {
		return this.enqueue(key, () => removeFile(this.root, joinFsPath(...valuePath(key))));
	}

	async loadRange(keyPrefix: StorageKey): Promise<Chunk[]> {
		validateKey(keyPrefix);
		await this.mutationTail;
		return withProjectLock(`storage:${this.lockId}`, async () => {
			const prefix = physicalPrefix(keyPrefix);
			const directory = await this.root.openDir(joinFsPath(...prefix));
			if (directory.error?.name === 'NotFoundError') return [];
			if (directory.error) throw new Error(directory.error.message, { cause: directory.error });

			const files = await walkFiles(directory.data, prefix);
			return Promise.all(
				files.map(async ({ file, path }) => ({
					key: logicalKey(path),
					data: new Uint8Array(await file.arrayBuffer())
				}))
			);
		});
	}

	removeRange(keyPrefix: StorageKey): Promise<void> {
		return this.enqueue(keyPrefix, () =>
			removeFile(this.root, joinFsPath(...physicalPrefix(keyPrefix)), { recursive: true })
		);
	}

	async close(): Promise<void> {
		await this.mutationTail;
	}

	private enqueue(key: StorageKey, operation: () => Promise<void>): Promise<void> {
		validateKey(key);
		const current = this.mutationTail
			.catch(() => undefined)
			.then(() => withProjectLock(`storage:${this.lockId}`, operation));
		this.mutationTail = current.catch(() => undefined);
		return current;
	}
}

const VALUE_FILE = 'value';

function physicalPrefix(key: StorageKey): string[] {
	validateKey(key);
	const encoded = key.map(encodeKeyPart);
	return [encoded[0].slice(0, 2), ...encoded];
}

function valuePath(key: StorageKey): string[] {
	return [...physicalPrefix(key), VALUE_FILE];
}

function logicalKey(path: string[]): StorageKey {
	if (path.length < 3 || path.at(-1) !== VALUE_FILE) {
		throw new Error('Invalid Automerge storage path.');
	}
	return path.slice(1, -1).map(decodeKeyPart);
}

function validateKey(key: StorageKey): void {
	if (!key.length) throw new Error('Automerge storage keys cannot be empty.');
	for (const part of key) {
		if (!part || part === '.' || part === '..' || part.includes('/') || part.includes('\\')) {
			throw new Error(`Invalid Automerge storage key component: ${part}`);
		}
	}
}

async function walkFiles(
	directory: FsDir,
	path: string[]
): Promise<Array<{ file: File; path: string[] }>> {
	const listed = await directory.list();
	if (listed.error) throw new Error(listed.error.message, { cause: listed.error });

	const files: Array<{ file: File; path: string[] }> = [];
	for (const entry of listed.data) {
		const childPath = [...path, entry.name];
		if (entry.kind === 'directory') {
			const child = await directory.openDir(entry.name);
			if (child.error) throw new Error(child.error.message, { cause: child.error });
			files.push(...(await walkFiles(child.data, childPath)));
			continue;
		}

		if (entry.name !== VALUE_FILE) continue;
		const file = await directory.read(entry.name);
		if (file.error) throw new Error(file.error.message, { cause: file.error });
		files.push({ file: file.data, path: childPath });
	}
	return files;
}

function encodeKeyPart(value: string): string {
	return Array.from(new TextEncoder().encode(value), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
}

function decodeKeyPart(value: string): string {
	if (!value || value.length % 2 !== 0 || !/^[0-9a-f]+$/.test(value)) {
		throw new Error('Invalid encoded Automerge storage key.');
	}
	const bytes = Uint8Array.from(value.match(/../g) ?? [], (byte) => Number.parseInt(byte, 16));
	return new TextDecoder().decode(bytes);
}
