import {
	isValidAutomergeUrl,
	type AutomergeUrl,
	type DocHandle,
	type Repo
} from '@automerge/automerge-repo';
import { assert } from '$lib/utils/assert';
import { hashBytes } from './filesystem';
import {
	GAME_METADATA_MEMBER_ID,
	isBinaryFileDocument,
	isProjectDocument,
	type ProjectBranchId,
	type ProjectCheckpoint,
	type ProjectCheckpointId,
	type ProjectComponent,
	type ProjectDocument,
	type ProjectMember,
	type ProjectMemberDocument
} from './model';
import { classifyProjectFile, type ProjectFileFingerprint } from './project-files';
import { isProjectMemberDocument } from './project-graph';

export type ProjectMergeChange = {
	kind:
		| 'member-added'
		| 'member-deleted'
		| 'member-renamed'
		| 'component-added'
		| 'component-deleted'
		| 'component-renamed'
		| 'component-slot-changed'
		| 'asset-replaced'
		| 'mutable-content-merged';
	label: string;
	memberId?: string;
	componentId?: string;
};

export type ProjectMergeConflictKind =
	| 'member-delete-modify'
	| 'member-add-add'
	| 'member-path'
	| 'member-kind'
	| 'member-component'
	| 'path-collision'
	| 'component-delete-modify'
	| 'component-name'
	| 'component-name-collision'
	| 'component-slot'
	| 'asset-content'
	| 'asset-delete-modify';

type ConflictValue = string | null | ProjectMember | ProjectComponent;
type ComponentSlot = 'frontMemberId' | 'backMemberId' | 'dataMemberId';
type ProjectMergeConflictBase = {
	id: string;
	label: string;
	base: ConflictValue;
	parent: ConflictValue;
	branch: ConflictValue;
	memberId?: string;
	componentId?: string;
	parentMemberId?: string;
	branchMemberId?: string;
	parentComponentId?: string;
	branchComponentId?: string;
	parentUrl?: AutomergeUrl;
	branchUrl?: AutomergeUrl;
	parentSlots?: Array<{ componentId: string; slot: ComponentSlot }>;
	branchSlots?: Array<{ componentId: string; slot: ComponentSlot }>;
	parentMembers?: Record<string, ProjectMember>;
	branchMembers?: Record<string, ProjectMember>;
	field?:
		| 'kind'
		| 'path'
		| 'componentId'
		| 'name'
		| 'frontMemberId'
		| 'backMemberId'
		| 'dataMemberId'
		| 'hash';
};

export type ProjectMergeConflict =
	| (ProjectMergeConflictBase & { kind: 'member-delete-modify' })
	| (ProjectMergeConflictBase & { kind: 'member-add-add' })
	| (ProjectMergeConflictBase & { kind: 'member-path' })
	| (ProjectMergeConflictBase & { kind: 'member-kind' })
	| (ProjectMergeConflictBase & { kind: 'member-component' })
	| (ProjectMergeConflictBase & { kind: 'path-collision' })
	| (ProjectMergeConflictBase & { kind: 'component-delete-modify' })
	| (ProjectMergeConflictBase & { kind: 'component-name' })
	| (ProjectMergeConflictBase & { kind: 'component-name-collision' })
	| (ProjectMergeConflictBase & { kind: 'component-slot' })
	| (ProjectMergeConflictBase & { kind: 'asset-content' })
	| (ProjectMergeConflictBase & { kind: 'asset-delete-modify' });

export type ProjectMergeResolution = {
	conflictId: string;
	choice: 'parent' | 'branch' | 'delete' | 'rename';
	name?: string;
	path?: string;
};

export type ProjectMergeAssetVersion = {
	hash: string;
	path: string;
	size: number;
	bytes: Uint8Array;
};

export type ProjectMergePlan = {
	id: string;
	sourceBranchId: ProjectBranchId;
	targetBranchId: ProjectBranchId;
	baseCheckpointId: ProjectCheckpointId;
	sourceCheckpointId: ProjectCheckpointId;
	targetCheckpointId: ProjectCheckpointId;
	sourceBranchName: string;
	targetBranchName: string;
	changes: ProjectMergeChange[];
	conflicts: ProjectMergeConflict[];
	assetDetails: Record<
		string,
		{
			base?: ProjectMergeAssetVersion;
			parent?: ProjectMergeAssetVersion;
			branch?: ProjectMergeAssetVersion;
		}
	>;
	finalMembers: ProjectDocument['members'];
	finalComponents: ProjectDocument['components'];
};

export type ResolvedProjectMerge = {
	members: ProjectDocument['members'];
	components: ProjectDocument['components'];
	mutableMemberIds: string[];
};

export type ProjectCheckpointSnapshot = {
	checkpoint: ProjectCheckpoint;
	project: ProjectDocument;
	assets: Record<string, ProjectMergeAssetVersion>;
};

export async function resolveProjectCheckpointSnapshot(
	repo: Repo,
	checkpoint: ProjectCheckpoint
): Promise<ProjectCheckpointSnapshot> {
	const root = await repo.find<ProjectDocument>(checkpoint.rootUrl);
	const project = root.view(checkpoint.rootHeads).doc();
	assert(isProjectDocument(project), `Checkpoint ${checkpoint.id} has no supported project root.`);
	const rootIds = Object.keys(project.members).sort();
	const checkpointIds = Object.keys(checkpoint.members).sort();
	assert(
		JSON.stringify(rootIds) === JSON.stringify(checkpointIds),
		`Checkpoint ${checkpoint.id} has an incomplete member manifest.`
	);
	const assets = Object.fromEntries(
		(
			await Promise.all(
				Object.entries(project.members).map(async ([id, member]) => {
					const version = checkpoint.members[id];
					assert(
						version &&
							version.url === member.url &&
							version.kind === member.kind &&
							version.path === member.path &&
							version.componentId === member.componentId &&
							version.hash === member.hash,
						`Checkpoint ${checkpoint.id} does not match member ${member.path}.`
					);
					const handle = await repo.find<ProjectMemberDocument>(version.url);
					const document = handle.view(version.heads).doc();
					assert(
						isProjectMemberDocument(member.kind, document),
						`Checkpoint member ${member.path} has an unsupported document.`
					);
					if (member.kind !== 'asset') return undefined;
					assert(
						isBinaryFileDocument(document),
						`Asset ${member.path} has an unsupported document.`
					);
					assert(member.hash, `Asset ${member.path} is missing its content hash.`);
					assert(
						(await hashBytes(document.content)) === member.hash,
						`Asset ${member.path} does not match its content hash.`
					);
					return [
						id,
						{
							hash: member.hash,
							path: member.path,
							size: document.content.byteLength,
							bytes: document.content
						}
					] as const;
				})
			)
		).filter((entry): entry is readonly [string, ProjectMergeAssetVersion] => !!entry)
	);
	return { checkpoint, project, assets };
}

export function createProjectMergePlan({
	id = crypto.randomUUID(),
	sourceBranchId,
	targetBranchId,
	sourceBranchName,
	targetBranchName,
	base,
	parent,
	branch
}: {
	id?: string;
	sourceBranchId: ProjectBranchId;
	targetBranchId: ProjectBranchId;
	sourceBranchName: string;
	targetBranchName: string;
	base: ProjectCheckpointSnapshot;
	parent: ProjectCheckpointSnapshot;
	branch: ProjectCheckpointSnapshot;
}): ProjectMergePlan {
	const changes: ProjectMergeChange[] = [];
	const conflicts: ProjectMergeConflict[] = [];
	const assetDetails: ProjectMergePlan['assetDetails'] = {};
	const members: ProjectDocument['members'] = {};
	const components: ProjectDocument['components'] = {};
	const conflict = (
		kind: ProjectMergeConflictKind,
		value: Omit<ProjectMergeConflictBase, 'id'>
	): string => {
		const conflictId = `${kind}:${value.memberId ?? value.componentId ?? crypto.randomUUID()}:${value.field ?? conflicts.length}`;
		conflicts.push({
			kind,
			id: conflictId,
			...value
		} as ProjectMergeConflict);
		return conflictId;
	};
	const mergeValue = <T>(baseValue: T, parentValue: T, branchValue: T) => {
		if (equal(branchValue, baseValue)) return { value: parentValue, conflict: false };
		if (equal(parentValue, baseValue)) return { value: branchValue, conflict: false };
		if (equal(branchValue, parentValue)) return { value: parentValue, conflict: false };
		return { value: parentValue, conflict: true };
	};

	const memberIds = new Set([
		...Object.keys(base.project.members),
		...Object.keys(parent.project.members),
		...Object.keys(branch.project.members)
	]);
	for (const memberId of memberIds) {
		const baseMember = base.project.members[memberId];
		const parentMember = parent.project.members[memberId];
		const branchMember = branch.project.members[memberId];
		if (!baseMember) {
			if (parentMember && branchMember) {
				members[memberId] = structuredClone(parentMember);
				conflict('member-add-add', {
					label: `Both branches added ${parentMember.path}`,
					base: null,
					parent: parentMember,
					branch: branchMember,
					memberId
				});
				continue;
			}
			const added = parentMember ?? branchMember;
			if (!added) continue;
			members[memberId] = structuredClone(added);
			if (branchMember)
				changes.push({ kind: 'member-added', label: `Add ${added.path}`, memberId });
			continue;
		}
		if (!parentMember || !branchMember) {
			if (!parentMember && !branchMember) {
				changes.push({ kind: 'member-deleted', label: `Delete ${baseMember.path}`, memberId });
				continue;
			}
			const retained = parentMember ?? branchMember!;
			const retainedCheckpoint = parentMember ? parent.checkpoint : branch.checkpoint;
			const unchanged =
				equal(memberStructure(baseMember), memberStructure(retained)) &&
				(baseMember.kind === 'asset'
					? baseMember.hash === retained.hash
					: sameHeads(
							base.checkpoint.members[memberId]?.heads,
							retainedCheckpoint.members[memberId]?.heads
						));
			if (unchanged) {
				changes.push({ kind: 'member-deleted', label: `Delete ${baseMember.path}`, memberId });
				continue;
			}
			members[memberId] = structuredClone(retained);
			const kind = baseMember.kind === 'asset' ? 'asset-delete-modify' : 'member-delete-modify';
			const conflictId = conflict(kind, {
				label: `${baseMember.path} was deleted and modified`,
				base: baseMember,
				parent: parentMember ?? null,
				branch: branchMember ?? null,
				memberId,
				parentSlots: memberSlots(parent.project, memberId),
				branchSlots: memberSlots(branch.project, memberId)
			});
			if (kind === 'asset-delete-modify') {
				assetDetails[conflictId] = {
					base: base.assets[memberId],
					parent: parent.assets[memberId],
					branch: branch.assets[memberId]
				};
			}
			continue;
		}

		const merged = structuredClone(parentMember);
		for (const [field, kind] of [
			['kind', 'member-kind'],
			['path', 'member-path'],
			['componentId', 'member-component']
		] as const) {
			const result = mergeValue(baseMember[field], parentMember[field], branchMember[field]);
			if (result.value === undefined && field === 'componentId') delete merged.componentId;
			if (result.value !== undefined) merged[field] = result.value as never;
			if (result.conflict) {
				conflict(kind, {
					label: `${baseMember.path} has conflicting ${field} changes`,
					base: baseMember[field] ?? null,
					parent: parentMember[field] ?? null,
					branch: branchMember[field] ?? null,
					memberId,
					field
				});
			}
		}
		if (merged.path !== baseMember.path && merged.path !== parentMember.path) {
			changes.push({
				kind: 'member-renamed',
				label: `Move ${baseMember.path} to ${merged.path}`,
				memberId
			});
		}
		if (
			baseMember.kind === 'asset' ||
			parentMember.kind === 'asset' ||
			branchMember.kind === 'asset'
		) {
			const result = mergeValue(baseMember.hash, parentMember.hash, branchMember.hash);
			merged.hash = result.value;
			if (result.value === branchMember.hash && result.value !== parentMember.hash)
				merged.url = branchMember.url;
			if (result.conflict) {
				const conflictId = conflict('asset-content', {
					label: `${baseMember.path} has different replacements`,
					base: baseMember.hash ?? null,
					parent: parentMember.hash ?? null,
					branch: branchMember.hash ?? null,
					memberId,
					parentUrl: parentMember.url,
					branchUrl: branchMember.url,
					field: 'hash'
				});
				assetDetails[conflictId] = {
					base: base.assets[memberId],
					parent: parent.assets[memberId],
					branch: branch.assets[memberId]
				};
			}
			if (merged.hash !== baseMember.hash) {
				changes.push({ kind: 'asset-replaced', label: `Replace ${merged.path}`, memberId });
			}
		} else {
			merged.url = parentMember.url;
			if (
				!sameHeads(
					base.checkpoint.members[memberId]?.heads,
					branch.checkpoint.members[memberId]?.heads
				)
			) {
				changes.push({
					kind: 'mutable-content-merged',
					label: `Merge changes in ${merged.path}`,
					memberId
				});
			}
		}
		members[memberId] = merged;
	}

	const componentIds = new Set([
		...Object.keys(base.project.components),
		...Object.keys(parent.project.components),
		...Object.keys(branch.project.components)
	]);
	for (const componentId of componentIds) {
		const baseComponent = base.project.components[componentId];
		const parentComponent = parent.project.components[componentId];
		const branchComponent = branch.project.components[componentId];
		if (!baseComponent) {
			if (parentComponent && branchComponent) {
				components[componentId] = structuredClone(parentComponent);
				conflict('component-name', {
					label: `Both branches added component ${parentComponent.name}`,
					base: null,
					parent: parentComponent,
					branch: branchComponent,
					componentId
				});
				continue;
			}
			const added = parentComponent ?? branchComponent;
			if (!added) continue;
			components[componentId] = structuredClone(added);
			if (branchComponent)
				changes.push({
					kind: 'component-added',
					label: `Add component ${added.name}`,
					componentId
				});
			continue;
		}
		if (!parentComponent || !branchComponent) {
			if (!parentComponent && !branchComponent) continue;
			const retained = parentComponent ?? branchComponent!;
			const retainedProject = parentComponent ? parent : branch;
			const changed =
				!equal(baseComponent, retained) ||
				componentMemberIds(baseComponent).some(
					(memberId) =>
						!sameHeads(
							base.checkpoint.members[memberId]?.heads,
							retainedProject.checkpoint.members[memberId]?.heads
						)
				);
			if (!changed) {
				changes.push({
					kind: 'component-deleted',
					label: `Delete component ${baseComponent.name}`,
					componentId
				});
				continue;
			}
			components[componentId] = structuredClone(retained);
			conflict('component-delete-modify', {
				label: `Component ${baseComponent.name} was deleted and modified`,
				base: baseComponent,
				parent: parentComponent ?? null,
				branch: branchComponent ?? null,
				componentId,
				parentMembers: componentMembers(parent.project, componentId),
				branchMembers: componentMembers(branch.project, componentId)
			});
			continue;
		}
		const merged = structuredClone(parentComponent);
		for (const field of ['name', 'frontMemberId', 'backMemberId', 'dataMemberId'] as const) {
			const result = mergeValue(
				baseComponent[field],
				parentComponent[field],
				branchComponent[field]
			);
			if (result.value === undefined && field !== 'name') delete merged[field];
			if (result.value !== undefined) merged[field] = result.value as never;
			if (result.conflict) {
				conflict(field === 'name' ? 'component-name' : 'component-slot', {
					label: `${baseComponent.name} has conflicting ${field} changes`,
					base: baseComponent[field] ?? null,
					parent: parentComponent[field] ?? null,
					branch: branchComponent[field] ?? null,
					componentId,
					field
				});
			}
		}
		if (merged.name !== baseComponent.name && merged.name !== parentComponent.name) {
			changes.push({
				kind: 'component-renamed',
				label: `Rename ${baseComponent.name} to ${merged.name}`,
				componentId
			});
		}
		components[componentId] = merged;
	}

	for (const entries of grouped(Object.entries(members), ([, member]) => member.path).values()) {
		if (entries.length < 2) continue;
		const path = entries[0][1].path;
		const parentEntry = entries.find(
			([memberId]) =>
				parent.project.members[memberId]?.path === path &&
				base.project.members[memberId]?.path !== path
		);
		const branchEntry = entries.find(
			([memberId]) =>
				branch.project.members[memberId]?.path === path &&
				base.project.members[memberId]?.path !== path
		);
		conflict('path-collision', {
			label: `Multiple members use ${path}`,
			base: null,
			parent: parentEntry?.[1] ?? entries[0][1],
			branch: branchEntry?.[1] ?? entries[1][1],
			memberId: parentEntry?.[0] ?? entries[0][0],
			parentMemberId: parentEntry?.[0] ?? entries[0][0],
			branchMemberId: branchEntry?.[0] ?? entries[1][0],
			field: 'path'
		});
	}
	for (const entries of grouped(
		Object.entries(components),
		([, component]) => component.name
	).values()) {
		if (entries.length < 2) continue;
		const name = entries[0][1].name;
		const parentEntry = entries.find(
			([componentId]) =>
				parent.project.components[componentId]?.name === name &&
				base.project.components[componentId]?.name !== name
		);
		const branchEntry = entries.find(
			([componentId]) =>
				branch.project.components[componentId]?.name === name &&
				base.project.components[componentId]?.name !== name
		);
		conflict('component-name-collision', {
			label: `Multiple components are named ${name}`,
			base: null,
			parent: parentEntry?.[1] ?? entries[0][1],
			branch: branchEntry?.[1] ?? entries[1][1],
			componentId: parentEntry?.[0] ?? entries[0][0],
			parentComponentId: parentEntry?.[0] ?? entries[0][0],
			branchComponentId: branchEntry?.[0] ?? entries[1][0],
			field: 'name'
		});
	}

	return {
		id,
		sourceBranchId,
		targetBranchId,
		baseCheckpointId: base.checkpoint.id,
		sourceCheckpointId: branch.checkpoint.id,
		targetCheckpointId: parent.checkpoint.id,
		sourceBranchName,
		targetBranchName,
		changes,
		conflicts,
		assetDetails,
		finalMembers: members,
		finalComponents: components
	};
}

export function resolveProjectMergePlan(
	plan: ProjectMergePlan,
	resolutions: ProjectMergeResolution[]
): ResolvedProjectMerge {
	const members = structuredClone(plan.finalMembers);
	const components = structuredClone(plan.finalComponents);
	const byId = new Map(resolutions.map((resolution) => [resolution.conflictId, resolution]));
	for (const conflict of plan.conflicts) {
		const resolution = byId.get(conflict.id);
		assert(resolution, `Choose a resolution for ${conflict.label}.`);
		if (conflict.kind === 'path-collision') {
			const branchId = conflict.branchMemberId;
			assert(branchId && members[branchId], 'The colliding branch member is unavailable.');
			if (resolution.choice === 'rename') {
				assert(resolution.path?.trim(), `${conflict.label} needs a new path.`);
				members[branchId].path = resolution.path!.trim();
				continue;
			}
			if (resolution.choice === 'branch') delete members[conflict.parentMemberId!];
			if (resolution.choice === 'parent' || resolution.choice === 'delete')
				delete members[branchId];
			continue;
		}
		if (conflict.kind === 'component-name-collision') {
			const branchId = conflict.branchComponentId;
			assert(branchId && components[branchId], 'The colliding branch component is unavailable.');
			if (resolution.choice === 'rename') {
				assert(resolution.name?.trim(), `${conflict.label} needs a new name.`);
				renameComponentStructure(members, components, branchId, resolution.name!.trim());
				continue;
			}
			const removed = resolution.choice === 'branch' ? conflict.parentComponentId! : branchId;
			delete components[removed];
			for (const id of Object.keys(members)) {
				if (members[id].componentId === removed) delete members[id];
			}
			continue;
		}
		if (conflict.memberId) {
			applyMemberResolution(members, components, conflict, resolution);
			continue;
		}
		if (conflict.componentId) applyComponentResolution(members, components, conflict, resolution);
	}
	const errors = validateProjectStructure({
		type: 'digitable-project',
		schemaVersion: 2,
		members,
		components
	});
	assert(errors.length === 0, errors[0]);
	return {
		members,
		components,
		mutableMemberIds: plan.changes
			.filter(
				(change) =>
					change.kind === 'mutable-content-merged' && change.memberId && members[change.memberId]
			)
			.map((change) => change.memberId!)
	};
}

export function validateProjectMergeResolutions(
	plan: ProjectMergePlan,
	resolutions: ProjectMergeResolution[]
): string[] {
	try {
		resolveProjectMergePlan(plan, resolutions);
		return [];
	} catch (cause) {
		return [cause instanceof Error ? cause.message : String(cause)];
	}
}

export function validateProjectStructure(project: ProjectDocument): string[] {
	const errors: string[] = [];
	const metadata = Object.entries(project.members).filter(
		([, member]) => member.kind === 'game-metadata'
	);
	if (
		metadata.length !== 1 ||
		metadata[0]?.[0] !== GAME_METADATA_MEMBER_ID ||
		project.members[GAME_METADATA_MEMBER_ID]?.path !== 'game.json'
	) {
		errors.push('The project must contain exactly one $metadata game.json member.');
	}
	const paths = new Set<string>();
	for (const [id, member] of Object.entries(project.members)) {
		if (!isValidAutomergeUrl(member.url)) errors.push(`Member ${member.path} has an invalid URL.`);
		const classification = classifyProjectFile(member.path);
		if (!classification || classification.kind !== member.kind) {
			errors.push(`Member ${member.path} is not a recognized ${member.kind} path.`);
		}
		if (paths.has(member.path)) errors.push(`Member path ${member.path} is not unique.`);
		paths.add(member.path);
		if (member.kind === 'asset' && !member.hash)
			errors.push(`Asset ${member.path} is missing its hash.`);
		if (member.kind !== 'asset' && member.hash !== undefined)
			errors.push(`Mutable member ${member.path} cannot have an asset hash.`);
		if (id === GAME_METADATA_MEMBER_ID && member.kind !== 'game-metadata')
			errors.push('$metadata must identify game metadata.');
	}
	const names = new Set<string>();
	const assignments = new Map<string, string>();
	for (const [componentId, component] of Object.entries(project.components)) {
		if (names.has(component.name)) errors.push(`Component name ${component.name} is not unique.`);
		names.add(component.name);
		for (const [slot, kind] of [
			['frontMemberId', 'component-svg'],
			['backMemberId', 'component-svg'],
			['dataMemberId', 'component-data']
		] as const) {
			const memberId = component[slot];
			if (!memberId) continue;
			const member = project.members[memberId];
			if (!member) {
				errors.push(`Component ${component.name} references a missing ${slot}.`);
				continue;
			}
			if (member.kind !== kind) errors.push(`Component ${component.name} has an invalid ${slot}.`);
			if (member.componentId !== componentId)
				errors.push(`Member ${member.path} belongs to the wrong component.`);
			const previous = assignments.get(memberId);
			if (previous && previous !== `${componentId}:${slot}`)
				errors.push(`Member ${member.path} is assigned to incompatible component slots.`);
			assignments.set(memberId, `${componentId}:${slot}`);
		}
	}
	for (const [memberId, member] of Object.entries(project.members)) {
		if (!member.componentId) continue;
		const component = project.components[member.componentId];
		if (!component) {
			errors.push(`Member ${member.path} references a missing component.`);
			continue;
		}
		const classification = classifyProjectFile(member.path);
		if (classification?.componentName !== component.name)
			errors.push(`Member ${member.path} does not match component ${component.name}.`);
		const expectedSlot =
			member.kind === 'component-data'
				? 'dataMemberId'
				: classification?.side === 'front'
					? 'frontMemberId'
					: classification?.side === 'back'
						? 'backMemberId'
						: undefined;
		if (expectedSlot && component[expectedSlot] !== memberId)
			errors.push(`Member ${member.path} is not assigned to its component slot.`);
	}
	return errors;
}

export async function applyProjectMerge({
	repo,
	targetRoot,
	branch,
	resolved
}: {
	repo: Repo;
	targetRoot: DocHandle<ProjectDocument>;
	branch: ProjectCheckpointSnapshot;
	resolved: ResolvedProjectMerge;
}): Promise<void> {
	await applyProjectMergeMembers({ repo, branch, resolved });
	await publishProjectMergeRoot(repo, targetRoot, resolved);
}

export async function applyProjectMergeMembers({
	repo,
	branch,
	resolved
}: {
	repo: Repo;
	branch: ProjectCheckpointSnapshot;
	resolved: ResolvedProjectMerge;
}): Promise<void> {
	for (const memberId of resolved.mutableMemberIds) {
		const targetMember = resolved.members[memberId];
		const sourceMember = branch.checkpoint.members[memberId];
		if (!targetMember || !sourceMember || targetMember.kind === 'asset') continue;
		const target = await repo.find<ProjectMemberDocument>(targetMember.url);
		const source = await repo.find<ProjectMemberDocument>(sourceMember.url);
		target.merge(source.view(sourceMember.heads));
		await repo.flush([target.documentId]);
	}
	for (const member of Object.values(resolved.members)) {
		if (member.kind !== 'asset') continue;
		const handle = await repo.find<ProjectMemberDocument>(member.url);
		const document = handle.doc();
		assert(isBinaryFileDocument(document) && member.hash, `Asset ${member.path} is unavailable.`);
		assert(
			(await hashBytes(document.content)) === member.hash,
			`Asset ${member.path} failed verification.`
		);
	}
}

export async function publishProjectMergeRoot(
	repo: Repo,
	targetRoot: DocHandle<ProjectDocument>,
	resolved: ResolvedProjectMerge
): Promise<void> {
	targetRoot.change(
		(project) => {
			project.members = structuredClone(resolved.members);
			project.components = structuredClone(resolved.components);
		},
		{ message: 'Publish structural branch merge' }
	);
	await repo.flush([targetRoot.documentId]);
}

export async function assetPreview(
	repo: Repo,
	url: AutomergeUrl
): Promise<ProjectFileFingerprint & { bytes: Uint8Array }> {
	const handle = await repo.find<ProjectMemberDocument>(url);
	const document = handle.doc();
	assert(isBinaryFileDocument(document), 'The selected asset is unavailable.');
	return {
		bytes: document.content,
		hash: await hashBytes(document.content),
		size: document.content.byteLength,
		lastModified: 0
	};
}

function applyMemberResolution(
	members: ProjectDocument['members'],
	components: ProjectDocument['components'],
	conflict: ProjectMergeConflict,
	resolution: ProjectMergeResolution
): void {
	const id = conflict.memberId!;
	if (resolution.choice === 'delete') {
		delete members[id];
		clearMemberSlots(components, id);
		return;
	}
	if (resolution.choice === 'rename') {
		assert(resolution.path?.trim() && members[id], `${conflict.label} needs a new path.`);
		members[id].path = resolution.path!.trim();
		return;
	}
	const selected = resolution.choice === 'branch' ? conflict.branch : conflict.parent;
	if (selected === null) {
		if (!conflict.field) {
			delete members[id];
			clearMemberSlots(components, id);
		}
		if (conflict.field === 'componentId') delete members[id].componentId;
		if (conflict.field === 'hash') delete members[id].hash;
		return;
	}
	if (
		(conflict.field === 'kind' ||
			conflict.field === 'path' ||
			conflict.field === 'componentId' ||
			conflict.field === 'hash') &&
		members[id] &&
		typeof selected === 'string'
	) {
		members[id][conflict.field] = selected as never;
		if (conflict.field === 'hash') {
			const url = resolution.choice === 'branch' ? conflict.branchUrl : conflict.parentUrl;
			if (url) members[id].url = url;
		}
		return;
	}
	if (typeof selected === 'object' && 'path' in selected) {
		members[id] = structuredClone(selected);
		const slots = resolution.choice === 'branch' ? conflict.branchSlots : conflict.parentSlots;
		for (const assignment of slots ?? []) {
			if (components[assignment.componentId])
				components[assignment.componentId][assignment.slot] = id;
		}
	}
}

function applyComponentResolution(
	members: ProjectDocument['members'],
	components: ProjectDocument['components'],
	conflict: ProjectMergeConflict,
	resolution: ProjectMergeResolution
): void {
	const id = conflict.componentId!;
	if (resolution.choice === 'delete') {
		delete components[id];
		for (const memberId of Object.keys(members)) {
			if (members[memberId].componentId === id) delete members[memberId];
		}
		return;
	}
	if (resolution.choice === 'rename') {
		assert(resolution.name?.trim() && components[id], `${conflict.label} needs a new name.`);
		renameComponentStructure(members, components, id, resolution.name!.trim());
		return;
	}
	const selected = resolution.choice === 'branch' ? conflict.branch : conflict.parent;
	if (selected === null) {
		if (!conflict.field) delete components[id];
		if (conflict.field === 'frontMemberId') delete components[id].frontMemberId;
		if (conflict.field === 'backMemberId') delete components[id].backMemberId;
		if (conflict.field === 'dataMemberId') delete components[id].dataMemberId;
		return;
	}
	if (conflict.field && components[id] && typeof selected === 'string') {
		components[id][conflict.field as keyof ProjectComponent] = selected as never;
		return;
	}
	if (typeof selected === 'object' && 'name' in selected)
		components[id] = structuredClone(selected);
	const related = resolution.choice === 'branch' ? conflict.branchMembers : conflict.parentMembers;
	for (const [memberId, member] of Object.entries(related ?? {})) {
		members[memberId] = structuredClone(member);
	}
}

function renameComponentStructure(
	members: ProjectDocument['members'],
	components: ProjectDocument['components'],
	componentId: string,
	name: string
): void {
	const component = components[componentId];
	assert(component, 'The component to rename is unavailable.');
	const oldPrefix = `components/${component.name}/`;
	const newPrefix = `components/${name}/`;
	component.name = name;
	for (const member of Object.values(members)) {
		if (member.componentId === componentId && member.path.startsWith(oldPrefix)) {
			member.path = `${newPrefix}${member.path.slice(oldPrefix.length)}`;
		}
	}
}

function memberStructure(member: ProjectMember): Omit<ProjectMember, 'url' | 'hash'> {
	return { kind: member.kind, path: member.path, componentId: member.componentId };
}

function componentMemberIds(component: ProjectComponent): string[] {
	return [component.frontMemberId, component.backMemberId, component.dataMemberId].filter(
		(value): value is string => !!value
	);
}

function memberSlots(
	project: ProjectDocument,
	memberId: string
): Array<{ componentId: string; slot: ComponentSlot }> {
	const result: Array<{ componentId: string; slot: ComponentSlot }> = [];
	for (const [componentId, component] of Object.entries(project.components)) {
		for (const slot of ['frontMemberId', 'backMemberId', 'dataMemberId'] as const) {
			if (component[slot] === memberId) result.push({ componentId, slot });
		}
	}
	return result;
}

function componentMembers(
	project: ProjectDocument,
	componentId: string
): Record<string, ProjectMember> {
	return Object.fromEntries(
		Object.entries(project.members)
			.filter(([, member]) => member.componentId === componentId)
			.map(([id, member]) => [id, structuredClone(member)])
	);
}

function clearMemberSlots(components: ProjectDocument['components'], memberId: string): void {
	for (const component of Object.values(components)) {
		if (component.frontMemberId === memberId) delete component.frontMemberId;
		if (component.backMemberId === memberId) delete component.backMemberId;
		if (component.dataMemberId === memberId) delete component.dataMemberId;
	}
}

function sameHeads(
	left: readonly string[] | undefined,
	right: readonly string[] | undefined
): boolean {
	if (!left || !right) return left === right;
	return left.length === right.length && left.every((head) => right.includes(head));
}

function equal(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function grouped<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
	const result = new Map<string, T[]>();
	for (const value of values) result.set(key(value), [...(result.get(key(value)) ?? []), value]);
	return result;
}
