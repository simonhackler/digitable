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
import { BroadcastChannelNetworkAdapter } from '@automerge/automerge-repo-network-broadcastchannel';
import { defineErrors, extractErrorMessage, type InferErrors } from 'wellcrafted/error';
import { tryAsync, type Result } from 'wellcrafted/result';
import { createProjectFileObserver } from './file-observer';
import { createProjectGraph, resolveProjectGraph, type ProjectGraph } from './project-graph';
import {
	AUTOMERGE_STORAGE_DIR,
	PENDING_BOOTSTRAP_FILE,
	readPendingBootstrap,
	readProjectConfig,
	removePendingBootstrap,
	writePendingBootstrap,
	writeProjectConfig,
	type ProjectConfig
} from './project-config';
import {
	componentDataMember,
	createProjectReconciler,
	binaryMember,
	importManagedTextMember,
	metadataMember,
	textMember,
	type ManagedMember,
	type ReconciliationStatus
} from './reconciler';
import { decodeText, removeFile, snapshotFile, writeFile } from './filesystem';
import { FsDirStorageAdapter } from './storage-adapter';
import { withProjectLock } from './project-lock';
import {
	GAME_METADATA_MEMBER_ID,
	isLegacyProjectDocument,
	isProjectDocument,
	type BinaryFileDocument,
	type ComponentDataDocument,
	type GameMetadataDocument,
	type LegacyProjectDocument,
	type ProjectDocument,
	type ProjectMemberDocument,
	type TextFileDocument
} from './model';
import {
	classifyProjectFile,
	projectComponentId,
	projectMemberId,
	scanProjectFiles,
	type ProjectFileFingerprint,
	type ProjectFileSource
} from './project-files';

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
	rootUrl: AutomergeUrl;
	metadataHandle: DocHandle<GameMetadataDocument>;
	componentDataHandles: ReadonlyMap<string, DocHandle<ComponentDataDocument>>;
	getConfig(): ProjectConfig;
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
	onStatus?: (status: ReconciliationStatus) => void;
	pollIntervalMs?: number;
	saveDebounceMs?: number;
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
				restoreOrCreateProject(project, projectRepo, hadStoredData)
			);
			const rootHandle = await projectRepo.find(restored.rootUrl);
			const openedGraph = await withProjectLock(restored.rootUrl, async () => {
				const latestConfig = await readProjectConfig(project);
				if (latestConfig?.rootHeads) await waitForRootHeads(rootHandle, latestConfig.rootHeads);
				const graph = await resolveProjectGraph(projectRepo, rootHandle);
				const repaired = await repairProjectConfig(
					project,
					graph,
					latestConfig?.rootUrl === restored.rootUrl ? latestConfig : restored
				);
				return { graph, repaired };
			});
			let graph = openedGraph.graph;
			const repaired = openedGraph.repaired;
			let config = repaired.config;
			const fileCache = new Map<string, ProjectFileFingerprint>();
			const members = managedMembers(graph, config);
			const reconciler = createProjectReconciler({
				fs: project,
				repo: projectRepo,
				initialConfig: config,
				members,
				onStatus: options.onStatus,
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
						const scanned = await scanProjectFiles(project, fileCache);
						const refreshed = await withProjectLock(restored.rootUrl, async () => {
							const latestConfig = await readProjectConfig(project);
							if (latestConfig?.rootHeads) {
								await waitForRootHeads(graph.projectHandle, latestConfig.rootHeads);
							}
							graph = await resolveProjectGraph(projectRepo, graph.projectHandle);
							config =
								latestConfig?.rootUrl === restored.rootUrl ? latestConfig : reconciler.getConfig();
							return refreshProjectInventory(project, projectRepo, graph, config, scanned);
						});
						graph = refreshed.graph;
						config = refreshed.config;
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

			let closed = false;
			async function synchronize(): Promise<void> {
				await refresh();
				await reconciler.reconcileOrThrow();
			}
			function command(operation: () => Promise<void>): Promise<Result<void, CollaborationError>> {
				return tryAsync({
					try: async () => {
						await withProjectLock(restored.rootUrl, async () => {
							const latestConfig = await readProjectConfig(project);
							if (latestConfig?.rootHeads) {
								await waitForRootHeads(graph.projectHandle, latestConfig.rootHeads);
							}
							graph = await resolveProjectGraph(projectRepo, graph.projectHandle);
							if (latestConfig?.rootUrl === restored.rootUrl) config = latestConfig;
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
				rootUrl: graph.projectHandle.url,
				metadataHandle: graph.metadataHandle,
				componentDataHandles: graph.componentDataHandles,
				getConfig: reconciler.getConfig,
				writeFiles: (files: Array<{ path: string; data: FsWriteData }>) =>
					tryAsync({
						try: async () => {
							const changedIds: string[] = [];
							await withProjectLock(restored.rootUrl, async () => {
								const latestConfig = await readProjectConfig(project);
								if (!latestConfig || latestConfig.rootUrl !== restored.rootUrl) {
									throw new Error('The Automerge project configuration is unavailable.');
								}
								if (latestConfig.rootHeads) {
									await waitForRootHeads(graph.projectHandle, latestConfig.rootHeads);
								}
								graph = await resolveProjectGraph(projectRepo, graph.projectHandle);
								const repaired = await repairProjectConfig(project, graph, latestConfig);
								config = repaired.config;
								changedIds.push(...repaired.reconcileMemberIds);
								await Promise.all(files.map((file) => writeFile(project, file.path, file.data)));
								const scanned = await scanProjectFiles(
									project,
									fileCache,
									files.map((file) => file.path)
								);
								const membersByPath = new Map(
									Object.entries(graph.project.members).map(([id, member]) => [
										member.path,
										{ id, member }
									])
								);
								const managed = new Map(
									managedMembers(graph, config).map((member) => [member.id, member])
								);
								const created = new Map<string, DocHandle<ProjectMemberDocument>>();
								for (const source of scanned.files) {
									const entry = membersByPath.get(source.path);
									if (!entry) {
										created.set(
											projectMemberId(source.path),
											projectRepo.create<ProjectMemberDocument>(await source.document())
										);
										continue;
									}
									if (entry.member.kind !== source.kind) {
										throw new Error(`${source.path} changed project file kind.`);
									}
									if (source.kind === 'asset') {
										created.set(
											entry.id,
											projectRepo.create<ProjectMemberDocument>(await source.document())
										);
										continue;
									}
									const projection = config.projections[entry.id];
									const member = managed.get(entry.id);
									if (!projection || !member) continue;
									importManagedTextMember(
										member,
										projection,
										decodeText((await snapshotFile(project, source.path))!.bytes),
										source.snapshot.hash
									);
									changedIds.push(entry.id);
								}
								await projectRepo.flush([
									...changedIds.flatMap((id) => {
										const handle = graph.memberHandles.get(id);
										return handle ? [handle.documentId] : [];
									}),
									...Array.from(created.values(), (handle) => handle.documentId)
								]);
								if (created.size) {
									graph.projectHandle.change(
										(root) => {
											const componentIds = new Map(
												Object.entries(root.components).map(([id, component]) => [
													component.name,
													id
												])
											);
											for (const source of scanned.files) {
												const existing = membersByPath.get(source.path);
												const id = existing?.id ?? projectMemberId(source.path);
												const handle = created.get(id);
												if (!handle) continue;
												if (existing) {
													root.members[id].url = handle.url;
													root.members[id].hash = source.snapshot.hash;
													continue;
												}
												const componentId = source.componentName
													? (componentIds.get(source.componentName) ??
														projectComponentId(source.componentName))
													: undefined;
												if (source.componentName && componentId && !root.components[componentId]) {
													componentIds.set(source.componentName, componentId);
													root.components[componentId] = { name: source.componentName };
												}
												root.members[id] = {
													kind: source.kind,
													path: source.path,
													url: handle.url,
													...(source.kind === 'asset' ? { hash: source.snapshot.hash } : {}),
													...(componentId ? { componentId } : {})
												};
												if (!componentId) continue;
												if (source.kind === 'component-data')
													root.components[componentId].dataMemberId = id;
												if (source.side === 'front')
													root.components[componentId].frontMemberId = id;
												if (source.side === 'back') root.components[componentId].backMemberId = id;
											}
										},
										{ message: 'Write project files' }
									);
									await projectRepo.flush([graph.projectHandle.documentId]);
								}
								graph = await resolveProjectGraph(projectRepo, graph.projectHandle);
								const sourceByPath = new Map(scanned.files.map((source) => [source.path, source]));
								const projections = Object.fromEntries(
									Object.entries(graph.project.members).map(([id, member]) => {
										const source = sourceByPath.get(member.path);
										const previous = config.projections[id];
										if (!source && previous?.path === member.path && previous.url === member.url) {
											return [id, previous];
										}
										return [
											id,
											{
												path: member.path,
												url: member.url,
												heads: memberHandle(graph, id).heads(),
												hash: source?.snapshot.hash ?? previous?.hash ?? null
											}
										];
									})
								);
								config = {
									version: 2,
									rootUrl: graph.projectHandle.url,
									rootHeads: graph.projectHandle.heads(),
									projections
								};
								await writeProjectConfig(project, config);
								reconciler.replaceMembers(managedMembers(graph, config), config);
							});
							if (changedIds.length) {
								await reconciler.requestReconcile(changedIds);
								await reconciler.reconcileOrThrow();
							}
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
					closed = true;
					observer.stop();
					graph.projectHandle.off('change', rootListener);
					const closedSession = await tryAsync({
						try: async () => {
							await refreshPromise;
							await refresh();
							await reconciler.reconcileOrThrow();
							await reconciler.stop();
							await projectRepo.shutdown();
						},
						catch: (cause) =>
							CollaborationError.ProjectCloseFailed({ project: project.name, cause })
					});
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

async function restoreOrCreateProject(
	project: FsDir,
	repo: Repo,
	hadStoredData: boolean
): Promise<ProjectConfig> {
	const existing = await readProjectConfig(project);
	const pending = await readPendingBootstrap(project);
	if (existing) {
		if (pending?.config?.rootUrl === existing.rootUrl) await removePendingBootstrap(project);
		if (existing.version === 2) return existing;
		return upgradeProject(project, repo, existing);
	}
	if (pending?.config) {
		await writeProjectConfig(project, pending.config);
		await removePendingBootstrap(project);
		if (pending.config.version === 2) return pending.config;
		return upgradeProject(project, repo, pending.config);
	}
	if (!pending && hadStoredData) {
		throw new Error(
			'Project contains Automerge storage but is missing .automerge/config.json; refusing to create a new project identity.'
		);
	}

	const sources = await scanProjectFiles(project, undefined, ['game.json']);
	const sourceHashes = Object.fromEntries(
		sources.files.map(({ path, snapshot }) => [path, snapshot.hash])
	);
	if (pending && !sameSources(pending.sources, sourceHashes)) {
		throw new Error(`${PENDING_BOOTSTRAP_FILE} does not match the current project files.`);
	}
	if (!pending) await writePendingBootstrap(project, { version: 1, sources: sourceHashes });

	const graph = await createProjectGraph(repo, sources.files);
	const config = configFromGraph(
		graph,
		sources.files.map(({ path, snapshot }) => ({ path, snapshot }))
	);
	await writePendingBootstrap(project, { version: 1, sources: sourceHashes, config });
	await writeProjectConfig(project, config);
	await removePendingBootstrap(project);
	return config;
}

function configFromGraph(
	graph: ProjectGraph,
	snapshots: Array<{ path: string; snapshot: { hash: string } }>
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
		version: 2,
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
		if (member.kind === 'game-metadata') {
			if (memberId !== GAME_METADATA_MEMBER_ID) {
				throw new Error(`Unexpected game metadata member ${memberId}.`);
			}
			return metadataMember(memberId, member.path, graph.metadataHandle);
		}
		const handle = graph.memberHandles.get(memberId);
		if (!handle) throw new Error(`Automerge project member ${memberId} has no document handle.`);
		if (member.kind === 'component-data') {
			return componentDataMember(memberId, member.path, handle as DocHandle<ComponentDataDocument>);
		}
		if (member.kind === 'asset') {
			if (!member.hash) throw new Error(`Binary member ${member.path} is missing its hash.`);
			return binaryMember(
				memberId,
				member.path,
				member.hash,
				handle as DocHandle<BinaryFileDocument>
			);
		}
		return textMember(memberId, member.path, member.kind, handle as DocHandle<TextFileDocument>);
	});
	if (Object.keys(config.projections).length !== members.length) {
		throw new Error('Project configuration contains projections not present in the project graph.');
	}
	return members;
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
		version: 2,
		rootUrl: graph.projectHandle.url,
		rootHeads: graph.projectHandle.heads(),
		projections
	};
	if (JSON.stringify(repaired) !== JSON.stringify(config))
		await writeProjectConfig(project, repaired);
	return { config: repaired, reconcileMemberIds };
}

async function upgradeProject(
	project: FsDir,
	repo: Repo,
	config: ProjectConfig
): Promise<ProjectConfig> {
	const root = await repo.find<ProjectDocument | LegacyProjectDocument>(config.rootUrl);
	const current = root.doc();
	if (!isProjectDocument(current) && !isLegacyProjectDocument(current)) {
		throw new Error('The Automerge root document is not a supported Digitable project.');
	}
	if (current.schemaVersion === 1) {
		root.change(
			(document) => {
				const mutable = document as unknown as ProjectDocument;
				const components: ProjectDocument['components'] = Object.fromEntries(
					Object.entries(document.components).map(([id, component]) => [id, { ...component }])
				);
				for (const [componentId, component] of Object.entries(components)) {
					if (!component.dataMemberId) continue;
					const member = mutable.members[component.dataMemberId];
					if (member) member.componentId = componentId;
				}
				mutable.components = components;
				mutable.schemaVersion = 2;
			},
			{ message: 'Upgrade project file graph' }
		);
	}
	await repo.flush([root.documentId]);
	const upgraded: ProjectConfig = { ...config, version: 2, rootHeads: root.heads() };
	await writeProjectConfig(project, upgraded);
	return upgraded;
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
			const id =
				source.kind === 'game-metadata' ? GAME_METADATA_MEMBER_ID : projectMemberId(source.path);
			additions.push({
				id,
				source,
				handle: repo.create<ProjectMemberDocument>(await source.document())
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
			handle: repo.create<ProjectMemberDocument>(await source.document())
		});
		structuralChanges += 1;
	}

	for (const [id, member] of Object.entries(current.members)) {
		if (member.kind === 'game-metadata' || sourceByPath.has(member.path)) continue;
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

	if (additions.length || replacements.length || deletions.size) {
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
					const id = projectComponentId(name);
					componentIds.set(name, id);
					document.components[id] = { name };
				}
				for (const id of deletions) {
					const expected = current.members[id];
					if (!expected || document.members[id]?.url !== expected.url) continue;
					delete document.members[id];
					for (const component of Object.values(document.components)) {
						if (component.frontMemberId === id) delete component.frontMemberId;
						if (component.backMemberId === id) delete component.backMemberId;
						if (component.dataMemberId === id) delete component.dataMemberId;
					}
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
					if (!componentId) continue;
					const component = document.components[componentId];
					if (addition.source.kind === 'component-data') component.dataMemberId = addition.id;
					if (addition.source.side === 'front') component.frontMemberId = addition.id;
					if (addition.source.side === 'back') component.backMemberId = addition.id;
				}
				for (const [id, component] of Object.entries(document.components)) {
					if (scanned.components.includes(component.name)) continue;
					if (component.frontMemberId || component.backMemberId || component.dataMemberId) continue;
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
		version: 2,
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
