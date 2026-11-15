import { tryAsync } from 'wellcrafted/result';
import { fsFailed, joinFsPath, type FsChanges, type FsDir, type FsWatchOptions } from './adapter';

export function includesFsPath(paths: readonly string[], path: string): boolean {
	return paths.some((parent) => path === parent || path.startsWith(`${parent}/`));
}

/** Metadata-only fallback for adapters/browsers without native observation. */
export async function pollDirectory(
	fs: FsDir,
	onChange: (paths: FsChanges) => void,
	options: FsWatchOptions = {}
): Promise<() => void> {
	async function snapshot(path = ''): Promise<Array<[string, string]>> {
		const entries = await fs.list(path || undefined);
		if (entries.error) throw new Error(entries.error.message);
		const files = await Promise.all(
			entries.data.map(async (entry): Promise<Array<[string, string]>> => {
				const child = joinFsPath(path, entry.name);
				if (includesFsPath(options.ignore ?? [], child)) return [];
				if (entry.kind === 'directory') return [[child, 'directory'], ...(await snapshot(child))];
				const file = await fs.read(child);
				if (file.error?.name === 'NotFoundError') return [];
				if (file.error) throw new Error(file.error.message);
				return [[child, `${file.data.lastModified}:${file.data.size}`]];
			})
		);
		return files.flat();
	}
	let previous: Map<string, string> | undefined;
	let stopped = false;
	let timer: ReturnType<typeof setTimeout>;
	async function poll() {
		const result = await tryAsync({ try: snapshot, catch: (cause) => fsFailed('watch', cause) });
		if (stopped) return;
		if (result.error) onChange(null);
		if (!result.error) {
			const current = new Map(result.data);
			const before = previous;
			const paths = before
				? [...new Set([...before.keys(), ...current.keys()])].filter(
						(path) => before.get(path) !== current.get(path)
					)
				: null;
			previous = current;
			// Bootstrap asynchronously; an unknown change covers the initial observation gap.
			if (paths === null || paths.length) onChange(paths);
		}
		if (!stopped) timer = setTimeout(poll, 2000);
	}
	const refresh = () => onChange(null);
	window.addEventListener('focus', refresh);
	timer = setTimeout(poll, 0);
	return () => {
		stopped = true;
		clearTimeout(timer);
		window.removeEventListener('focus', refresh);
	};
}

type ChangeRecord = {
	type: string;
	relativePathComponents: string[];
	relativePathMovedFrom?: string[];
};
type Observer = {
	observe(root: FileSystemDirectoryHandle, options: { recursive: boolean }): Promise<void>;
	disconnect(): void;
};

export async function observeDirectory(
	root: FileSystemDirectoryHandle,
	fs: FsDir,
	onChange: (paths: FsChanges) => void,
	options: FsWatchOptions = {}
): Promise<() => void> {
	const Constructor = (
		globalThis as typeof globalThis & {
			FileSystemObserver?: new (callback: (records: ChangeRecord[]) => void) => Observer;
		}
	).FileSystemObserver;
	if (!Constructor) return pollDirectory(fs, onChange, options);
	let stopped = false;
	let fallback: (() => void) | undefined;
	let failed = false;
	const observer = new Constructor((records) => {
		if (stopped || failed) return;
		if (records.some((record) => record.type === 'errored')) {
			failed = true;
			observer.disconnect();
			onChange(null);
			void pollDirectory(fs, onChange, options).then(
				(stop) => {
					if (stopped) return stop();
					fallback = stop;
					onChange(null);
				},
				() => {
					if (!stopped) onChange(null);
				}
			);
			return;
		}
		if (
			records.some((record) => record.type === 'unknown' || !record.relativePathComponents.length)
		) {
			onChange(null);
			return;
		}
		const paths = [
			...new Set(
				records.flatMap((record) => [
					record.relativePathComponents.join('/'),
					...(record.relativePathMovedFrom ? [record.relativePathMovedFrom.join('/')] : [])
				])
			)
		].filter((path) => !includesFsPath(options.ignore ?? [], path));
		if (paths.length) onChange(paths);
	});
	const observed = await tryAsync({
		try: () => observer.observe(root, { recursive: true }),
		catch: (cause) => fsFailed('watch', cause)
	});
	if (observed.error) {
		observer.disconnect();
		return pollDirectory(fs, onChange, options);
	}
	return () => {
		stopped = true;
		observer.disconnect();
		fallback?.();
	};
}
