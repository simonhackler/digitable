import type { FsChanges, FsDir } from '$lib/components/file-browser/adapters/adapter';
import { createProjectLoader } from './project-loader';
import type { ProjectDependencies, RequiredDocuments } from './dependencies';
import { includesFsPath, pollDirectory } from '$lib/components/file-browser/adapters/watch';
import {
	Repo,
	type AutomergeUrl,
	type Doc,
	type DocHandle,
	type NetworkAdapterInterface,
	type UrlHeads
} from '@automerge/automerge-repo';
import { BroadcastChannelNetworkAdapter } from '@automerge/automerge-repo-network-broadcastchannel';
import { createProjectPresence, type ProjectPresence } from './project-presence';
import {
	createProjectSvgInteractions,
	type ProjectSvgInteractions
} from './project-svg-interactions';
import { defineErrors, extractErrorMessage, type InferErrors } from 'wellcrafted/error';
import { tryAsync, type Result } from 'wellcrafted/result';
import {
	createProjectGraph,
	createProjectMemberHandle,
	isProjectMemberDocument,
	resolveProjectGraph,
	resolveProjectGraphAtCheckpoint,
	type ProjectGraph
} from './project-graph';
import {
	AUTOMERGE_STORAGE_DIR,
	PENDING_BOOTSTRAP_FILE,
	readPendingBootstrap,
	readPendingJoin,
	readProjectConfig,
	removePendingBootstrap,
	removePendingJoin,
	writePendingBootstrap,
	writePendingJoin,
	writeProjectConfig,
	type ProjectConfig
} from './project-config';
import {
	createProjectReconciler,
	managedMember,
	type ManagedMember,
	type ReconciliationStatus
} from './reconciler';
import { encodeText, hashBytes, readFile, snapshotFile } from './filesystem';
import { FsDirStorageAdapter } from './storage-adapter';
import { withProjectLock } from './project-lock';
import {
	GAME_METADATA_MEMBER_ID,
	isProjectHistoryDocument,
	type GameMetadataDocument,
	type ProjectBranchId,
	type ProjectCheckpointId,
	type ProjectHistoryDocument,
	type ProjectInputPath,
	type ProjectMemberDocument,
	type ProjectMemberDocumentFor,
	type ProjectMemberKind,
	type ProjectMemberPathFor
} from './model';
import type { ProjectMergePlan, ProjectMergeResolution } from './project-merge';
import {
	classifyProjectFile,
	projectComponentId,
	projectMemberId,
	projectFileSource,
	scanProjectFiles,
	walkKnownFiles,
	type ProjectFileSource
} from './project-files';
import {
	checkoutProjectBranch,
	commitProjectMerge,
	createProjectHistory,
	deleteProjectBranch,
	forkProjectCheckpoint,
	prepareProjectMerge,
	recordProjectCheckpoint,
	renameProjectBranch,
	resolveBranchGraph
} from './project-history';
import {
	applyProjectMemberBytes,
	projectMemberCodec,
	seedProjectMember
} from './project-member-codec';

const CollaborationError = defineErrors({
	ProjectOpenFailed: ({ project, cause }: { project: string; cause: unknown }) => ({
		message: `Could not open Automerge project "${project}": ${extractErrorMessage(cause)}`,
		project,
		cause
	}),
	SynchronizationFailed: ({ project, cause }: { project: string; cause: unknown }) => ({
		message: `Could not synchronize Automerge project "${project}": ${extractErrorMessage(cause)}`,
		project,
		cause
	}),
	ProjectCloseFailed: ({ project, cause }: { project: string; cause: unknown }) => ({
		message: `Could not close Automerge project "${project}": ${extractErrorMessage(cause)}`,
		project,
		cause
	})
});
export type CollaborationError = InferErrors<typeof CollaborationError>;

export type ProjectMemberRef<K extends ProjectMemberKind> = {
	id: string;
	kind: K;
	path: ProjectMemberPathFor<K>;
	componentId?: string;
	handle: DocHandle<ProjectMemberDocumentFor<K>>;
};

export type ProjectSnapshotMember<K extends ProjectMemberKind> = {
	id: string;
	kind: K;
	path: ProjectMemberPathFor<K>;
	componentId?: string;
	heads: UrlHeads;
	document: Doc<ProjectMemberDocumentFor<K>>;
};

export type ProjectSnapshot = {
	rootUrl: AutomergeUrl;
	rootHeads: UrlHeads;
	components: ReadonlyArray<{ id: string; name: string }>;
	member<K extends ProjectMemberKind>(
		kind: K,
		path: ProjectMemberPathFor<K>
	): ProjectSnapshotMember<K> | undefined;
	members<K extends ProjectMemberKind>(kind: K): ProjectSnapshotMember<K>[];
};

export type ProjectInputData = string | Blob | ArrayBuffer | ArrayBufferView;
export type ProjectInput = { path: ProjectInputPath; data: ProjectInputData };

export type ProjectSession = {
	name: string;
	rootUrl: AutomergeUrl;
	historyUrl: AutomergeUrl;
	branchId: ProjectBranchId;
	readOnly: boolean;
	canEditStructure: boolean;
	require<D extends ProjectDependencies>(dependencies: D): Promise<RequiredDocuments<D>>;
	releasePage(): void;
	components(): ReadonlyArray<{ id: string; name: string }>;
	member<K extends ProjectMemberKind>(
		kind: K,
		path: ProjectMemberPathFor<K>
	): ProjectMemberRef<K> | undefined;
	members<K extends ProjectMemberKind>(kind: K): ProjectMemberRef<K>[];
	subscribeInventory(listener: () => void): () => void;
	snapshot(): Promise<Result<ProjectSnapshot, CollaborationError>>;
	put(
		input: ProjectInput | ProjectInput[],
		options?: { message?: string }
	): Promise<Result<void, CollaborationError>>;
	remove(
		path: ProjectInputPath | ProjectInputPath[],
		options?: { message?: string }
	): Promise<Result<void, CollaborationError>>;
	metadataHandle: DocHandle<GameMetadataDocument>;
	presence: ProjectPresence;
	svgInteractions: ProjectSvgInteractions;
	getHistory(): ProjectHistoryDocument;
	subscribeHistory(listener: (history: ProjectHistoryDocument) => void): () => void;
	createCheckpoint(message?: string): Promise<Result<ProjectCheckpointId, CollaborationError>>;
	forkFromCheckpoint(
		checkpointId: ProjectCheckpointId,
		name: string
	): Promise<Result<ProjectBranchId, CollaborationError>>;
	checkoutBranch(branchId: ProjectBranchId): Promise<Result<void, CollaborationError>>;
	renameBranch(branchId: ProjectBranchId, name: string): Promise<Result<void, CollaborationError>>;
	deleteBranch(branchId: ProjectBranchId): Promise<Result<void, CollaborationError>>;
	prepareMergeToParent(): Promise<Result<ProjectMergePlan, CollaborationError>>;
	commitMergeToParent(
		planId: string,
		resolutions: ProjectMergeResolution[]
	): Promise<Result<ProjectCheckpointId, CollaborationError>>;
	renameComponent(oldName: string, newName: string): Promise<Result<void, CollaborationError>>;
	deleteComponent(name: string): Promise<Result<void, CollaborationError>>;
	sync(): Promise<Result<void, CollaborationError>>;
	close(): Promise<Result<void, CollaborationError>>;
};

export type OpenProjectSessionOptions = {
	network?: NetworkAdapterInterface[];
	joinHistoryUrl?: AutomergeUrl;
	onStatus?: (status: ReconciliationStatus) => void;
	onBackground?: (status: { state: 'loading' | 'idle' | 'error'; message?: string }) => void;
	initial?: ProjectInput[];
	saveDebounceMs?: number;
	checkpointId?: ProjectCheckpointId;
	onBranchCheckout?: (branchId: ProjectBranchId) => void;
};

function graphMember<K extends ProjectMemberKind>(
	graph: ProjectGraph,
	kind: K,
	path: ProjectMemberPathFor<K>
): ProjectMemberRef<K> | undefined {
	const entry = Object.entries(graph.project.members).find(
		([, member]) => member.kind === kind && member.path === path
	);
	if (!entry) return undefined;
	const handle = graph.memberHandles.get(entry[0]);
	if (!handle || !projectMemberCodec(kind).isDocument(handle.doc())) return undefined;
	return {
		id: entry[0],
		kind,
		path,
		...(entry[1].componentId ? { componentId: entry[1].componentId } : {}),
		handle: handle as DocHandle<ProjectMemberDocumentFor<K>>
	};
}

function graphMembers<K extends ProjectMemberKind>(
	graph: ProjectGraph,
	kind: K
): ProjectMemberRef<K>[] {
	return Object.values(graph.project.members)
		.filter((member) => member.kind === kind)
		.flatMap((member) => {
			const ref = graphMember(graph, kind, member.path as ProjectMemberPathFor<K>);
			return ref ? [ref] : [];
		});
}

function snapshotGraph(graph: ProjectGraph): ProjectSnapshot {
	const rootHeads = [...graph.projectHandle.heads()] as UrlHeads;
	const root = graph.projectHandle.view(rootHeads).doc();
	if (!root) throw new Error('The Automerge project root is unavailable.');
	const members = Object.entries(root.members).map(([id, member]) => {
		const source = graph.memberHandles.get(id);
		if (!source) throw new Error(`Automerge project member ${member.path} is unavailable.`);
		const heads = [...source.heads()] as UrlHeads;
		const document = source.view(heads).doc();
		if (!document || !projectMemberCodec(member.kind).isDocument(document)) {
			throw new Error(`Automerge project member ${member.path} has an unsupported format.`);
		}
		return {
			id,
			kind: member.kind,
			path: member.path,
			...(member.componentId ? { componentId: member.componentId } : {}),
			heads,
			document
		};
	});
	return {
		rootUrl: graph.projectHandle.url,
		rootHeads,
		components: Object.entries(root.components).map(([id, component]) => ({
			id,
			name: component.name
		})),
		member(kind, path) {
			return members.find((member) => member.kind === kind && member.path === path) as
				| ProjectSnapshotMember<typeof kind>
				| undefined;
		},
		members(kind) {
			return members.filter((member) => member.kind === kind) as ProjectSnapshotMember<
				typeof kind
			>[];
		}
	};
}

async function inputBytes(data: ProjectInputData): Promise<Uint8Array> {
	if (typeof data === 'string') return encodeText(data);
	if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
}

/** Creates authoritative documents first; the normal reconciler materializes their files. */
export async function createProject(
	project: FsDir,
	inputs: ProjectInput[]
): Promise<Result<void, CollaborationError>> {
	const initial = inputs.some((input) => input.path === 'rules.md')
		? inputs
		: [...inputs, { path: 'rules.md' as const, data: '' }];
	const opened = await openProjectSession(project, { initial, saveDebounceMs: 0 });
	if (opened.error) return opened;
	return opened.data.close();
}

export async function openProjectSession(
	project: FsDir,
	options: OpenProjectSessionOptions = {}
): Promise<Result<ProjectSession, CollaborationError>> {
	let repo: Repo | undefined;
	let stopWatching: (() => void) | undefined;
	const opened = await tryAsync({
		try: async () => {
			const storage = await project.ensureDir(AUTOMERGE_STORAGE_DIR);
			if (storage.error) throw new Error(storage.error.message, { cause: storage.error });
			const storageEntries = await storage.data.list();
			if (storageEntries.error) {
				throw new Error(storageEntries.error.message, { cause: storageEntries.error });
			}
			const hadStoredData = storageEntries.data.length > 0;
			const pendingPaths = new Set<string>();
			const checked = new Map<string, string>();
			const revisions = new Map<string, number>();
			let revision = 0;
			let unknownRevision = 0;
			function fileRevision(path: string): number {
				let latest = unknownRevision;
				const parts = path.split('/');
				for (let index = 1; index <= parts.length; index++)
					latest = Math.max(latest, revisions.get(parts.slice(0, index).join('/')) ?? 0);
				return latest;
			}
			let rescan = hadStoredData;
			let wake: (() => void) | undefined;
			const changed = (paths: FsChanges) => {
				revision += 1;
				for (const path of checked.keys())
					if (paths === null || includesFsPath(paths, path)) checked.delete(path);
				if (paths === null) {
					rescan = true;
					unknownRevision = revision;
				}
				for (const path of paths ?? []) {
					if (path.split('/').some((part) => part.startsWith('.'))) continue;
					if (
						classifyProjectFile(path) ||
						['components', 'assets', 'feedback', 'setup'].some(
							(root) => path === root || path.startsWith(`${root}/`)
						)
					) {
						pendingPaths.add(path);
						revisions.set(path, revision);
					}
				}
				if (rescan || pendingPaths.size) wake?.();
			};
			if (!options.checkpointId) {
				const observation = { ignore: ['.automerge', 'tts-export'] };
				if (project.watch) {
					const watched = await project.watch(changed, observation);
					if (watched.error) throw new Error(watched.error.message);
					stopWatching = watched.data;
				} else {
					stopWatching = await pollDirectory(project, changed, observation);
				}
			}
			const projectRepo = new Repo({
				storage: new FsDirStorageAdapter(storage.data, project.name),
				network: options.network ?? [new BroadcastChannelNetworkAdapter()],
				saveDebounceRate: options.saveDebounceMs
			});
			repo = projectRepo;

			let imported: ProjectGraph | undefined;
			const restored = await withProjectLock(`bootstrap:${project.name}`, () =>
				restoreOrCreateProject(
					project,
					projectRepo,
					hadStoredData,
					options.joinHistoryUrl,
					options.initial,
					(graph) => {
						imported = graph;
					}
				)
			);
			const historyHandle = await projectRepo.find<ProjectHistoryDocument>(restored.historyUrl);
			if (!isProjectHistoryDocument(historyHandle.doc())) {
				throw new Error('The Automerge project history document is invalid.');
			}
			const lockId = restored.historyUrl;
			if (options.checkpointId) {
				const branchId = historyHandle.doc()!.checkedOutBranchId;
				const checkpoint = historyHandle.doc()?.checkpoints[options.checkpointId];
				if (!checkpoint || checkpoint.branchId !== branchId) {
					throw new Error('The selected checkpoint does not belong to the checked-out branch.');
				}
				const checkpointGraph = await resolveProjectGraphAtCheckpoint(
					projectRepo,
					checkpoint,
					true
				);
				return createHistoricalProjectSession({
					project,
					repo: projectRepo,
					historyHandle,
					branchId,
					graph: checkpointGraph,
					options
				});
			}
			const activeBranch = await resolveBranchGraph(projectRepo, historyHandle, undefined, true);
			const branchId = activeBranch.branchId;
			const rootHandle = activeBranch.graph.projectHandle;
			// A branch checkout replaces the working tree. Finish that transaction before publishing
			// the new session, so background materialization cannot overwrite a subsequent external edit.
			const checkingOut = restored.branchId !== branchId || restored.rootUrl !== rootHandle.url;
			const branchConfig: ProjectConfig = {
				...restored,
				version: 3,
				branchId,
				rootUrl: rootHandle.url
			};
			const openedGraph = await withProjectLock(lockId, async () => {
				const latestConfig = await readProjectConfig(project);
				if (
					latestConfig?.branchId === branchId &&
					latestConfig.rootUrl === rootHandle.url &&
					latestConfig.rootHeads
				) {
					await waitForRootHeads(rootHandle, latestConfig.rootHeads);
				}
				let graph = imported?.projectHandle.url === rootHandle.url ? imported : activeBranch.graph;
				if (checkingOut) graph = await resolveProjectGraph(projectRepo, rootHandle);
				const ensured = await ensureRulesDocument(
					project,
					projectRepo,
					graph,
					latestConfig?.branchId === branchId ? latestConfig : branchConfig
				);
				graph = ensured.graph;
				const repaired = await repairProjectConfig(
					project,
					graph,
					ensured.config.branchId === branchId ? ensured.config : branchConfig
				);
				return { graph, repaired };
			});
			let graph = openedGraph.graph;
			const repaired = openedGraph.repaired;
			let config = repaired.config;
			let closed = false;
			let closePromise: Promise<Result<void, CollaborationError>> | undefined;
			let checkpointTimer: ReturnType<typeof setTimeout> | undefined;
			let checkpointPromise: Promise<void> | undefined;
			let checkpointDirty = false;
			let checkpointPaused = false;
			const inventoryListeners = new Set<() => void>();
			const notifyInventory = () => {
				for (const listener of inventoryListeners) listener();
			};
			const checkpointListeners = new Map<DocHandle<unknown>, () => void>();
			function replaceCheckpointListeners(): void {
				const handles: DocHandle<unknown>[] = [
					graph.projectHandle,
					...graph.memberHandles.values()
				];
				for (const [handle, listener] of checkpointListeners) {
					if (handles.includes(handle)) continue;
					handle.off('change', listener);
					checkpointListeners.delete(handle);
				}
				for (const handle of handles) {
					if (checkpointListeners.has(handle)) continue;
					const listener = () => {
						for (const member of Object.values(graph.project.members))
							if (member.url === handle.url) checked.delete(member.path);
						scheduleCheckpoint();
					};
					checkpointListeners.set(handle, listener);
					handle.on('change', listener);
				}
			}
			function scheduleCheckpoint(): void {
				if (closed || historyHandle.doc()?.checkedOutBranchId !== branchId) return;
				if (checkpointPaused || checkpointPromise) {
					checkpointDirty = true;
					return;
				}
				if (checkpointTimer) clearTimeout(checkpointTimer);
				checkpointTimer = setTimeout(() => {
					checkpointTimer = undefined;
					void recordCheckpoint().catch((cause) => {
						options.onStatus?.({
							state: 'error',
							scope: 'checkpoint',
							path: '.automerge/history',
							message: cause instanceof Error ? cause.message : String(cause)
						});
					});
				}, 750);
			}
			function recordCheckpoint(): Promise<void> {
				if (closed || historyHandle.doc()?.checkedOutBranchId !== branchId)
					return Promise.resolve();
				if (checkpointPromise) {
					checkpointDirty = true;
					return checkpointPromise;
				}
				checkpointDirty = false;
				checkpointPromise = (async () => {
					await synchronize();
					await recordProjectCheckpoint(projectRepo, historyHandle, branchId, graph);
				})().finally(() => {
					checkpointPromise = undefined;
					if (checkpointDirty) scheduleCheckpoint();
				});
				return checkpointPromise;
			}
			const members = managedMembers(graph, config);
			const reconciler = createProjectReconciler({
				fs: project,
				repo: projectRepo,
				initialConfig: config,
				members,
				onExternalChange: changed,
				onStatus: (status) => {
					const nextBranchId = historyHandle.doc()?.checkedOutBranchId;
					if (status.state === 'error' && nextBranchId && nextBranchId !== branchId) {
						options.onBranchCheckout?.(nextBranchId);
						return;
					}
					options.onStatus?.(status);
				},
				saveDebounceMs: options.saveDebounceMs
			});
			const handles = new Map<string, Promise<DocHandle<ProjectMemberDocument>>>();
			const loader = createProjectLoader(async (path) => {
				const started = fileRevision(path);
				const inventory = graph.project;
				// File reads and document loading happen outside the project lock.
				const listed = path === '@components' ? await project.list('components') : undefined;
				if (listed?.error && listed.error.name !== 'NotFoundError')
					throw new Error(listed.error.message);
				const scanned = listed
					? {
							files: [],
							scope: [],
							components: listed.error
								? []
								: listed.data
										.filter((entry) => entry.kind === 'directory')
										.map((entry) => entry.name)
						}
					: await scanProjectFiles(project, [path]);
				const entry = Object.entries(graph.projectHandle.doc()!.members).find(
					([, member]) => member.path === path
				);
				const loaded = new Map<string, DocHandle<ProjectMemberDocument>>();
				if (entry) {
					const [id, member] = entry;
					let promise = handles.get(member.url);
					if (!promise) {
						promise = projectRepo.find<ProjectMemberDocument>(member.url);
						handles.set(member.url, promise);
						void promise.catch(() => handles.delete(member.url));
					}
					loaded.set(id, await promise);
				}
				await withProjectLock(lockId, async () => {
					if (historyHandle.doc()?.checkedOutBranchId !== branchId)
						throw new Error('The checked-out project branch changed.');
					const latestConfig = await readProjectConfig(project);
					if (latestConfig?.rootHeads)
						await waitForRootHeads(graph.projectHandle, latestConfig.rootHeads);
					graph = await resolveProjectGraph(
						projectRepo,
						graph.projectHandle,
						new Map([...graph.memberHandles, ...loaded])
					);
					const refreshed = await refreshProjectInventory(
						project,
						projectRepo,
						graph,
						latestConfig?.branchId === branchId ? latestConfig : reconciler.getConfig(),
						scanned
					);
					graph = refreshed.graph;
					config = refreshed.config;
					await reconciler.removePathsWhileLocked(refreshed.removedPaths);
					replaceCheckpointListeners();
					reconciler.replaceMembers(managedMembers(graph, config), config);
					// Reconcile only this bounded unit, including journal recovery, before declaring it ready.
					await reconciler.reconcilePathsWhileLocked([path], config);
					config = reconciler.getConfig();
					for (const retry of refreshed.retryPaths) pendingPaths.add(retry);
					for (const id of refreshed.reconcileMemberIds) {
						const member = graph.project.members[id];
						if (member && member.path !== path) pendingPaths.add(member.path);
					}
				});
				const current = Object.entries(graph.project.members).find(
					([, member]) => member.path === path
				);
				if (
					started === fileRevision(path) &&
					(!current || graph.memberHandles.get(current[0])?.url === current[1].url)
				)
					checked.set(path, current?.[1].url ?? 'absent');
				if (inventory !== graph.project) notifyInventory();
				if (rescan || pendingPaths.size) requestRefresh();
			});
			let refreshPromise: Promise<void> | undefined;
			let refreshAgain = false;
			let refreshPriority = false;
			let backgroundStarted = false;
			let refreshTimer: ReturnType<typeof setTimeout> | undefined;
			function refresh(priority = false): Promise<void> {
				refreshPriority ||= priority;
				if (priority) loader.promote();
				if (refreshTimer) clearTimeout(refreshTimer);
				refreshTimer = undefined;
				if (refreshPromise) {
					refreshAgain = true;
					return refreshPromise;
				}
				refreshPromise = (async () => {
					do {
						refreshAgain = false;
						const full = rescan;
						rescan = false;
						const paths = [...pendingPaths];
						pendingPaths.clear();
						if (full)
							paths.push(
								...(await walkKnownFiles(project)),
								...Object.values(graph.projectHandle.doc()!.members).map((member) => member.path)
							);
						const expanded = new Set<string>();
						if (
							full ||
							paths.some((path) => path === 'components' || path.startsWith('components/'))
						)
							expanded.add('@components');
						for (const path of paths) {
							if (classifyProjectFile(path)) expanded.add(path);
							if (!classifyProjectFile(path)) {
								for (const file of await walkKnownFiles(project, path)) expanded.add(file);
								for (const member of Object.values(graph.projectHandle.doc()!.members))
									if (includesFsPath([path], member.path)) expanded.add(member.path);
							}
						}
						// Root notifications also bring remote additions/replacements into the background queue.
						for (const [id, member] of Object.entries(graph.projectHandle.doc()!.members))
							if (graph.memberHandles.get(id)?.url !== member.url) expanded.add(member.path);
						const components = expanded.delete('@components');
						await Promise.all([...expanded].map((path) => loader.request(path, refreshPriority)));
						if (components) await loader.request('@components', refreshPriority);
					} while (refreshAgain || rescan || pendingPaths.size);
				})().finally(() => {
					refreshPromise = undefined;
					refreshPriority = false;
					if (rescan || pendingPaths.size) requestRefresh();
				});
				return refreshPromise;
			}
			function requestRefresh(): void {
				if (!backgroundStarted || closed || !wake || refreshTimer) return;
				refreshTimer = setTimeout(() => {
					refreshTimer = undefined;
					options.onBackground?.({ state: 'loading' });
					void refresh().then(
						() => {
							if (!closed) options.onBackground?.({ state: 'idle' });
						},
						(cause) => {
							const nextBranchId = historyHandle.doc()?.checkedOutBranchId;
							if (nextBranchId && nextBranchId !== branchId) {
								options.onBranchCheckout?.(nextBranchId);
								return;
							}
							options.onBackground?.({
								state: 'error',
								message: cause instanceof Error ? cause.message : String(cause)
							});
						}
					);
				}, 50);
			}
			const started = await tryAsync({
				try: () => reconciler.start(false),
				catch: (cause) => CollaborationError.ProjectOpenFailed({ project: project.name, cause })
			});
			if (started.error) {
				await reconciler.stop();
				throw started.error;
			}
			await reconciler.removePaths(repaired.removedPaths);
			if (checkingOut) {
				await reconciler.requestReconcile(repaired.reconcileMemberIds);
				await reconciler.reconcileOrThrow();
			}
			for (const id of repaired.reconcileMemberIds)
				pendingPaths.add(graph.project.members[id].path);
			const rootListener = () => {
				const current = graph.projectHandle.doc()!;
				for (const [id, member] of Object.entries(current.members)) {
					if (
						graph.project.members[id]?.url === member.url &&
						graph.project.members[id]?.path === member.path
					)
						continue;
					checked.delete(member.path);
					pendingPaths.add(member.path);
				}
				for (const [id, member] of Object.entries(graph.project.members)) {
					if (current.members[id]?.url === member.url && current.members[id]?.path === member.path)
						continue;
					checked.delete(member.path);
					pendingPaths.add(member.path);
				}
				requestRefresh();
			};
			graph.projectHandle.on('change', rootListener);
			wake = requestRefresh;
			requestRefresh();
			const presence = createProjectPresence(graph.projectHandle);
			const svgInteractions = createProjectSvgInteractions(graph.projectHandle);
			let localBranchChange = false;
			let branchOperationPromise: Promise<void> | undefined;
			const mergePlans = new Map<string, ProjectMergePlan>();
			const historyListener = () => {
				if (localBranchChange) return;
				const nextBranchId = historyHandle.doc()?.checkedOutBranchId;
				if (nextBranchId && nextBranchId !== branchId) options.onBranchCheckout?.(nextBranchId);
			};
			historyHandle.on('change', historyListener);

			replaceCheckpointListeners();
			async function synchronize(priority = false): Promise<void> {
				do {
					await refresh(priority);
					await reconciler.reconcileOrThrow();
				} while (rescan || pendingPaths.size);
			}
			async function requireDocuments<D extends ProjectDependencies>(
				dependencies: D
			): Promise<RequiredDocuments<D>> {
				if (closed || closePromise) throw new Error('The project session is closing.');
				const resolved = await Promise.all(
					Object.entries(dependencies).map(async ([key, dependency]) => {
						if (dependency.type === 'snapshot') {
							await synchronize(true);
							graph = await resolveProjectGraph(projectRepo, graph.projectHandle);
							return [key, snapshotGraph(graph)];
						}
						const paths =
							dependency.type === 'member'
								? [dependency.path]
								: [
										...(await walkKnownFiles(project, dependency.scope)),
										...Object.values(graph.projectHandle.doc()!.members)
											.filter((member) => includesFsPath([dependency.scope], member.path))
											.map((member) => member.path)
									];
						await Promise.all(
							[...new Set(paths)]
								.filter(
									(path) =>
										dependency.type === 'member' ||
										classifyProjectFile(path)?.kind === dependency.kind
								)
								.map(async (path) => {
									while (true) {
										const current = Object.values(graph.projectHandle.doc()!.members).find(
											(member) => member.path === path
										);
										if (checked.get(path) === (current?.url ?? 'absent')) return;
										await loader.request(path, true);
									}
								})
						);
						if (dependency.type === 'collection')
							return [
								key,
								graphMembers(graph, dependency.kind).filter((member) =>
									includesFsPath([dependency.scope], member.path)
								)
							];
						const ref = graphMember(graph, dependency.kind, dependency.path);
						if (!ref && !dependency.optional)
							throw new Error(`Required project file ${dependency.path} is unavailable.`);
						return [key, ref];
					})
				).finally(() => {
					// Let the first view establish readiness before spending I/O on unrelated members.
					backgroundStarted = true;
					requestRefresh();
				});
				return Object.fromEntries(resolved) as RequiredDocuments<D>;
			}
			async function explicitCheckpointOperation<T>(operation: () => Promise<T>): Promise<T> {
				checkpointPaused = true;
				if (checkpointTimer) {
					clearTimeout(checkpointTimer);
					checkpointTimer = undefined;
				}
				try {
					await checkpointPromise;
					if (checkpointTimer) {
						clearTimeout(checkpointTimer);
						checkpointTimer = undefined;
					}
					checkpointDirty = false;
					return await operation();
				} finally {
					checkpointPaused = false;
					if (checkpointDirty) scheduleCheckpoint();
				}
			}
			async function recordExplicitCheckpoint(message: string): Promise<ProjectCheckpointId> {
				let checkpointId: ProjectCheckpointId;
				do {
					checkpointDirty = false;
					await synchronize();
					checkpointId = await recordProjectCheckpoint(
						projectRepo,
						historyHandle,
						branchId,
						graph,
						message
					);
				} while (checkpointDirty);
				return checkpointId;
			}
			function branchOperation<T>(operation: () => Promise<T>): Promise<T> {
				localBranchChange = true;
				const promise = (async () => {
					try {
						const result = await operation();
						const nextBranchId = historyHandle.doc()?.checkedOutBranchId;
						if (nextBranchId && nextBranchId !== branchId) options.onBranchCheckout?.(nextBranchId);
						return result;
					} finally {
						localBranchChange = false;
					}
				})();
				const completion = promise.then(
					() => undefined,
					() => undefined
				);
				branchOperationPromise = completion;
				void completion.then(() => {
					if (branchOperationPromise === completion) branchOperationPromise = undefined;
				});
				return promise;
			}
			async function putInputs(
				input: ProjectInput | ProjectInput[],
				message = 'Update project files'
			): Promise<void> {
				const inputs = Array.isArray(input) ? input : [input];
				const paths = new Set<string>();
				const prepared = await Promise.all(
					inputs.map(async (item) => {
						if (paths.has(item.path)) throw new Error(`Duplicate project input path ${item.path}.`);
						paths.add(item.path);
						const classification = classifyProjectFile(item.path);
						if (!classification) throw new Error(`Unsupported project input path ${item.path}.`);
						const bytes = await inputBytes(item.data);
						const hash = await hashBytes(bytes);
						return {
							path: item.path,
							classification,
							bytes,
							hash,
							seed: seedProjectMember(classification.kind, bytes, {
								hash,
								allowMissingIds: true
							})
						};
					})
				);
				const changedIds = new Set<string>();
				const removedPaths = new Set<string>();
				await Promise.all(prepared.map((item) => loader.request(item.path, true)));
				await withProjectLock(lockId, async () => {
					const latestConfig = await readProjectConfig(project);
					if (!latestConfig || latestConfig.branchId !== branchId) {
						throw new Error('The Automerge project configuration is unavailable.');
					}
					if (latestConfig.rootHeads) {
						await waitForRootHeads(graph.projectHandle, latestConfig.rootHeads);
					}
					graph = await resolveProjectGraph(projectRepo, graph.projectHandle, graph.memberHandles);
					config = latestConfig;

					const components = new Map(
						Object.entries(graph.project.components).map(([id, component]) => [component.name, id])
					);
					const createdComponents = new Map<string, string>();
					const additions: Array<{
						id: string;
						kind: ProjectMemberKind;
						path: string;
						url: AutomergeUrl;
						hash?: string;
						componentId?: string;
					}> = [];
					const replacements = new Map<string, { url: AutomergeUrl; hash: string }>();
					const flushIds = new Set<DocHandle<ProjectMemberDocument>['documentId']>();

					for (const item of prepared) {
						const existing = Object.entries(graph.project.members).find(
							([, member]) => member.path === item.path
						);
						if (existing) {
							if (existing[1].kind !== item.classification.kind) {
								throw new Error(`Project member ${item.path} has an incompatible kind.`);
							}
							if (item.classification.kind !== 'asset') {
								const handle = graph.memberHandles.get(existing[0]);
								if (!handle) throw new Error(`Project member ${item.path} is unavailable.`);
								applyProjectMemberBytes(
									item.classification.kind,
									handle,
									item.bytes,
									{ hash: item.hash, allowMissingIds: true },
									message
								);
								changedIds.add(existing[0]);
								flushIds.add(handle.documentId);
								continue;
							}
							const handle = projectRepo.create<ProjectMemberDocument>(item.seed.document);
							graph.memberHandles.set(existing[0], handle);
							if (item.seed.initialize) {
								handle.change((document) => item.seed.initialize!(document), { message });
							}
							replacements.set(existing[0], { url: handle.url, hash: item.hash });
							changedIds.add(existing[0]);
							flushIds.add(handle.documentId);
							continue;
						}

						const id =
							item.classification.kind === 'game-metadata'
								? GAME_METADATA_MEMBER_ID
								: projectMemberId();
						if (id === GAME_METADATA_MEMBER_ID && graph.project.members[id]) {
							throw new Error('The project already has game metadata.');
						}
						const handle = projectRepo.create<ProjectMemberDocument>(item.seed.document);
						graph.memberHandles.set(id, handle);
						if (item.seed.initialize) {
							handle.change((document) => item.seed.initialize!(document), { message });
						}
						const componentName = item.classification.componentName;
						let componentId = componentName ? components.get(componentName) : undefined;
						if (componentName && !componentId) {
							componentId = createdComponents.get(componentName);
							if (!componentId) {
								componentId = projectComponentId();
								createdComponents.set(componentName, componentId);
							}
						}
						additions.push({
							id,
							kind: item.classification.kind,
							path: item.path,
							url: handle.url,
							...(item.classification.kind === 'asset' ? { hash: item.hash } : {}),
							...(componentId ? { componentId } : {})
						});
						changedIds.add(id);
						flushIds.add(handle.documentId);
					}

					if (additions.length || replacements.size || createdComponents.size) {
						graph.projectHandle.change(
							(root) => {
								for (const [name, id] of createdComponents) root.components[id] = { name };
								for (const addition of additions) {
									root.members[addition.id] = {
										kind: addition.kind,
										path: addition.path,
										url: addition.url,
										...(addition.hash ? { hash: addition.hash } : {}),
										...(addition.componentId ? { componentId: addition.componentId } : {})
									};
								}
								for (const [id, replacement] of replacements) {
									root.members[id].url = replacement.url;
									root.members[id].hash = replacement.hash;
								}
							},
							{ message }
						);
						flushIds.add(graph.projectHandle.documentId);
					}

					await projectRepo.flush([...flushIds]);
					graph = await resolveProjectGraph(projectRepo, graph.projectHandle, graph.memberHandles);
					const repaired = await repairProjectConfig(project, graph, config);
					config = repaired.config;
					for (const id of repaired.reconcileMemberIds) changedIds.add(id);
					for (const path of repaired.removedPaths) removedPaths.add(path);
					replaceCheckpointListeners();
					reconciler.replaceMembers(managedMembers(graph, config), config);
					await reconciler.removePathsWhileLocked(removedPaths);
					notifyInventory();
				});
				void reconciler.requestReconcile(changedIds);
			}
			async function removeInputs(
				path: ProjectInputPath | ProjectInputPath[],
				message = 'Remove project files'
			): Promise<void> {
				const paths = new Set(Array.isArray(path) ? path : [path]);
				if (paths.has('game.json')) throw new Error('Project metadata cannot be removed.');
				const removedPaths = new Set<string>();
				const reconcileMemberIds = new Set<string>();
				await withProjectLock(lockId, async () => {
					const latestConfig = await readProjectConfig(project);
					if (!latestConfig || latestConfig.branchId !== branchId) {
						throw new Error('The Automerge project configuration is unavailable.');
					}
					if (latestConfig.rootHeads) {
						await waitForRootHeads(graph.projectHandle, latestConfig.rootHeads);
					}
					graph = await resolveProjectGraph(projectRepo, graph.projectHandle, graph.memberHandles);
					const ids = Object.entries(graph.project.members)
						.filter(([, member]) => paths.has(member.path as ProjectInputPath))
						.map(([id]) => id);
					if (!ids.length) return;
					graph.projectHandle.change(
						(root) => {
							for (const id of ids) delete root.members[id];
							const usedComponents = new Set(
								Object.values(root.members).flatMap((member) =>
									member.componentId ? [member.componentId] : []
								)
							);
							for (const id of Object.keys(root.components)) {
								if (!usedComponents.has(id)) delete root.components[id];
							}
						},
						{ message }
					);
					await projectRepo.flush([graph.projectHandle.documentId]);
					graph = await resolveProjectGraph(projectRepo, graph.projectHandle, graph.memberHandles);
					const repaired = await repairProjectConfig(project, graph, latestConfig);
					config = repaired.config;
					for (const removedPath of repaired.removedPaths) removedPaths.add(removedPath);
					for (const id of repaired.reconcileMemberIds) reconcileMemberIds.add(id);
					replaceCheckpointListeners();
					reconciler.replaceMembers(managedMembers(graph, config), config);
					await reconciler.removePathsWhileLocked(removedPaths);
					notifyInventory();
				});
				await reconciler.requestReconcile(reconcileMemberIds);
				await reconciler.reconcileOrThrow();
			}
			async function changeComponentStructure(operation: () => void): Promise<void> {
				const removedPaths = new Set<string>();
				const reconcileMemberIds = new Set<string>();
				await withProjectLock(lockId, async () => {
					const latestConfig = await readProjectConfig(project);
					if (!latestConfig || latestConfig.branchId !== branchId) {
						throw new Error('The Automerge project configuration is unavailable.');
					}
					if (latestConfig.rootHeads) {
						await waitForRootHeads(graph.projectHandle, latestConfig.rootHeads);
					}
					graph = await resolveProjectGraph(projectRepo, graph.projectHandle);
					operation();
					await projectRepo.flush([graph.projectHandle.documentId]);
					graph = await resolveProjectGraph(projectRepo, graph.projectHandle);
					const repaired = await repairProjectConfig(project, graph, latestConfig);
					config = repaired.config;
					for (const path of repaired.removedPaths) removedPaths.add(path);
					for (const id of repaired.reconcileMemberIds) reconcileMemberIds.add(id);
					replaceCheckpointListeners();
					reconciler.replaceMembers(managedMembers(graph, config), config);
					await reconciler.removePathsWhileLocked(removedPaths);
					notifyInventory();
				});
				await reconciler.requestReconcile(reconcileMemberIds);
				await reconciler.reconcileOrThrow();
			}
			return {
				name: project.name,
				rootUrl: graph.projectHandle.url,
				historyUrl: restored.historyUrl,
				branchId,
				readOnly: false,
				canEditStructure: true,
				require: requireDocuments,
				releasePage: () => {
					refreshPriority = false;
					loader.demote();
				},
				components: () =>
					Object.entries(graph.projectHandle.doc()!.components).map(([id, component]) => ({
						id,
						name: component.name
					})),
				member: <K extends ProjectMemberKind>(kind: K, path: ProjectMemberPathFor<K>) =>
					graphMember(graph, kind, path),
				members: <K extends ProjectMemberKind>(kind: K) => graphMembers(graph, kind),
				subscribeInventory: (listener: () => void) => {
					inventoryListeners.add(listener);
					listener();
					return () => inventoryListeners.delete(listener);
				},
				snapshot: () =>
					tryAsync({
						try: async () => {
							await synchronize(true);
							graph = await resolveProjectGraph(projectRepo, graph.projectHandle);
							return snapshotGraph(graph);
						},
						catch: (cause) =>
							CollaborationError.SynchronizationFailed({ project: project.name, cause })
					}),
				put: (input: ProjectInput | ProjectInput[], putOptions?: { message?: string }) =>
					tryAsync({
						try: () => putInputs(input, putOptions?.message),
						catch: (cause) =>
							CollaborationError.SynchronizationFailed({ project: project.name, cause })
					}),
				remove: (
					path: ProjectInputPath | ProjectInputPath[],
					removeOptions?: { message?: string }
				) =>
					tryAsync({
						try: () => removeInputs(path, removeOptions?.message),
						catch: (cause) =>
							CollaborationError.SynchronizationFailed({ project: project.name, cause })
					}),
				metadataHandle: graph.metadataHandle,
				presence,
				svgInteractions,
				getHistory: () => historyHandle.doc()!,
				subscribeHistory: (listener: (history: ProjectHistoryDocument) => void) => {
					const notify = () => {
						const history = historyHandle.doc();
						if (history) listener(history);
					};
					historyHandle.on('change', notify);
					notify();
					return () => historyHandle.off('change', notify);
				},
				createCheckpoint: (message = 'Checkpoint') =>
					tryAsync({
						try: () => explicitCheckpointOperation(() => recordExplicitCheckpoint(message)),
						catch: (cause) =>
							CollaborationError.SynchronizationFailed({ project: project.name, cause })
					}),
				forkFromCheckpoint: (checkpointId: ProjectCheckpointId, name: string) =>
					tryAsync({
						try: () =>
							branchOperation(async () => {
								return explicitCheckpointOperation(async () => {
									await synchronize();
									return forkProjectCheckpoint(projectRepo, historyHandle, checkpointId, name);
								});
							}),
						catch: (cause) =>
							CollaborationError.SynchronizationFailed({ project: project.name, cause })
					}),
				checkoutBranch: (nextBranchId: ProjectBranchId) =>
					tryAsync({
						try: () =>
							branchOperation(async () => {
								await explicitCheckpointOperation(async () => {
									await recordExplicitCheckpoint('Before branch switch');
									checkoutProjectBranch(historyHandle, nextBranchId);
									await projectRepo.flush([historyHandle.documentId]);
								});
							}),
						catch: (cause) =>
							CollaborationError.SynchronizationFailed({ project: project.name, cause })
					}),
				renameBranch: (targetBranchId: ProjectBranchId, name: string) =>
					tryAsync({
						try: async () => {
							renameProjectBranch(historyHandle, targetBranchId, name);
							await projectRepo.flush([historyHandle.documentId]);
						},
						catch: (cause) =>
							CollaborationError.SynchronizationFailed({ project: project.name, cause })
					}),
				deleteBranch: (targetBranchId: ProjectBranchId) =>
					tryAsync({
						try: () =>
							branchOperation(async () => {
								deleteProjectBranch(historyHandle, targetBranchId);
								await projectRepo.flush([historyHandle.documentId]);
							}),
						catch: (cause) =>
							CollaborationError.SynchronizationFailed({ project: project.name, cause })
					}),
				prepareMergeToParent: () =>
					tryAsync({
						try: () =>
							explicitCheckpointOperation(async () => {
								await synchronize();
								const plan = await prepareProjectMerge(projectRepo, historyHandle, branchId);
								mergePlans.clear();
								mergePlans.set(plan.id, plan);
								return plan;
							}),
						catch: (cause) =>
							CollaborationError.SynchronizationFailed({ project: project.name, cause })
					}),
				commitMergeToParent: (planId: string, resolutions: ProjectMergeResolution[]) =>
					tryAsync({
						try: () =>
							branchOperation(() =>
								explicitCheckpointOperation(async () => {
									const plan = mergePlans.get(planId);
									if (!plan) throw new Error('The merge preview is stale. Review the merge again.');
									const result = await withProjectLock(lockId, async () => {
										const checkpointId = await commitProjectMerge(
											projectRepo,
											historyHandle,
											plan,
											resolutions
										);
										return checkpointId;
									});
									mergePlans.delete(planId);
									return result;
								})
							),
						catch: (cause) =>
							CollaborationError.SynchronizationFailed({ project: project.name, cause })
					}),
				renameComponent: (oldName: string, newName: string) =>
					tryAsync({
						try: () =>
							changeComponentStructure(() => {
								const document = graph.project;
								const component = Object.entries(document.components).find(
									([, value]) => value.name === oldName
								);
								if (!component) throw new Error(`Component "${oldName}" does not exist.`);
								if (Object.values(document.components).some((value) => value.name === newName)) {
									throw new Error(`Component "${newName}" already exists.`);
								}
								const source = `components/${oldName}`;
								const target = `components/${newName}`;
								graph.projectHandle.change(
									(root) => {
										root.components[component[0]].name = newName;
										for (const member of Object.values(root.members)) {
											if (member.componentId !== component[0]) continue;
											member.path = `${target}/${member.path.slice(source.length + 1)}`;
										}
									},
									{ message: `Rename component ${oldName} to ${newName}` }
								);
							}),
						catch: (cause) =>
							CollaborationError.SynchronizationFailed({ project: project.name, cause })
					}),
				deleteComponent: (name: string) =>
					tryAsync({
						try: () =>
							changeComponentStructure(() => {
								const document = graph.project;
								const component = Object.entries(document.components).find(
									([, value]) => value.name === name
								);
								if (!component) throw new Error(`Component "${name}" does not exist.`);
								graph.projectHandle.change(
									(root) => {
										for (const [id, member] of Object.entries(root.members)) {
											if (member.componentId === component[0]) delete root.members[id];
										}
										delete root.components[component[0]];
									},
									{ message: `Delete component ${name}` }
								);
							}),
						catch: (cause) =>
							CollaborationError.SynchronizationFailed({ project: project.name, cause })
					}),
				sync: () =>
					tryAsync({
						try: synchronize,
						catch: (cause) =>
							CollaborationError.SynchronizationFailed({ project: project.name, cause })
					}),
				close: async () => {
					if (closePromise) return closePromise;
					if (closed) return { data: undefined, error: null };
					stopWatching?.();
					wake = undefined;
					if (refreshTimer) clearTimeout(refreshTimer);
					checkpointPaused = true;
					if (checkpointTimer) {
						clearTimeout(checkpointTimer);
						checkpointTimer = undefined;
					}
					closePromise = tryAsync({
						try: async () => {
							await branchOperationPromise;
							await checkpointPromise;
							presence.close();
							svgInteractions.close();
							if (historyHandle.doc()?.checkedOutBranchId !== branchId) {
								await loader.close();
								await reconciler.stop();
								await projectRepo.shutdown();
								return;
							}
							do {
								checkpointDirty = false;
								await synchronize();
								await recordProjectCheckpoint(projectRepo, historyHandle, branchId, graph);
							} while (checkpointDirty);
							await reconciler.stop();
							await loader.close();
							await projectRepo.shutdown();
						},
						catch: (cause) =>
							CollaborationError.ProjectCloseFailed({ project: project.name, cause })
					});
					const closedSession = await closePromise;
					closed = true;
					presence.close();
					svgInteractions.close();
					for (const [handle, listener] of checkpointListeners) handle.off('change', listener);
					checkpointListeners.clear();
					inventoryListeners.clear();
					historyHandle.off('change', historyListener);
					graph.projectHandle.off('change', rootListener);
					if (closedSession.error) {
						await loader.close();
						await reconciler.stop();
						await projectRepo.shutdown().catch(() => undefined);
					}
					return closedSession;
				}
			};
		},
		catch: (cause) => CollaborationError.ProjectOpenFailed({ project: project.name, cause })
	});
	if (opened.error) stopWatching?.();

	if (opened.error && repo) await repo.shutdown().catch(() => undefined);
	return opened;
}

function createHistoricalProjectSession({
	project,
	repo,
	historyHandle,
	branchId,
	graph,
	options
}: {
	project: FsDir;
	repo: Repo;
	historyHandle: DocHandle<ProjectHistoryDocument>;
	branchId: ProjectBranchId;
	graph: ProjectGraph;
	options: OpenProjectSessionOptions;
}): ProjectSession {
	const presence = createProjectPresence(graph.projectHandle);
	const svgInteractions = createProjectSvgInteractions(graph.projectHandle);
	const checkpoint = historyHandle.doc()!.checkpoints[options.checkpointId!];
	const loader = createProjectLoader(async (id) => {
		const member = graph.project.members[id];
		const version = checkpoint.members[id];
		if (!member || !version || version.url !== member.url)
			throw new Error(`Checkpoint is missing member ${id}.`);
		const source = await repo.find<ProjectMemberDocument>(version.url);
		const handle = source.view(version.heads);
		if (!isProjectMemberDocument(member.kind, handle.doc()))
			throw new Error(`Checkpoint member ${member.path} is unavailable.`);
		graph.memberHandles.set(id, handle);
	});
	async function loadMembers(ids: string[], priority = false): Promise<void> {
		await Promise.all(
			ids.filter((id) => !graph.memberHandles.has(id)).map((id) => loader.request(id, priority))
		);
	}
	const background = setTimeout(() => {
		options.onBackground?.({ state: 'loading' });
		void loadMembers(Object.keys(graph.project.members)).then(
			() => {
				if (!closed) options.onBackground?.({ state: 'idle' });
			},
			(cause) => {
				if (!closed)
					options.onBackground?.({
						state: 'error',
						message: cause instanceof Error ? cause.message : String(cause)
					});
			}
		);
	}, 50);
	let closed = false;
	let localBranchChange = false;
	const historyListener = () => {
		if (localBranchChange) return;
		const nextBranchId = historyHandle.doc()?.checkedOutBranchId;
		if (nextBranchId && nextBranchId !== branchId) options.onBranchCheckout?.(nextBranchId);
	};
	historyHandle.on('change', historyListener);
	const branchOperation = async <T>(operation: () => Promise<T>): Promise<T> => {
		localBranchChange = true;
		try {
			const result = await operation();
			const nextBranchId = historyHandle.doc()?.checkedOutBranchId;
			if (nextBranchId && nextBranchId !== branchId) options.onBranchCheckout?.(nextBranchId);
			return result;
		} finally {
			localBranchChange = false;
		}
	};
	const readOnly = <T>(): Promise<Result<T, CollaborationError>> =>
		tryAsync({
			try: async () => {
				throw new Error('Historical project checkpoints are read-only.');
			},
			catch: (cause) => CollaborationError.SynchronizationFailed({ project: project.name, cause })
		}) as Promise<Result<T, CollaborationError>>;
	return {
		name: project.name,
		rootUrl: graph.projectHandle.url,
		historyUrl: historyHandle.url,
		branchId,
		readOnly: true,
		canEditStructure: false,
		releasePage: loader.demote,
		components: () =>
			Object.entries(graph.project.components).map(([id, component]) => ({
				id,
				name: component.name
			})),
		require: async <D extends ProjectDependencies>(
			dependencies: D
		): Promise<RequiredDocuments<D>> => {
			if (closed) throw new Error('The project session is closed.');
			const entries = await Promise.all(
				Object.entries(dependencies).map(async ([key, dependency]) => {
					if (dependency.type === 'snapshot') {
						await loadMembers(Object.keys(graph.project.members), true);
						return [key, snapshotGraph(graph)];
					}
					const ids = Object.entries(graph.project.members)
						.filter(
							([, member]) =>
								member.kind === dependency.kind &&
								(dependency.type === 'member'
									? member.path === dependency.path
									: includesFsPath([dependency.scope], member.path))
						)
						.map(([id]) => id);
					await loadMembers(ids, true);
					if (dependency.type === 'collection')
						return [
							key,
							graphMembers(graph, dependency.kind).filter((member) =>
								includesFsPath([dependency.scope], member.path)
							)
						];
					const ref = graphMember(graph, dependency.kind, dependency.path);
					if (!ref && !dependency.optional)
						throw new Error(
							`Required project file ${dependency.path} is unavailable at this checkpoint.`
						);
					return [key, ref];
				})
			);
			return Object.fromEntries(entries) as RequiredDocuments<D>;
		},
		member: <K extends ProjectMemberKind>(kind: K, path: ProjectMemberPathFor<K>) =>
			graphMember(graph, kind, path),
		members: <K extends ProjectMemberKind>(kind: K) => graphMembers(graph, kind),
		subscribeInventory: (listener: () => void) => {
			listener();
			return () => undefined;
		},
		snapshot: () =>
			tryAsync({
				try: async () => {
					await loadMembers(Object.keys(graph.project.members), true);
					return snapshotGraph(graph);
				},
				catch: (cause) => CollaborationError.SynchronizationFailed({ project: project.name, cause })
			}),
		put: () => readOnly<void>(),
		remove: () => readOnly<void>(),
		metadataHandle: graph.metadataHandle,
		presence,
		svgInteractions,
		getHistory: () => historyHandle.doc()!,
		subscribeHistory: (listener) => {
			const notify = () => listener(historyHandle.doc()!);
			historyHandle.on('change', notify);
			notify();
			return () => historyHandle.off('change', notify);
		},
		createCheckpoint: () => readOnly<ProjectCheckpointId>(),
		forkFromCheckpoint: (checkpointId, name) =>
			tryAsync({
				try: () =>
					branchOperation(() => forkProjectCheckpoint(repo, historyHandle, checkpointId, name)),
				catch: (cause) => CollaborationError.SynchronizationFailed({ project: project.name, cause })
			}),
		checkoutBranch: (nextBranchId) =>
			tryAsync({
				try: () =>
					branchOperation(async () => {
						checkoutProjectBranch(historyHandle, nextBranchId);
						await repo.flush([historyHandle.documentId]);
					}),
				catch: (cause) => CollaborationError.SynchronizationFailed({ project: project.name, cause })
			}),
		renameBranch: (targetBranchId, name) =>
			tryAsync({
				try: async () => {
					renameProjectBranch(historyHandle, targetBranchId, name);
					await repo.flush([historyHandle.documentId]);
				},
				catch: (cause) => CollaborationError.SynchronizationFailed({ project: project.name, cause })
			}),
		deleteBranch: () => readOnly<void>(),
		prepareMergeToParent: () => readOnly<ProjectMergePlan>(),
		commitMergeToParent: () => readOnly<ProjectCheckpointId>(),
		renameComponent: () => readOnly<void>(),
		deleteComponent: () => readOnly<void>(),
		sync: () => tryAsync({ try: async () => undefined, catch: () => undefined as never }),
		close: async () => {
			if (closed) return { data: undefined, error: null };
			closed = true;
			clearTimeout(background);
			await loader.close();
			historyHandle.off('change', historyListener);
			presence.close();
			svgInteractions.close();
			return tryAsync({
				try: () => repo.shutdown(),
				catch: (cause) => CollaborationError.ProjectCloseFailed({ project: project.name, cause })
			});
		}
	};
}

async function restoreOrCreateProject(
	project: FsDir,
	repo: Repo,
	hadStoredData: boolean,
	joinHistoryUrl?: AutomergeUrl,
	initial?: ProjectInput[],
	onCreate?: (graph: ProjectGraph) => void
): Promise<ProjectConfig> {
	const existing = await readProjectConfig(project);
	if (initial && (existing || hadStoredData))
		throw new Error('Project already has Automerge documents.');
	const pending = await readPendingBootstrap(project);
	const pendingJoin = await readPendingJoin(project);
	if (existing) {
		if (joinHistoryUrl && existing.historyUrl !== joinHistoryUrl) {
			throw new Error('The selected folder already belongs to a different Automerge project.');
		}
		if (pending?.config?.rootUrl === existing.rootUrl) await removePendingBootstrap(project);
		if (pendingJoin?.historyUrl === existing.historyUrl) await removePendingJoin(project);
		return existing;
	}
	if (pendingJoin?.config) {
		if (joinHistoryUrl && pendingJoin.historyUrl !== joinHistoryUrl) {
			throw new Error('The selected folder has an unfinished join for a different project.');
		}
		await writeProjectConfig(project, pendingJoin.config);
		await removePendingJoin(project);
		return pendingJoin.config;
	}
	const sharedHistoryUrl = joinHistoryUrl ?? pendingJoin?.historyUrl;
	if (sharedHistoryUrl) {
		if (pending)
			throw new Error('The selected folder contains an unfinished local project bootstrap.');
		return joinSharedProject(project, repo, sharedHistoryUrl, pendingJoin);
	}
	if (pending?.config) {
		await writeProjectConfig(project, pending.config);
		await removePendingBootstrap(project);
		return pending.config;
	}
	if (!pending && hadStoredData) {
		throw new Error(
			'Project contains Automerge storage but is missing .automerge/config.json; refusing to create a new project identity.'
		);
	}

	const sources = initial
		? {
				files: await Promise.all(
					initial.map(async (input) => projectFileSource(input.path, await inputBytes(input.data)))
				)
			}
		: await scanProjectFiles(project, pending ? Object.keys(pending.sources) : undefined);
	const sourceHashes = Object.fromEntries(
		sources.files.map(({ path, snapshot }) => [path, snapshot.hash])
	);
	if (pending && !sameSources(pending.sources, sourceHashes)) {
		throw new Error(`${PENDING_BOOTSTRAP_FILE} does not match the current project files.`);
	}
	if (!pending) await writePendingBootstrap(project, { version: 1, sources: sourceHashes });

	const graph = await createProjectGraph(repo, sources.files);
	onCreate?.(graph);
	const history = await createProjectHistory(repo, graph);
	const config = configFromGraph(
		graph,
		initial ? [] : sources.files.map(({ path, snapshot }) => ({ path, snapshot })),
		history.url,
		history.doc()!.checkedOutBranchId
	);
	await writePendingBootstrap(project, { version: 1, sources: sourceHashes, config });
	await writeProjectConfig(project, config);
	await removePendingBootstrap(project);
	return config;
}

async function joinSharedProject(
	project: FsDir,
	repo: Repo,
	historyUrl: AutomergeUrl,
	pending: Awaited<ReturnType<typeof readPendingJoin>>
): Promise<ProjectConfig> {
	if (pending && pending.historyUrl !== historyUrl) {
		throw new Error('The selected folder has an unfinished join for a different project.');
	}
	if (!pending) await writePendingJoin(project, { version: 1, historyUrl });

	const controller = new AbortController();
	const timeout = setTimeout(
		() =>
			controller.abort(
				new Error('Could not find the shared project. Ask the owner to keep it open and try again.')
			),
		15_000
	);
	const historyHandle = await repo
		.find<ProjectHistoryDocument>(historyUrl, { signal: controller.signal })
		.finally(() => clearTimeout(timeout));
	if (!isProjectHistoryDocument(historyHandle.doc())) {
		throw new Error('The invitation does not point to a Digitable project history.');
	}

	let branchId: ProjectBranchId;
	let graph: ProjectGraph;
	while (true) {
		const currentBranchId = historyHandle.doc()?.checkedOutBranchId;
		if (!currentBranchId) throw new Error('The shared project has no checked-out branch.');
		const resolved = await resolveBranchGraph(repo, historyHandle, currentBranchId);
		if (historyHandle.doc()?.checkedOutBranchId !== currentBranchId) continue;
		branchId = resolved.branchId;
		graph = resolved.graph;
		break;
	}

	await repo.flush([
		historyHandle.documentId,
		graph.projectHandle.documentId,
		...Array.from(graph.memberHandles.values(), (handle) => handle.documentId)
	]);
	const config: ProjectConfig = {
		version: 3,
		historyUrl,
		branchId,
		rootUrl: graph.projectHandle.url,
		rootHeads: graph.projectHandle.heads(),
		projections: Object.fromEntries(
			Object.entries(graph.project.members).map(([memberId, member]) => {
				const handle = memberHandle(graph, memberId);
				return [
					memberId,
					{
						path: member.path,
						url: member.url,
						heads: handle.heads(),
						hash: null,
						materializeOnly: true
					}
				];
			})
		)
	};
	await writePendingJoin(project, { version: 1, historyUrl, config });
	await writeProjectConfig(project, config);
	await removePendingJoin(project);
	return config;
}

function configFromGraph(
	graph: ProjectGraph,
	snapshots: Array<{ path: string; snapshot: { hash: string } }>,
	historyUrl: AutomergeUrl,
	branchId: ProjectBranchId
): ProjectConfig {
	const project = graph.project;
	const hashes = new Map(snapshots.map(({ path, snapshot }) => [path, snapshot.hash]));
	const projections = Object.fromEntries(
		Object.entries(project.members).map(([memberId, member]) => {
			const handle = memberHandle(graph, memberId);
			return [
				memberId,
				{
					path: member.path,
					url: member.url,
					heads: handle.heads(),
					hash: hashes.get(member.path) ?? null,
					...(hashes.has(member.path) ? {} : { materializeOnly: true })
				}
			];
		})
	);
	return {
		version: 3,
		historyUrl,
		branchId,
		rootUrl: graph.projectHandle.url,
		rootHeads: graph.projectHandle.heads(),
		projections
	};
}

function managedMembers(graph: ProjectGraph, config: ProjectConfig): ManagedMember[] {
	const project = graph.project;
	const members = Object.entries(project.members)
		.filter(([id]) => graph.memberHandles.has(id))
		.map(([memberId, member]) => {
			const projection = config.projections[memberId];
			if (!projection || projection.path !== member.path || projection.url !== member.url) {
				throw new Error(`Project configuration does not match member ${memberId}.`);
			}
			const handle = graph.memberHandles.get(memberId);
			if (!handle) throw new Error(`Automerge project member ${memberId} has no document handle.`);
			return managedMember(memberId, member, handle);
		});
	return members;
}

async function ensureRulesDocument(
	project: FsDir,
	repo: Repo,
	graph: ProjectGraph,
	config: ProjectConfig
): Promise<{ graph: ProjectGraph; config: ProjectConfig }> {
	if (Object.values(graph.project.members).some((member) => member.kind === 'rules')) {
		return { graph, config };
	}
	const existing = await snapshotFile(project, 'rules.md');
	const source = await projectFileSource('rules.md', existing?.bytes ?? encodeText(''));
	const id = projectMemberId();
	const handle = await createProjectMemberHandle(repo, source);
	await repo.flush([handle.documentId]);
	graph.projectHandle.change(
		(document) => {
			if (Object.values(document.members).some((member) => member.path === source.path)) return;
			document.members[id] = { kind: 'rules', path: source.path, url: handle.url };
		},
		{ message: 'Add rules.md to project' }
	);
	await repo.flush([graph.projectHandle.documentId]);
	const latest = await resolveProjectGraph(
		repo,
		graph.projectHandle,
		new Map([...graph.memberHandles, [id, handle]])
	);
	const member = latest.project.members[id];
	const memberHandle = latest.memberHandles.get(id);
	if (!member || !memberHandle) throw new Error('The rules document was not added to the project.');
	const nextConfig: ProjectConfig = {
		...config,
		rootHeads: latest.projectHandle.heads(),
		projections: {
			...config.projections,
			[id]: {
				path: member.path,
				url: member.url,
				heads: memberHandle.heads(),
				hash: existing?.hash ?? null,
				...(!existing ? { materializeOnly: true } : {})
			}
		}
	};
	await writeProjectConfig(project, nextConfig);
	return { graph: latest, config: nextConfig };
}

function memberHandle(graph: ProjectGraph, memberId: string): DocHandle<ProjectMemberDocument> {
	const handle = graph.memberHandles.get(memberId);
	if (!handle) throw new Error(`Automerge project member ${memberId} has no document handle.`);
	return handle;
}

async function waitForRootHeads<T>(handle: DocHandle<T>, heads: UrlHeads): Promise<void> {
	if (!heads.length || handle.view(heads).doc()) return;
	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			handle.off('change', check);
			reject(new Error('Timed out waiting for the Automerge project root to synchronize.'));
		}, 10_000);
		const check = () => {
			if (!handle.view(heads).doc()) return;
			clearTimeout(timeout);
			handle.off('change', check);
			resolve();
		};
		handle.on('change', check);
	});
}

async function repairProjectConfig(
	project: FsDir,
	graph: ProjectGraph,
	config: ProjectConfig
): Promise<{ config: ProjectConfig; reconcileMemberIds: string[]; removedPaths: string[] }> {
	const document = graph.project;
	const reconcileMemberIds: string[] = [];
	const paths = new Set(Object.values(document.members).map((member) => member.path));
	const removedPaths = Object.entries(config.projections).flatMap(([id, projection]) =>
		document.members[id]?.path === projection.path || paths.has(projection.path)
			? []
			: [projection.path]
	);
	const projections = Object.fromEntries(
		await Promise.all(
			Object.entries(document.members).map(async ([id, member]) => {
				const existing = config.projections[id];
				if (existing?.path === member.path && existing.url === member.url) {
					if (existing.materializeOnly) reconcileMemberIds.push(id);
					return [id, existing] as const;
				}
				if (!graph.memberHandles.has(id)) return [id, existing] as const;
				const snapshot = await snapshotFile(project, member.path);
				reconcileMemberIds.push(id);
				return [
					id,
					{
						path: member.path,
						url: member.url,
						heads: memberHandle(graph, id).heads(),
						hash: snapshot?.hash ?? null,
						materializeOnly: true
					}
				] as const;
			})
		).then((entries) =>
			entries.filter(
				(entry): entry is readonly [string, NonNullable<(typeof entry)[1]>] =>
					entry[1] !== undefined
			)
		)
	);
	const repaired: ProjectConfig = {
		version: 3,
		historyUrl: config.historyUrl,
		branchId: config.branchId,
		rootUrl: graph.projectHandle.url,
		rootHeads: graph.projectHandle.heads(),
		projections
	};
	if (JSON.stringify(repaired) !== JSON.stringify(config))
		await writeProjectConfig(project, repaired);
	return { config: repaired, reconcileMemberIds, removedPaths };
}

function sameSources(left: Record<string, string>, right: Record<string, string>): boolean {
	const keys = Object.keys(left);
	return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}

async function refreshProjectInventory(
	project: FsDir,
	repo: Repo,
	graph: ProjectGraph,
	config: ProjectConfig,
	scanned: Awaited<ReturnType<typeof scanProjectFiles>>
): Promise<{
	graph: ProjectGraph;
	config: ProjectConfig;
	reconcileMemberIds: string[];
	retryPaths: string[];
	removedPaths: string[];
}> {
	const root = graph.projectHandle;
	const current = graph.project;
	const sourceByPath = new Map(scanned.files.map((source) => [source.path, source]));
	const memberByPath = new Map(
		Object.entries(current.members).map(([id, member]) => [member.path, { id, member }])
	);
	const additions: Array<{
		id: string;
		source: ProjectFileSource;
		handle: DocHandle<ProjectMemberDocument>;
	}> = [];
	const replacements: Array<{
		id: string;
		source: ProjectFileSource;
		handle: DocHandle<ProjectMemberDocument>;
	}> = [];
	const deletions = new Set<string>();
	const retryPaths: string[] = [];

	for (const source of scanned.files) {
		const existing = memberByPath.get(source.path);
		if (!existing) {
			if ((await snapshotFile(project, source.path))?.hash !== source.snapshot.hash) {
				retryPaths.push(source.path);
				continue;
			}
			const id = source.kind === 'game-metadata' ? GAME_METADATA_MEMBER_ID : projectMemberId();
			additions.push({
				id,
				source,
				handle: await createProjectMemberHandle(repo, source)
			});
			continue;
		}
		if (existing.member.kind !== 'asset' || source.kind !== 'asset') continue;
		const projection = config.projections[existing.id];
		const rootChanged =
			!projection ||
			projection.url !== existing.member.url ||
			projection.path !== existing.member.path;
		if (rootChanged || source.snapshot.hash === projection.hash) continue;
		if ((await snapshotFile(project, source.path))?.hash !== source.snapshot.hash) {
			retryPaths.push(source.path);
			continue;
		}
		replacements.push({
			id: existing.id,
			source,
			handle: await createProjectMemberHandle(repo, source)
		});
	}

	for (const [id, member] of Object.entries(current.members)) {
		if (scanned.scope && !includesFsPath(scanned.scope, member.path)) continue;
		if (member.kind === 'game-metadata' || member.kind === 'rules' || sourceByPath.has(member.path))
			continue;
		const projection = config.projections[id];
		if (
			projection &&
			projection.path === member.path &&
			projection.url === member.url &&
			projection.hash !== null
		) {
			if (await readFile(project, member.path)) {
				retryPaths.push(member.path);
				continue;
			}
			deletions.add(id);
		}
	}

	const componentNames = new Set(
		Object.values(current.components).map((component) => component.name)
	);
	const components = scanned.components ?? [
		...new Set([
			...componentNames,
			...scanned.files.flatMap((source) => (source.componentName ? [source.componentName] : []))
		])
	];
	const componentsChanged =
		componentNames.size !== components.length ||
		components.some((name) => !componentNames.has(name));
	if (additions.length || replacements.length || deletions.size || componentsChanged) {
		await repo.flush([
			...additions.map(({ handle }) => handle.documentId),
			...replacements.map(({ handle }) => handle.documentId)
		]);
		root.change(
			(document) => {
				const componentIds = new Map(
					Object.entries(document.components).map(([id, component]) => [component.name, id])
				);
				for (const name of components) {
					if (componentIds.has(name)) continue;
					const id = projectComponentId();
					componentIds.set(name, id);
					document.components[id] = { name };
				}
				for (const id of deletions) {
					const expected = current.members[id];
					if (!expected || document.members[id]?.url !== expected.url) continue;
					delete document.members[id];
				}
				for (const replacement of replacements) {
					const member = document.members[replacement.id];
					if (!member || member.url !== current.members[replacement.id]?.url) continue;
					member.url = replacement.handle.url;
					member.hash = replacement.source.snapshot.hash;
				}
				for (const addition of additions) {
					if (
						Object.values(document.members).some((member) => member.path === addition.source.path)
					) {
						continue;
					}
					const componentId = addition.source.componentName
						? componentIds.get(addition.source.componentName)
						: undefined;
					document.members[addition.id] = {
						kind: addition.source.kind,
						path: addition.source.path,
						url: addition.handle.url,
						...(addition.source.kind === 'asset' ? { hash: addition.source.snapshot.hash } : {}),
						...(componentId ? { componentId } : {})
					};
				}
				for (const [id, component] of Object.entries(document.components)) {
					if (components.includes(component.name)) continue;
					if (Object.values(document.members).some((member) => member.componentId === id)) continue;
					delete document.components[id];
				}
			},
			{ message: 'Reconcile project file inventory' }
		);
		await repo.flush([root.documentId]);
	}

	const loaded = new Map(graph.memberHandles);
	for (const { id, handle } of [...additions, ...replacements]) loaded.set(id, handle);
	const latest = await resolveProjectGraph(repo, root, loaded);
	const latestProject = latest.project;
	const latestPaths = new Set(Object.values(latestProject.members).map((member) => member.path));
	const removedPaths = Object.entries(config.projections).flatMap(([id, projection]) =>
		latestProject.members[id]?.path === projection.path || latestPaths.has(projection.path)
			? []
			: [projection.path]
	);
	const sourceHashes = new Map(scanned.files.map((source) => [source.path, source.snapshot.hash]));
	const localMemberIds = new Set([
		...additions.map((addition) => addition.id),
		...replacements.map((replacement) => replacement.id)
	]);
	const reconcileMemberIds = new Set<string>();
	const projections = Object.fromEntries(
		Object.entries(latestProject.members).flatMap(([id, member]) => {
			const handle = latest.memberHandles.get(id);
			const existing = config.projections[id];
			if (!handle) return existing ? [[id, existing]] : [];
			const unchanged = existing?.path === member.path && existing.url === member.url;
			const filesystemIsCurrent =
				localMemberIds.has(id) || (existing?.url === member.url && sourceHashes.has(member.path));
			if (!unchanged) reconcileMemberIds.add(id);
			if (unchanged && existing.materializeOnly) reconcileMemberIds.add(id);
			if (
				unchanged &&
				(!scanned.scope || includesFsPath(scanned.scope, member.path)) &&
				(sourceHashes.get(member.path) ?? null) !== existing.hash &&
				member.kind !== 'asset'
			) {
				reconcileMemberIds.add(id);
			}
			if (
				unchanged &&
				(handle.heads().length !== existing.heads.length ||
					handle.heads().some((head) => !existing.heads.includes(head)))
			) {
				reconcileMemberIds.add(id);
			}
			return [
				[
					id,
					unchanged
						? existing
						: {
								path: member.path,
								url: member.url,
								heads: handle.heads(),
								hash:
									sourceHashes.get(member.path) ??
									(existing?.path === member.path ? existing.hash : null),
								...(filesystemIsCurrent ? {} : { materializeOnly: true })
							}
				]
			];
		})
	);
	const nextConfig: ProjectConfig = {
		version: 3,
		historyUrl: config.historyUrl,
		branchId: config.branchId,
		rootUrl: latest.projectHandle.url,
		rootHeads: latest.projectHandle.heads(),
		projections
	};
	if (JSON.stringify(nextConfig) !== JSON.stringify(config))
		await writeProjectConfig(project, nextConfig);
	return {
		graph: latest,
		config: nextConfig,
		reconcileMemberIds: [...reconcileMemberIds],
		retryPaths,
		removedPaths
	};
}
