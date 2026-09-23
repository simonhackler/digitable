import {
	joinFsPath,
	type FsDir,
	type FsWriteData
} from '$lib/components/file-browser/adapters/adapter';
import { COMPONENTS_DIR } from '$lib/workspace/project-layout';
import {
	Repo,
	type AutomergeUrl,
	type DocHandle,
	type NetworkAdapterInterface,
	type UrlHeads
} from '@automerge/automerge-repo';
import { isSvgDocument, type SvgDocument } from '@svg-table/svgeditor';
import { BroadcastChannelNetworkAdapter } from '@automerge/automerge-repo-network-broadcastchannel';
import { createProjectPresence, type ProjectPresence } from './project-presence';
import {
	createProjectSvgInteractions,
	type ProjectSvgInteractions
} from './project-svg-interactions';
import { defineErrors, extractErrorMessage, type InferErrors } from 'wellcrafted/error';
import { tryAsync, type Result } from 'wellcrafted/result';
import { createProjectFileObserver } from './file-observer';
import { createCheckpointProjectFiles } from './checkpoint-filesystem';
import {
	createProjectGraph,
	createProjectMemberHandle,
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
import { removeFile, snapshotFile, writeFile } from './filesystem';
import { FsDirStorageAdapter } from './storage-adapter';
import { withProjectLock } from './project-lock';
import {
	GAME_METADATA_MEMBER_ID,
	isMarkdownFileDocument,
	isProjectHistoryDocument,
	type GameMetadataDocument,
	type MarkdownFileDocument,
	type ProjectBranchId,
	type ProjectCheckpointId,
	type ProjectHistoryDocument,
	type ProjectMemberDocument
} from './model';
import type { ProjectMergePlan, ProjectMergeResolution } from './project-merge';
import {
	classifyProjectFile,
	projectComponentId,
	projectMemberId,
	scanProjectFiles,
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

export type ProjectSession = {
	name: string;
	files: FsDir;
	rootUrl: AutomergeUrl;
	historyUrl: AutomergeUrl;
	branchId: ProjectBranchId;
	readOnly: boolean;
	canEditStructure: boolean;
	metadataHandle: DocHandle<GameMetadataDocument>;
	getRulesHandle(): DocHandle<MarkdownFileDocument> | undefined;
	getComponentSvgHandle(
		componentName: string,
		side: 'front' | 'back'
	): DocHandle<SvgDocument> | undefined;
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
	writeFiles(
		files: Array<{ path: string; data: FsWriteData }>
	): Promise<Result<void, CollaborationError>>;
	renameComponent(oldName: string, newName: string): Promise<Result<void, CollaborationError>>;
	deleteComponent(name: string): Promise<Result<void, CollaborationError>>;
	sync(): Promise<Result<void, CollaborationError>>;
	close(): Promise<Result<void, CollaborationError>>;
};

export type OpenProjectSessionOptions = {
	network?: NetworkAdapterInterface[];
	joinHistoryUrl?: AutomergeUrl;
	onStatus?: (status: ReconciliationStatus) => void;
	pollIntervalMs?: number;
	saveDebounceMs?: number;
	checkpointId?: ProjectCheckpointId;
	onBranchCheckout?: (branchId: ProjectBranchId) => void;
};

export async function openProjectSession(
	project: FsDir,
	options: OpenProjectSessionOptions = {}
): Promise<Result<ProjectSession, CollaborationError>> {
	let repo: Repo | undefined;
	const opened = await tryAsync({
		try: async () => {
			const storage = await project.ensureDir(AUTOMERGE_STORAGE_DIR);
			if (storage.error) throw new Error(storage.error.message, { cause: storage.error });
			const storageEntries = await storage.data.list();
			if (storageEntries.error) {
				throw new Error(storageEntries.error.message, { cause: storageEntries.error });
			}
			const hadStoredData = storageEntries.data.length > 0;
			const projectRepo = new Repo({
				storage: new FsDirStorageAdapter(storage.data, project.name),
				network: options.network ?? [new BroadcastChannelNetworkAdapter()],
				saveDebounceRate: options.saveDebounceMs
			});
			repo = projectRepo;

			const restored = await withProjectLock(`bootstrap:${project.name}`, () =>
				restoreOrCreateProject(project, projectRepo, hadStoredData, options.joinHistoryUrl)
			);
			const historyHandle = await projectRepo.find<ProjectHistoryDocument>(restored.historyUrl);
			if (!isProjectHistoryDocument(historyHandle.doc())) {
				throw new Error('The Automerge project history document is invalid.');
			}
			const lockId = restored.historyUrl;
			const activeBranch = await resolveBranchGraph(projectRepo, historyHandle);
			const branchId = activeBranch.branchId;
			if (options.checkpointId) {
				const checkpoint = historyHandle.doc()?.checkpoints[options.checkpointId];
				if (!checkpoint || checkpoint.branchId !== branchId) {
					throw new Error('The selected checkpoint does not belong to the checked-out branch.');
				}
				const checkpointGraph = await resolveProjectGraphAtCheckpoint(projectRepo, checkpoint);
				return createHistoricalProjectSession({
					project,
					repo: projectRepo,
					historyHandle,
					branchId,
					graph: checkpointGraph,
					options
				});
			}
			const rootHandle = activeBranch.graph.projectHandle;
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
				let graph = activeBranch.graph;
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
			let checkpointTimer: ReturnType<typeof setTimeout> | undefined;
			let checkpointPromise: Promise<void> | undefined;
			let checkpointDirty = false;
			let checkpointPaused = false;
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
					const listener = () => scheduleCheckpoint();
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
							memberId: '$project',
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
					await refresh();
					await reconciler.reconcileOrThrow();
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
			let refreshPromise: Promise<void> | undefined;
			let refreshAgain = false;
			function refresh(): Promise<void> {
				if (refreshPromise) {
					refreshAgain = true;
					return refreshPromise;
				}
				refreshPromise = (async () => {
					do {
						refreshAgain = false;
						const scanned = await scanProjectFiles(project);
						const refreshed = await withProjectLock(lockId, async () => {
							const latestConfig = await readProjectConfig(project);
							if (historyHandle.doc()?.checkedOutBranchId !== branchId) {
								throw new Error('The checked-out project branch changed.');
							}
							if (latestConfig?.rootHeads) {
								await waitForRootHeads(graph.projectHandle, latestConfig.rootHeads);
							}
							graph = await resolveProjectGraph(projectRepo, graph.projectHandle);
							config = latestConfig?.branchId === branchId ? latestConfig : reconciler.getConfig();
							return refreshProjectInventory(project, projectRepo, graph, config, scanned);
						});
						graph = refreshed.graph;
						config = refreshed.config;
						replaceCheckpointListeners();
						reconciler.replaceMembers(managedMembers(graph, config), config);
						if (refreshed.reconcileMemberIds.length) {
							void reconciler.requestReconcile(refreshed.reconcileMemberIds);
						}
						if (refreshed.scanChanged) refreshAgain = true;
					} while (refreshAgain);
				})().finally(() => {
					refreshPromise = undefined;
				});
				return refreshPromise;
			}
			function requestRefresh(): void {
				void refresh().catch((cause) => {
					const nextBranchId = historyHandle.doc()?.checkedOutBranchId;
					if (nextBranchId && nextBranchId !== branchId) {
						options.onBranchCheckout?.(nextBranchId);
						return;
					}
					options.onStatus?.({
						state: 'error',
						memberId: '$project',
						path: '.automerge/config.json',
						message: cause instanceof Error ? cause.message : String(cause)
					});
				});
			}
			const observer = createProjectFileObserver(requestRefresh, {
				pollIntervalMs: options.pollIntervalMs
			});
			const started = await tryAsync({
				try: () => reconciler.start(false),
				catch: (cause) => CollaborationError.ProjectOpenFailed({ project: project.name, cause })
			});
			if (started.error) {
				await reconciler.stop();
				throw started.error;
			}
			if (repaired.reconcileMemberIds.length) {
				await reconciler.requestReconcile(repaired.reconcileMemberIds);
				await reconciler.reconcileOrThrow();
			}
			const rootListener = requestRefresh;
			graph.projectHandle.on('change', rootListener);
			observer.start();
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
			async function synchronize(): Promise<void> {
				await refresh();
				await reconciler.reconcileOrThrow();
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
			function command(operation: () => Promise<void>): Promise<Result<void, CollaborationError>> {
				return tryAsync({
					try: async () => {
						await withProjectLock(lockId, async () => {
							const latestConfig = await readProjectConfig(project);
							if (latestConfig?.rootHeads) {
								await waitForRootHeads(graph.projectHandle, latestConfig.rootHeads);
							}
							graph = await resolveProjectGraph(projectRepo, graph.projectHandle);
							if (latestConfig?.branchId === branchId) config = latestConfig;
							await operation();
						});
						await refresh();
					},
					catch: (cause) =>
						CollaborationError.SynchronizationFailed({ project: project.name, cause })
				});
			}
			return {
				name: project.name,
				files: project,
				rootUrl: graph.projectHandle.url,
				historyUrl: restored.historyUrl,
				branchId,
				readOnly: false,
				canEditStructure: true,
				metadataHandle: graph.metadataHandle,
				getRulesHandle: () => rulesHandle(graph),
				getComponentSvgHandle: (componentName: string, side: 'front' | 'back') =>
					componentSvgHandle(graph, componentName, side),
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
				writeFiles: (files: Array<{ path: string; data: FsWriteData }>) =>
					tryAsync({
						try: async () => {
							const changedIds = new Set<string>();
							let needsRefresh = false;
							await withProjectLock(lockId, async () => {
								const latestConfig = await readProjectConfig(project);
								if (!latestConfig || latestConfig.branchId !== branchId) {
									throw new Error('The Automerge project configuration is unavailable.');
								}
								if (latestConfig.rootHeads) {
									await waitForRootHeads(graph.projectHandle, latestConfig.rootHeads);
								}
								graph = await resolveProjectGraph(projectRepo, graph.projectHandle);
								const repaired = await repairProjectConfig(project, graph, latestConfig);
								config = repaired.config;
								for (const id of repaired.reconcileMemberIds) changedIds.add(id);
								await Promise.all(files.map((file) => writeFile(project, file.path, file.data)));
								const scanned = await scanProjectFiles(
									project,
									files.map((file) => file.path)
								);
								const refreshed = await refreshProjectInventory(
									project,
									projectRepo,
									graph,
									config,
									scanned,
									true
								);
								graph = refreshed.graph;
								config = refreshed.config;
								needsRefresh = refreshed.scanChanged;
								for (const id of refreshed.reconcileMemberIds) changedIds.add(id);
								reconciler.replaceMembers(managedMembers(graph, config), config);
							});
							if (needsRefresh) await refresh();
							if (changedIds.size) {
								await reconciler.requestReconcile([...changedIds]);
							}
							await reconciler.reconcileOrThrow();
							if (refreshPromise) refreshAgain = true;
						},
						catch: (cause) =>
							CollaborationError.SynchronizationFailed({ project: project.name, cause })
					}),
				renameComponent: (oldName: string, newName: string) =>
					command(async () => {
						const document = graph.project;
						const component = Object.entries(document.components).find(
							([, value]) => value.name === oldName
						);
						if (!component) throw new Error(`Component "${oldName}" does not exist.`);
						if (Object.values(document.components).some((value) => value.name === newName)) {
							throw new Error(`Component "${newName}" already exists.`);
						}
						const source = joinFsPath(COMPONENTS_DIR, oldName);
						const target = joinFsPath(COMPONENTS_DIR, newName);
						const moved = await project.move(source, target);
						if (moved.error) throw new Error(moved.error.message, { cause: moved.error });
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
						await projectRepo.flush([graph.projectHandle.documentId]);
					}),
				deleteComponent: (name: string) =>
					command(async () => {
						const document = graph.project;
						const component = Object.entries(document.components).find(
							([, value]) => value.name === name
						);
						if (!component) throw new Error(`Component "${name}" does not exist.`);
						const removed = await project.remove(joinFsPath(COMPONENTS_DIR, name), {
							recursive: true
						});
						if (removed.error && removed.error.name !== 'NotFoundError') {
							throw new Error(removed.error.message, { cause: removed.error });
						}
						graph.projectHandle.change(
							(root) => {
								for (const [id, member] of Object.entries(root.members)) {
									if (member.componentId === component[0]) delete root.members[id];
								}
								delete root.components[component[0]];
							},
							{ message: `Delete component ${name}` }
						);
						await projectRepo.flush([graph.projectHandle.documentId]);
					}),
				sync: () =>
					tryAsync({
						try: synchronize,
						catch: (cause) =>
							CollaborationError.SynchronizationFailed({ project: project.name, cause })
					}),
				close: async () => {
					if (closed) return { data: undefined, error: null };
					checkpointPaused = true;
					if (checkpointTimer) {
						clearTimeout(checkpointTimer);
						checkpointTimer = undefined;
					}
					const closedSession = await tryAsync({
						try: async () => {
							await branchOperationPromise;
							await checkpointPromise;
							presence.close();
							svgInteractions.close();
							if (historyHandle.doc()?.checkedOutBranchId !== branchId) {
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
							await projectRepo.shutdown();
						},
						catch: (cause) =>
							CollaborationError.ProjectCloseFailed({ project: project.name, cause })
					});
					closed = true;
					presence.close();
					svgInteractions.close();
					for (const [handle, listener] of checkpointListeners) handle.off('change', listener);
					checkpointListeners.clear();
					historyHandle.off('change', historyListener);
					observer.stop();
					graph.projectHandle.off('change', rootListener);
					if (closedSession.error) {
						await reconciler.stop();
						await projectRepo.shutdown().catch(() => undefined);
					}
					return closedSession;
				}
			};
		},
		catch: (cause) => CollaborationError.ProjectOpenFailed({ project: project.name, cause })
	});

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
		files: createCheckpointProjectFiles(graph, project.name),
		rootUrl: graph.projectHandle.url,
		historyUrl: historyHandle.url,
		branchId,
		readOnly: true,
		canEditStructure: false,
		metadataHandle: graph.metadataHandle,
		getRulesHandle: () => rulesHandle(graph),
		getComponentSvgHandle: (componentName, side) => componentSvgHandle(graph, componentName, side),
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
		writeFiles: () => readOnly<void>(),
		renameComponent: () => readOnly<void>(),
		deleteComponent: () => readOnly<void>(),
		sync: () => tryAsync({ try: async () => undefined, catch: () => undefined as never }),
		close: async () => {
			if (closed) return { data: undefined, error: null };
			closed = true;
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
	joinHistoryUrl?: AutomergeUrl
): Promise<ProjectConfig> {
	const existing = await readProjectConfig(project);
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

	const bootstrapPaths = pending
		? Object.keys(pending.sources)
		: (await snapshotFile(project, 'rules.md'))
			? ['game.json', 'rules.md']
			: ['game.json'];
	const sources = await scanProjectFiles(project, bootstrapPaths);
	const sourceHashes = Object.fromEntries(
		sources.files.map(({ path, snapshot }) => [path, snapshot.hash])
	);
	if (pending && !sameSources(pending.sources, sourceHashes)) {
		throw new Error(`${PENDING_BOOTSTRAP_FILE} does not match the current project files.`);
	}
	if (!pending) await writePendingBootstrap(project, { version: 1, sources: sourceHashes });

	const graph = await createProjectGraph(repo, sources.files);
	const history = await createProjectHistory(repo, graph);
	const config = configFromGraph(
		graph,
		sources.files.map(({ path, snapshot }) => ({ path, snapshot })),
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
					hash: hashes.get(member.path) ?? null
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
	const members = Object.entries(project.members).map(([memberId, member]) => {
		const projection = config.projections[memberId];
		if (!projection || projection.path !== member.path || projection.url !== member.url) {
			throw new Error(`Project configuration does not match member ${memberId}.`);
		}
		const handle = graph.memberHandles.get(memberId);
		if (!handle) throw new Error(`Automerge project member ${memberId} has no document handle.`);
		return managedMember(memberId, member, handle);
	});
	if (Object.keys(config.projections).length !== members.length) {
		throw new Error('Project configuration contains projections not present in the project graph.');
	}
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
	if (!(await snapshotFile(project, 'rules.md'))) await writeFile(project, 'rules.md', '');
	const scanned = await scanProjectFiles(project, ['rules.md']);
	const source = scanned.files[0];
	if (!source) throw new Error('Could not read rules.md.');
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
	const latest = await resolveProjectGraph(repo, graph.projectHandle);
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
				hash: source.snapshot.hash
			}
		}
	};
	await writeProjectConfig(project, nextConfig);
	return { graph: latest, config: nextConfig };
}

function rulesHandle(graph: ProjectGraph): DocHandle<MarkdownFileDocument> | undefined {
	const entry = Object.entries(graph.project.members).find(([, member]) => member.kind === 'rules');
	if (!entry) return undefined;
	const handle = graph.memberHandles.get(entry[0]);
	if (!handle || !isMarkdownFileDocument(handle.doc())) {
		throw new Error('The Automerge rules document has an unsupported format.');
	}
	return handle as DocHandle<MarkdownFileDocument>;
}

function componentSvgHandle(
	graph: ProjectGraph,
	componentName: string,
	side: 'front' | 'back'
): DocHandle<SvgDocument> | undefined {
	const componentId = Object.entries(graph.project.components).find(
		([, component]) => component.name === componentName
	)?.[0];
	if (!componentId) return undefined;
	const entry = Object.entries(graph.project.members).find(
		([, member]) =>
			member.componentId === componentId &&
			member.kind === 'component-svg' &&
			classifyProjectFile(member.path)?.side === side
	);
	if (!entry) return undefined;
	const handle = graph.memberHandles.get(entry[0]);
	if (!handle || !isSvgDocument(handle.doc())) {
		throw new Error(`Component "${componentName}" ${side} SVG has an unsupported format.`);
	}
	return handle as DocHandle<SvgDocument>;
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
): Promise<{ config: ProjectConfig; reconcileMemberIds: string[] }> {
	const document = graph.project;
	const reconcileMemberIds: string[] = [];
	const paths = new Set(Object.values(document.members).map((member) => member.path));
	const componentNames = new Set(
		Object.values(document.components).map((component) => component.name)
	);
	const removedComponents = new Set<string>();
	for (const [id, projection] of Object.entries(config.projections)) {
		if (document.members[id]?.path === projection.path || paths.has(projection.path)) continue;
		const classification = classifyProjectFile(projection.path);
		if (!classification) continue;
		if (classification.componentName && !componentNames.has(classification.componentName)) {
			if (removedComponents.has(classification.componentName)) continue;
			removedComponents.add(classification.componentName);
			await removeFile(project, joinFsPath(COMPONENTS_DIR, classification.componentName), {
				recursive: true
			});
			continue;
		}
		await removeFile(project, projection.path);
	}
	const projections = Object.fromEntries(
		await Promise.all(
			Object.entries(document.members).map(async ([id, member]) => {
				const existing = config.projections[id];
				if (existing?.path === member.path && existing.url === member.url) {
					if (existing.materializeOnly) reconcileMemberIds.push(id);
					return [id, existing] as const;
				}
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
	return { config: repaired, reconcileMemberIds };
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
	scanned: Awaited<ReturnType<typeof scanProjectFiles>>,
	partial = false
): Promise<{
	graph: ProjectGraph;
	config: ProjectConfig;
	reconcileMemberIds: string[];
	scanChanged: boolean;
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
	let scanChanged = false;
	let structuralChanges = 0;
	const maxStructuralChanges = 4;

	for (const source of scanned.files) {
		const existing = memberByPath.get(source.path);
		if (!existing) {
			if (structuralChanges >= maxStructuralChanges) {
				scanChanged = true;
				continue;
			}
			if ((await snapshotFile(project, source.path))?.hash !== source.snapshot.hash) {
				scanChanged = true;
				continue;
			}
			const id = source.kind === 'game-metadata' ? GAME_METADATA_MEMBER_ID : projectMemberId();
			additions.push({
				id,
				source,
				handle: await createProjectMemberHandle(repo, source)
			});
			structuralChanges += 1;
			continue;
		}
		if (existing.member.kind !== 'asset' || source.kind !== 'asset') continue;
		const projection = config.projections[existing.id];
		const rootChanged =
			!projection ||
			projection.url !== existing.member.url ||
			projection.path !== existing.member.path;
		if (rootChanged || source.snapshot.hash === projection.hash) continue;
		if (structuralChanges >= maxStructuralChanges) {
			scanChanged = true;
			continue;
		}
		if ((await snapshotFile(project, source.path))?.hash !== source.snapshot.hash) {
			scanChanged = true;
			continue;
		}
		replacements.push({
			id: existing.id,
			source,
			handle: await createProjectMemberHandle(repo, source)
		});
		structuralChanges += 1;
	}

	for (const [id, member] of partial ? [] : Object.entries(current.members)) {
		if (member.kind === 'game-metadata' || member.kind === 'rules' || sourceByPath.has(member.path))
			continue;
		const projection = config.projections[id];
		if (
			projection &&
			projection.path === member.path &&
			projection.url === member.url &&
			projection.hash !== null
		) {
			if (structuralChanges >= maxStructuralChanges) {
				scanChanged = true;
				continue;
			}
			if (await snapshotFile(project, member.path)) {
				scanChanged = true;
				continue;
			}
			deletions.add(id);
			structuralChanges += 1;
		}
	}

	const componentNames = new Set(
		Object.values(current.components).map((component) => component.name)
	);
	const componentsChanged =
		componentNames.size !== scanned.components.length ||
		scanned.components.some((name) => !componentNames.has(name));
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
				for (const name of scanned.components) {
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
					if (scanned.components.includes(component.name)) continue;
					if (Object.values(document.members).some((member) => member.componentId === id)) continue;
					delete document.components[id];
				}
			},
			{ message: 'Reconcile project file inventory' }
		);
		await repo.flush([root.documentId]);
	}

	const latest = await resolveProjectGraph(repo, root);
	const latestProject = latest.project;
	const latestPaths = new Set(Object.values(latestProject.members).map((member) => member.path));
	for (const [id, projection] of Object.entries(config.projections)) {
		if (latestProject.members[id]?.path === projection.path || latestPaths.has(projection.path))
			continue;
		if (!classifyProjectFile(projection.path)) continue;
		await removeFile(project, projection.path);
	}
	const sourceHashes = new Map(scanned.files.map((source) => [source.path, source.snapshot.hash]));
	const localMemberIds = new Set([
		...additions.map((addition) => addition.id),
		...replacements.map((replacement) => replacement.id)
	]);
	const reconcileMemberIds = new Set<string>();
	const projections = Object.fromEntries(
		Object.entries(latestProject.members).map(([id, member]) => {
			const handle = memberHandle(latest, id);
			const existing = config.projections[id];
			const unchanged = existing?.path === member.path && existing.url === member.url;
			const filesystemIsCurrent =
				localMemberIds.has(id) || (existing?.url === member.url && sourceHashes.has(member.path));
			if (!unchanged) reconcileMemberIds.add(id);
			if (unchanged && existing.materializeOnly) reconcileMemberIds.add(id);
			if (
				unchanged &&
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
				id,
				unchanged
					? existing
					: {
							path: member.path,
							url: member.url,
							heads: handle.heads(),
							hash: sourceHashes.get(member.path) ?? null,
							...(filesystemIsCurrent ? {} : { materializeOnly: true })
						}
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
	await writeProjectConfig(project, nextConfig);
	return {
		graph: latest,
		config: nextConfig,
		reconcileMemberIds: [...reconcileMemberIds],
		scanChanged
	};
}
