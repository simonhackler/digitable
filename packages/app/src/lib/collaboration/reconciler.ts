import type { FsDir } from '$lib/components/file-browser/adapters/adapter';
import type { DocHandle, Repo } from '@automerge/automerge-repo';
import { componentDataMaterializer } from './component-data';
import { decodeText, encodeText, hashBytes, snapshotFile, writeFile } from './filesystem';
import { gameMetadataMaterializer } from './game-metadata';
import type { MemberMaterializer } from './materializer';
import {
	isBinaryFileDocument,
	type BinaryFileDocument,
	type ComponentDataDocument,
	type GameMetadataDocument,
	type TextFileDocument
} from './model';
import { textFileMaterializer } from './text-file';
import {
	materializedStatesEqual,
	readPendingMaterialization,
	readProjectConfig,
	removePendingMaterialization,
	writePendingMaterialization,
	writeProjectConfig,
	type MaterializedState,
	type ProjectConfig
} from './project-config';
import { withProjectLock } from './project-lock';

type MetadataMember = {
	id: string;
	path: string;
	handle: DocHandle<GameMetadataDocument>;
	materializer: MemberMaterializer<GameMetadataDocument>;
};

type ComponentDataMember = {
	id: string;
	path: string;
	handle: DocHandle<ComponentDataDocument>;
	materializer: MemberMaterializer<ComponentDataDocument>;
};

type TextMember = {
	id: string;
	path: string;
	handle: DocHandle<TextFileDocument>;
	materializer: MemberMaterializer<TextFileDocument>;
};

type BinaryMember = {
	id: string;
	path: string;
	handle: DocHandle<BinaryFileDocument>;
	hash: string;
};

export type ManagedMember = MetadataMember | ComponentDataMember | TextMember | BinaryMember;

export type ReconciliationStatus =
	| { state: 'idle' }
	| { state: 'syncing' }
	| { state: 'error'; memberId: string; path: string; message: string };

export function metadataMember(
	id: string,
	path: string,
	handle: DocHandle<GameMetadataDocument>
): ManagedMember {
	return { id, path, handle, materializer: gameMetadataMaterializer };
}

export function componentDataMember(
	id: string,
	path: string,
	handle: DocHandle<ComponentDataDocument>
): ManagedMember {
	return { id, path, handle, materializer: componentDataMaterializer };
}

export function textMember(
	id: string,
	path: string,
	kind: Parameters<typeof textFileMaterializer>[0],
	handle: DocHandle<TextFileDocument>
): ManagedMember {
	return { id, path, handle, materializer: textFileMaterializer(kind) };
}

export function binaryMember(
	id: string,
	path: string,
	hash: string,
	handle: DocHandle<BinaryFileDocument>
): ManagedMember {
	return { id, path, hash, handle };
}

export function importManagedTextMember(
	member: ManagedMember,
	projection: ProjectConfig['projections'][string],
	source: string,
	hash: string
): void {
	if (!('materializer' in member)) throw new Error(`${member.path} is not a text project member.`);
	if (member.materializer.kind === 'game-metadata') {
		importTyped(member as MetadataMember, projection, source, hash);
		return;
	}
	if (member.materializer.kind === 'component-data') {
		importTyped(member as ComponentDataMember, projection, source, hash);
		return;
	}
	importTyped(member as TextMember, projection, source, hash);
}

function importTyped<T extends object>(
	member: { handle: DocHandle<T>; materializer: MemberMaterializer<T>; path: string },
	projection: ProjectConfig['projections'][string],
	source: string,
	hash: string
): void {
	const incoming = member.materializer.parse(source, { hash });
	member.handle.changeAt(
		projection.heads,
		(document) => member.materializer.apply(document, incoming),
		{ message: `Write ${member.path}` }
	);
}

export function createProjectReconciler({
	fs,
	repo,
	initialConfig,
	members: initialMembers,
	onStatus = () => undefined,
	saveDebounceMs = 400
}: {
	fs: FsDir;
	repo: Repo;
	initialConfig: ProjectConfig;
	members: ManagedMember[];
	onStatus?: (status: ReconciliationStatus) => void;
	saveDebounceMs?: number;
}) {
	let config = initialConfig;
	let members = initialMembers;
	let dirty = false;
	const dirtyMemberIds = new Set<string>();
	let stopped = false;
	let runPromise: Promise<void> | undefined;
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let lastError: Error | undefined;
	const listeners = new Map<string, { member: ManagedMember; listener: () => void }>();

	function replaceMembers(nextMembers: ManagedMember[], nextConfig: ProjectConfig): void {
		const nextIds = new Set(nextMembers.map((member) => member.id));
		for (const [id, entry] of listeners) {
			const next = nextMembers.find((member) => member.id === id);
			if (next && next.handle === entry.member.handle) continue;
			entry.member.handle.off('change', entry.listener);
			listeners.delete(id);
		}
		members = nextMembers;
		config = nextConfig;
		if (stopped) return;
		for (const member of members) {
			if (listeners.has(member.id)) continue;
			const listener = () => scheduleReconcile(member.id);
			listeners.set(member.id, { member, listener });
			member.handle.on('change', listener);
		}
		for (const id of [...listeners.keys()]) {
			if (nextIds.has(id)) continue;
			listeners.delete(id);
		}
	}

	async function recoverMember(member: ManagedMember): Promise<void> {
		const pending = await readPendingMaterialization(fs, member.id);
		if (!pending) return;
		const projection = config.projections[member.id];
		if (!projection) {
			await removePendingMaterialization(fs, member.id);
			return;
		}
		const currentHash = (await snapshotFile(fs, pending.path))?.hash ?? null;
		if (materializedStatesEqual(projection, pending.before) && currentHash === pending.after.hash) {
			config = {
				...config,
				projections: {
					...config.projections,
					[member.id]: { ...projection, ...pending.after }
				}
			};
			await writeProjectConfig(fs, config);
		}
		await removePendingMaterialization(fs, member.id);
	}

	async function reconcileTyped<T extends object>(member: {
		id: string;
		path: string;
		handle: DocHandle<T>;
		materializer: MemberMaterializer<T>;
	}): Promise<void> {
		await recoverMember(member as ManagedMember);
		const projection = config.projections[member.id];
		if (!projection) throw new Error(`Missing projection configuration for ${member.id}.`);
		if (projection.path !== member.path || projection.url !== member.handle.url) {
			throw new Error(`Projection configuration does not match ${member.id}.`);
		}
		const projectedDocument = projection.materializeOnly
			? member.handle.doc()
			: member.handle.view(projection.heads).doc();
		if (!projectedDocument) {
			throw new Error(
				`Automerge document for ${member.path} has not loaded the projected heads yet.`
			);
		}

		const actual = await snapshotFile(fs, member.path);
		const actualHash = actual?.hash ?? null;
		if (
			!projection.materializeOnly &&
			materializedStatesEqual(
				{ heads: member.handle.heads(), hash: actualHash },
				{ heads: projection.heads, hash: projection.hash }
			)
		) {
			return;
		}
		if (!projection.materializeOnly && actual && actualHash !== projection.hash) {
			const incoming = member.materializer.parse(decodeText(actual.bytes), { hash: actual.hash });
			member.handle.changeAt(
				projection.heads,
				(document) => member.materializer.apply(document, incoming),
				{ message: `Import external ${member.path}` }
			);
		}

		const document = member.handle.doc();
		if (!document) throw new Error(`Automerge document for ${member.path} is unavailable.`);
		if (!member.materializer.isDocument(document)) {
			throw new Error(`Automerge document for ${member.path} has an unsupported format.`);
		}
		const desiredHeads = member.handle.heads();
		const desiredBytes = encodeText(member.materializer.serialize(document));
		const desiredHash = await hashBytes(desiredBytes);
		const desired: MaterializedState = { heads: desiredHeads, hash: desiredHash };
		await repo.flush([member.handle.documentId]);

		const beforeWriteHash = (await snapshotFile(fs, member.path))?.hash ?? null;
		if (beforeWriteHash !== actualHash) {
			dirty = true;
			dirtyMemberIds.add(member.id);
			return;
		}
		await writePendingMaterialization(fs, {
			version: 1,
			memberId: member.id,
			path: member.path,
			before: { heads: projection.heads, hash: projection.hash },
			after: desired
		});

		const revalidatedHash = (await snapshotFile(fs, member.path))?.hash ?? null;
		if (revalidatedHash !== actualHash) {
			await removePendingMaterialization(fs, member.id);
			dirty = true;
			dirtyMemberIds.add(member.id);
			return;
		}
		if (desiredHash !== actualHash) {
			await writeFile(fs, member.path, Uint8Array.from(desiredBytes).buffer);
			const writtenHash = (await snapshotFile(fs, member.path))?.hash ?? null;
			if (writtenHash !== desiredHash) {
				await removePendingMaterialization(fs, member.id);
				dirty = true;
				return;
			}
		}

		config = {
			...config,
			projections: {
				...config.projections,
				[member.id]: {
					path: projection.path,
					url: projection.url,
					...desired
				}
			}
		};
		await writeProjectConfig(fs, config);
		await removePendingMaterialization(fs, member.id);
	}

	async function reconcileMember(member: ManagedMember): Promise<void> {
		if ('materializer' in member) {
			if (member.materializer.kind === 'game-metadata') {
				await reconcileTyped(member as MetadataMember);
				return;
			}
			if (member.materializer.kind === 'component-data') {
				await reconcileTyped(member as ComponentDataMember);
				return;
			}
			await reconcileTyped(member as TextMember);
			return;
		}
		await recoverMember(member);
		const projection = config.projections[member.id];
		if (!projection) throw new Error(`Missing projection configuration for ${member.id}.`);
		if (projection.path !== member.path || projection.url !== member.handle.url) {
			throw new Error(`Projection configuration does not match ${member.id}.`);
		}
		const document = member.handle.doc();
		if (!isBinaryFileDocument(document)) {
			throw new Error(`Automerge binary document for ${member.path} is unavailable.`);
		}
		const desiredBytes = Uint8Array.from(document.content);
		const desiredHash = await hashBytes(desiredBytes);
		if (desiredHash !== member.hash) {
			throw new Error(`Automerge binary document for ${member.path} failed hash verification.`);
		}
		const actualHash = (await snapshotFile(fs, member.path))?.hash ?? null;
		const desired: MaterializedState = { heads: member.handle.heads(), hash: desiredHash };
		if (
			!projection.materializeOnly &&
			materializedStatesEqual(desired, projection) &&
			actualHash === desiredHash
		) {
			return;
		}
		await repo.flush([member.handle.documentId]);
		await writePendingMaterialization(fs, {
			version: 1,
			memberId: member.id,
			path: member.path,
			before: { heads: projection.heads, hash: projection.hash },
			after: desired
		});
		if (actualHash !== desiredHash) {
			await writeFile(fs, member.path, Uint8Array.from(desiredBytes).buffer);
			if ((await snapshotFile(fs, member.path))?.hash !== desiredHash) {
				throw new Error(`Could not verify materialized binary ${member.path}.`);
			}
		}
		config = {
			...config,
			projections: {
				...config.projections,
				[member.id]: {
					path: projection.path,
					url: projection.url,
					...desired
				}
			}
		};
		await writeProjectConfig(fs, config);
		await removePendingMaterialization(fs, member.id);
	}

	async function runUnlocked(): Promise<void> {
		onStatus({ state: 'syncing' });
		lastError = undefined;
		while (dirty && !stopped) {
			dirty = false;
			const ids = new Set(dirtyMemberIds);
			dirtyMemberIds.clear();
			for (const member of members) {
				if (ids.size && !ids.has(member.id)) continue;
				try {
					await reconcileMember(member);
				} catch (cause) {
					const error = cause instanceof Error ? cause : new Error(String(cause));
					lastError ??= error;
					onStatus({
						state: 'error',
						memberId: member.id,
						path: member.path,
						message: error.message
					});
				}
			}
		}
		if (!stopped && !lastError) onStatus({ state: 'idle' });
	}

	async function run(): Promise<void> {
		try {
			await withProjectLock(initialConfig.rootUrl, async () => {
				const latest = await readProjectConfig(fs);
				if (!latest || latest.rootUrl !== initialConfig.rootUrl) {
					throw new Error('Automerge project configuration changed while the project was open.');
				}
				config = latest;
				await runUnlocked();
			});
		} catch (cause) {
			dirty = false;
			lastError = cause instanceof Error ? cause : new Error(String(cause));
			onStatus({
				state: 'error',
				memberId: '$project',
				path: '.automerge/config.json',
				message: lastError.message
			});
		}
	}

	function requestReconcile(memberIds?: Iterable<string>): Promise<void> {
		if (stopped) return Promise.resolve();
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = undefined;
		dirty = true;
		if (memberIds) {
			for (const id of memberIds) dirtyMemberIds.add(id);
		} else {
			dirtyMemberIds.clear();
		}
		if (!runPromise) {
			runPromise = run().finally(() => {
				runPromise = undefined;
				if (dirty && !stopped) void requestReconcile();
			});
		}
		return runPromise;
	}

	function scheduleReconcile(memberId: string): void {
		if (stopped) return;
		onStatus({ state: 'syncing' });
		dirtyMemberIds.add(memberId);
		if (saveTimer) clearTimeout(saveTimer);
		if (saveDebounceMs <= 0) {
			void requestReconcile();
			return;
		}
		saveTimer = setTimeout(() => void requestReconcile(dirtyMemberIds), saveDebounceMs);
	}

	return {
		async start(reconcile = true): Promise<void> {
			replaceMembers(members, config);
			if (reconcile) {
				await requestReconcile();
				return;
			}
			onStatus({ state: 'idle' });
		},
		async reconcileOrThrow(): Promise<void> {
			if (saveTimer) {
				clearTimeout(saveTimer);
				saveTimer = undefined;
				dirty = true;
			}
			do {
				if (runPromise) await runPromise;
				if (dirty) await requestReconcile();
			} while (dirty && !stopped);
			if (lastError) throw lastError;
		},
		async stop(): Promise<void> {
			stopped = true;
			if (saveTimer) clearTimeout(saveTimer);
			saveTimer = undefined;
			for (const { member, listener } of listeners.values()) member.handle.off('change', listener);
			listeners.clear();
			await runPromise;
		},
		getConfig(): ProjectConfig {
			return config;
		},
		requestReconcile,
		replaceMembers
	};
}

export type ProjectReconciler = ReturnType<typeof createProjectReconciler>;
