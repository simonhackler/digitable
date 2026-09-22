# Automerge Three-Way Structural Merge Plan

## Summary

Allow writable branches to add, remove, rename, and reorganize project members and to replace immutable assets. Merge those changes into the parent using exact Base, Parent, and Branch checkpoints while continuing to use Automerge's normal CRDT merge for mutable member-document contents.

This plan keeps the current eager branch graph architecture. It does not introduce Patchwork-style copy-on-write overlays or shared-history root clones.

## Goals

- Merge independent structural changes made on a branch and its parent.
- Detect structural conflicts instead of rejecting every structural difference.
- Merge immutable asset references by content hash.
- Keep mutable member-document merging delegated to Automerge.
- Present a complete merge preview before mutating the parent.
- Require an explicit resolution for every conflict.
- Make the multi-document merge retryable after a crash or reload.
- Preserve existing project, member, component, branch, and checkpoint identities.
- Remove the current Main-only structural-editing restriction after the merge path is safe.

## Non-Goals

- Do not replace eager branch cloning with copy-on-write overlays.
- Do not merge the branch root Automerge document directly into the parent root.
- Do not attempt content-aware merging of arbitrary binary files.
- Do not invent a fork base from timestamps when a valid checkpoint is unavailable.
- Do not rewrite existing member or component IDs during migration.
- Do not make all multi-document writes physically atomic; use a recoverable journal instead.

## Current State

The current branch system stores:

- `ProjectBranch.parentBranchId`, which selects the merge target.
- `ProjectBranch.forkCheckpointId`, which identifies the exact project state from which the branch was created.
- Complete `ProjectCheckpoint` records containing root heads and per-member URLs and heads.
- Eagerly cloned branch roots and member documents.
- A version-1 pending merge journal containing only source and target branch IDs.

Current merge behavior in `project-history.ts`:

1. Resolves the source and target graphs.
2. Requires their normalized structures to be identical.
3. Rejects any differing asset hash.
4. Merges corresponding mutable member handles.
5. Records the resulting target checkpoint.
6. Marks the source merged and checks out the parent.

Writable non-Main branches currently cannot:

- Add project files.
- Delete project files.
- Create components.
- Rename components.
- Delete components.
- Replace immutable assets.

## Three-Way Inputs

Every merge must use three immutable project checkpoints:

```text
Base
= source branch's forkCheckpointId

Parent
= target branch checkpoint captured immediately before merge preparation

Branch
= source branch checkpoint captured immediately before merge preparation
```

The inputs must not be recomputed from live graphs after the user reviews the merge.

The source branch's original fork checkpoint remains its Base even if the source is later reparented because an ancestor branch was merged.

## Identity Model

Three-way matching relies on stable member and component IDs.

Existing IDs remain unchanged. `$metadata` remains the reserved game metadata ID.

Newly created members and components should use opaque UUIDs rather than path-derived IDs. This prevents these cases from collapsing into the same registry key:

- Parent and Branch independently add different members at the same path.
- A component is renamed and the old name is later reused.
- Two branches independently create components with the same name.

Project commands already run under the project Web Lock and revalidate current paths before publishing. That serialization is sufficient for same-browser creation. Future cross-device creation must rely on collision validation after CRDT convergence.

## Merge Model

Add a dedicated module:

```text
packages/app/src/lib/collaboration/project-merge.ts
```

The module owns pure planning, conflict validation, and resolved-plan application. `project-history.ts` remains responsible for branch/checkpoint persistence and merge finalization.

Suggested types:

```ts
type ProjectMergePlan = {
	id: string;
	sourceBranchId: ProjectBranchId;
	targetBranchId: ProjectBranchId;
	baseCheckpointId: ProjectCheckpointId;
	sourceCheckpointId: ProjectCheckpointId;
	targetCheckpointId: ProjectCheckpointId;
	changes: ProjectMergeChange[];
	conflicts: ProjectMergeConflict[];
};

type ProjectMergeResolution = {
	conflictId: string;
	choice: 'parent' | 'branch' | 'delete' | 'rename';
	name?: string;
	path?: string;
};
```

`ProjectMergeChange` should describe an automatically resolved operation such as:

- Member added.
- Member deleted.
- Member renamed or moved.
- Component added.
- Component deleted.
- Component renamed.
- Component slot changed.
- Asset replaced.
- Mutable member contents merged.

## Three-Way Value Rule

For a scalar or optional structural value:

```text
Branch == Base  => use Parent
Parent == Base  => use Branch
Branch == Parent => use either
otherwise       => conflict
```

Absence is a real value. Creation and deletion use the same rule as ordinary fields.

Examples:

```text
Base:   Cards
Parent: Cards
Branch: Playing Cards
Result: Playing Cards
```

```text
Base:   Cards
Parent: Playing Cards
Branch: Encounter Cards
Result: component-name conflict
```

## Root Snapshot Resolution

Load each root at its checkpoint URL and heads. Validate it as a supported `ProjectDocument` before planning.

Do not compare branch-local mutable member URLs as authored structure. A branch necessarily points at cloned mutable documents.

Compare these member properties semantically:

- Presence or deletion.
- `kind`.
- `path`.
- `componentId`.
- Asset `hash` and immutable content identity.

Compare these component properties by stable component ID:

- Presence or deletion.
- `name`.
- `frontMemberId`.
- `backMemberId`.
- `dataMemberId`.

## Member Merge Rules

### Existing Mutable Members

If Base, Parent, and Branch retain the same logical mutable member:

1. Three-way merge its structural fields.
2. Keep the Parent member URL in the final root.
3. Merge the Branch member handle into the Parent member handle with Automerge.
4. Flush the Parent handle before publishing the final root.

Mutable member kinds are:

- Game metadata.
- Rules Markdown.
- Component SVG.
- Component data.
- Table setup.
- Feedback registry.
- Feedback Markdown.

### Source-Only Additions

If the Branch adds a member and Parent has no conflicting addition:

- Adopt the Branch member document into the Parent graph.
- Preserve the new member ID.
- Publish the Branch member URL in the Parent root.
- Verify its kind and recognized path before publishing.

### Target-Only Additions

Keep the Parent member unchanged.

### Deletion

If one side deletes a member and the other side is unchanged from Base, accept the deletion.

If one side deletes a member while the other changes its structure or contents, create a `member-delete-modify` conflict.

The content-change test compares member heads against the Base checkpoint, not just root metadata.

### Independent Additions

Members added independently with different IDs can coexist only if their final paths do not collide and their component relationships remain valid.

Members added independently at the same path create a `path-collision` conflict.

## Component Merge Rules

Merge components by stable component ID.

A one-sided component rename composes with opposite-side member content edits because the member IDs remain stable.

A component deletion conflicts with an opposite-side rename, slot change, or member content change.

After field-level merging, validate component names and slot relationships globally.

## Immutable Asset Merge

Assets are immutable documents. Compare them by BLAKE3 hash, not document URL.

Rules:

```text
Parent hash == Branch hash => no conflict
Branch hash == Base hash   => keep Parent
Parent hash == Base hash   => use Branch
Both changed differently  => asset-content conflict
```

Delete versus replacement creates an `asset-delete-modify` conflict.

Before publishing a selected asset:

1. Resolve the selected Automerge URL.
2. Validate the binary document schema.
3. Recalculate BLAKE3 from its bytes.
4. Require it to match the selected root hash.

Forking should stop cloning unchanged immutable binary documents. A fork should initially reuse the checkpoint's asset URL and hash. Replacing the asset later creates a new immutable document.

## Conflict Taxonomy

Use a typed discriminated union. Do not expose merge conflicts as unstructured error strings.

Required conflict variants:

- `member-delete-modify`
- `member-add-add`
- `member-path`
- `member-kind`
- `member-component`
- `path-collision`
- `component-delete-modify`
- `component-name`
- `component-name-collision`
- `component-slot`
- `asset-content`
- `asset-delete-modify`

Preparation failures that are not user-resolvable conflicts:

- Missing fork checkpoint.
- Fork checkpoint belongs to the wrong branch.
- Missing historical document heads.
- Unsupported root or member schema.
- Asset hash verification failure.
- Corrupt component/member references.
- Source or target changed while the plan was being prepared.

## Final Root Validation

Before any parent root mutation, validate the resolved structure:

- Exactly one `$metadata` member exists.
- Every member URL is valid.
- Every asset has a hash.
- Member paths are unique.
- Component names are unique.
- Every member path is recognized for its kind.
- Every component slot references an existing member.
- Front and back slots reference component SVG members.
- Data slots reference component data members.
- Referenced members carry the expected `componentId`.
- One member is not assigned to incompatible component slots.

If validation fails, return a typed conflict when the user can resolve it. Otherwise fail preparation without mutating the parent.

## Session API

Replace the single-step merge API with preparation and commit:

```ts
prepareMergeToParent(): Promise<Result<ProjectMergePlan, CollaborationError>>;

commitMergeToParent(
  planId: string,
  resolutions: ProjectMergeResolution[]
): Promise<Result<ProjectCheckpointId, CollaborationError>>;
```

Preparation must:

1. Synchronize the source branch.
2. Capture the Source checkpoint.
3. Capture the current Parent checkpoint.
4. Resolve the Base checkpoint from `forkCheckpointId`.
5. Build and return a plan without changing Parent.

Commit must:

1. Load the exact checkpoints recorded in the plan.
2. Reject the plan if live Source or Parent no longer matches those checkpoints.
3. Validate all required conflict resolutions.
4. Write the recovery journal.
5. Apply and flush member operations.
6. Publish the final Parent root in one root change.
7. Record the result checkpoint and merge metadata.

## Merge Preview UI

Add:

```text
packages/app/src/routes/games/project-merge-dialog.svelte
```

Replace the native confirmation in `project-branches.svelte`.

The dialog shows:

- Source and target branch names.
- Automatically merged structural changes.
- Mutable files whose CRDT histories will merge.
- Every unresolved conflict.
- Base, Parent, and Branch values for the selected conflict.
- Asset hashes, byte sizes, and image previews when supported.

Resolution controls:

- Keep Parent.
- Use Branch.
- Delete.
- Rename or choose a new path for collision conflicts.

Disable the merge action until every conflict has a valid resolution and the final structure passes validation.

If Source or Parent changes after preparation, close the stale plan and require a new review.

## Operation Journal

Upgrade `.automerge/pending-branch-operation.json` to version 2.

Suggested shape:

```ts
type PendingMergeOperation = {
	version: 2;
	type: 'merge';
	operationId: string;
	phase:
		| 'prepared'
		| 'members-applied'
		| 'root-published'
		| 'checkpoint-recorded'
		| 'history-finalized';
	sourceBranchId: ProjectBranchId;
	targetBranchId: ProjectBranchId;
	baseCheckpointId: ProjectCheckpointId;
	sourceCheckpointId: ProjectCheckpointId;
	targetCheckpointId: ProjectCheckpointId;
	resolutions: ProjectMergeResolution[];
	finalMembers: ProjectDocument['members'];
	finalComponents: ProjectDocument['components'];
	resultCheckpointId?: ProjectCheckpointId;
};
```

Do not store binary bytes in the journal. Store verified asset URL/hash references.

Commit phases:

1. Write `prepared` after resolutions and validation.
2. Apply and flush mutable merges and source-only documents.
3. Advance to `members-applied`.
4. Apply the complete final root structure and flush.
5. Advance to `root-published`.
6. Record the exact Parent result checkpoint.
7. Advance to `checkpoint-recorded`.
8. Add the merge record under `operationId`, mark the source merged, reparent children, and check out Parent.
9. Flush history and advance to `history-finalized`.
10. Remove the journal.

Recovery must be idempotent:

- Repeated Automerge member merges are safe.
- Root assignments write the same planned structure.
- The merge record uses the stable `operationId`.
- Recovery never captures newer Source or Parent heads.
- Recovery removes the journal only after finalized history is flushed.

Continue accepting the version-1 merge journal long enough to recover projects created by the current implementation.

## History Schema

Upgrade `ProjectHistoryDocument` to schema version 2.

Recommended changes:

```ts
type ProjectBranch = {
	name: string;
	rootUrl: AutomergeUrl;
	parentBranchId?: ProjectBranchId;
	baseCheckpointId?: ProjectCheckpointId;
	baseBranchId?: ProjectBranchId;
	createdAt: number;
	mergedAt?: number;
	deletedAt?: number;
};

type ProjectMerge = {
	id: string;
	sourceBranchId: ProjectBranchId;
	targetBranchId: ProjectBranchId;
	baseCheckpointId: ProjectCheckpointId;
	sourceCheckpointId: ProjectCheckpointId;
	targetCheckpointId: ProjectCheckpointId;
	resultCheckpointId: ProjectCheckpointId;
	createdAt: number;
};
```

Migration from history schema 1:

1. Recover any version-1 pending merge first.
2. Rename `forkCheckpointId` to `baseCheckpointId` semantically.
3. Set `baseBranchId` from the referenced checkpoint.
4. Preserve all branch, root, checkpoint, member, and component identities.
5. Preserve completed schema-1 merge records as legacy records.
6. Fail safely if a non-Main branch has no valid Base checkpoint.
7. Flush the history upgrade before opening a writable session.

Project root schema version 2 can remain unchanged.

## Removing Branch Restrictions

Only remove restrictions after merge planning, conflict resolution, journaling, migration, and E2E coverage are complete.

Then:

- Set `canEditStructure` for every writable branch.
- Show create, rename, and delete controls on writable branches.
- Permit new paths and asset replacement in `writeFiles()`.
- Permit component rename and deletion commands on branches.
- Replace `assertBranchStructureUnchanged()` with normal branch inventory reconciliation.
- Remove exact-structure and equal-asset preflight rejection.

Historical checkpoint sessions remain read-only.

## Implementation Sequence

1. Introduce opaque IDs for newly created members and components.
2. Reuse immutable asset documents during fork.
3. Add history schema 2 and migration.
4. Add pure checkpoint/root diff and final-root validation.
5. Add typed merge plans and conflicts.
6. Add automatic resolution rules for non-conflicting changes.
7. Add the preview and conflict-resolution dialog.
8. Add the version-2 phased merge journal and recovery.
9. Add resolved-plan application and history finalization.
10. Add focused E2E coverage through the real integrated flow.
11. Remove branch structural-editing restrictions.
12. Update `automerge-current-integration.md` after the feature is verified.

## E2E Test Plan

Extend `e2e/project-branches.test.ts`. Use real OPFS, Automerge documents, BroadcastChannel synchronization, and application routes. Do not mock routes, storage, or browser APIs.

Required scenarios:

1. Branch adds and renames a component while Parent edits unrelated metadata; both survive merge.
2. Branch deletes a component while Parent edits that component; preview reports delete/modify conflict.
3. Parent and Branch independently add the same component path; preview reports path/name collision.
4. User resolves a collision by renaming one side; both components remain usable.
5. Branch replaces an asset while Parent changes an unrelated file; asset replacement merges automatically.
6. Parent and Branch replace the same asset with different bytes; preview reports asset conflict.
7. Parent and Branch replace the same asset with identical bytes; no conflict is shown.
8. One side renames a component while the other edits its SVG/data; the edit appears at the renamed path.
9. Branch deletes a member while Parent leaves it unchanged; deletion is applied without a conflict.
10. Nested child retains its original Base after its parent branch is merged and the child is reparented.
11. Reload after every journal phase resumes to exactly one completed merge.
12. Two tabs converge on the resolved Parent checkout and materialized structure.
13. Base historical checkpoints continue to materialize their original paths and asset bytes after merge.
14. History records Base, Source, Target, and Result checkpoint IDs for the merge.

Follow the repository's red-green E2E workflow and run only the focused scenario under development.

## Acceptance Criteria

- Writable branches support all recognized structural project operations.
- Independent Parent and Branch structure changes compose without data loss.
- Every ambiguous operation becomes a typed conflict.
- The user cannot commit a merge with unresolved conflicts.
- Existing mutable member documents continue to merge through Automerge.
- Immutable assets merge by verified content hash.
- The Parent root never receives branch-plumbing URLs for common mutable members.
- A crash during merge resumes from the reviewed checkpoints and resolutions.
- A completed merge produces one result checkpoint and one merge record.
- Existing schema-1 histories and pending merge journals migrate or recover safely.

## Assumptions

- Branches continue eagerly cloning mutable members in this implementation.
- `forkCheckpointId` is valid for every existing non-Main branch created by the current system.
- Existing component and member IDs remain stable after creation.
- Same-browser structural commands remain serialized by the project Web Lock.
- Cross-device networking remains outside this feature, but merge data structures must converge safely when it is later added.
