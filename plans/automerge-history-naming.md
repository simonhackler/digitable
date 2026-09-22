# Automerge History Naming Plan

## Summary

Replace the generic `Project edit` title for newly recorded automatic checkpoints with concise semantic descriptions derived from the exact previous and new project checkpoints.

Examples:

```text
Renamed game to "Pocket Kingdoms"
Updated game description
Updated player count
Edited rules
Edited "Cards" front layout
Edited "Cards" spreadsheet
Added deck "Tokens"
Replaced asset "token.png"
Updated 3 files
```

Existing checkpoint messages remain unchanged.

## Goals

- Generate useful titles without an AI or LLM service.
- Describe the transition between two exact project checkpoints.
- Use project semantics rather than raw Automerge hashes.
- Preserve explicit operation and user-provided messages.
- Keep checkpoint history schema compatible.
- Never block checkpoint persistence because title generation failed.
- Group changes using the current checkpoint quiet-period behavior.

## Non-Goals

- Do not rename existing `Project edit` entries.
- Do not add editable commit-message UI in this feature.
- Do not use an LLM to generate titles.
- Do not generate prose descriptions of every low-level patch.
- Do not change checkpoint retention or garbage collection.
- Do not change the history scrubber or baseline model.
- Do not change the current 750 ms inactivity window in this feature.

## Current State

`project-session.ts` subscribes to the active root and every member handle. A document change resets a 750 ms timer. After the project is quiet, it synchronizes and calls:

```ts
recordProjectCheckpoint(repo, historyHandle, branchId, graph, 'Project edit');
```

`recordProjectCheckpoint()` captures the graph, deduplicates identical states, stores the supplied message, and flushes the history document.

The history sheet renders `checkpoint.message` directly.

Explicit messages currently include:

- `Initial project`.
- `Fork {branch name}`.
- `Before merging {branch name}`.
- `Merge {branch name}`.
- `Branch point`.
- `Before branch switch`.
- Messages passed through `createCheckpoint(message)`.

## Design

Add:

```text
packages/app/src/lib/collaboration/checkpoint-title.ts
```

Primary API:

```ts
export async function describeProjectCheckpoint(
	repo: Repo,
	previous: ProjectCheckpoint,
	next: ProjectCheckpoint
): Promise<string>;
```

The function reads only immutable checkpoint URLs and heads. It must not derive titles from current live handles because newer edits could arrive while description generation is running.

## Recording Flow

Change the internal checkpoint API so automatic messages are optional:

```ts
recordProjectCheckpoint(
  repo,
  historyHandle,
  branchId,
  graph,
  message?: string
)
```

New flow:

1. Capture the candidate checkpoint with a temporary fallback message.
2. Run the existing same-state deduplication.
3. If an identical checkpoint already exists, return it unchanged.
4. If the caller supplied a message, store it unchanged.
5. Otherwise locate the newest previous checkpoint on the same branch.
6. Derive a semantic title from Previous to Candidate.
7. Fall back to `Project edit` if derivation fails.
8. Insert and flush the new checkpoint.

Only the automatic quiet-period recorder omits the message. Explicit operations continue supplying messages.

Existing checkpoints are never rewritten or backfilled.

## Exact Historical Inputs

For both checkpoints:

1. Resolve `checkpoint.rootUrl`.
2. Open the root with `view(checkpoint.rootHeads)`.
3. Validate it as a supported `ProjectDocument`.
4. Match members by stable member ID.
5. Compare member heads as unordered sets.
6. Resolve historical member documents only when their semantic content is needed.

For a changed member:

```ts
const previousHandle = await repo.find(previousMember.url);
const previousDoc = previousHandle.view(previousMember.heads).doc();

const nextHandle = await repo.find(nextMember.url);
const nextDoc = nextHandle.view(nextMember.heads).doc();
```

Validate each historical document against its expected member kind before comparing it.

## Structural Title Rules

Structural root operations take precedence over ordinary content descriptions.

### Components

```text
One component added:
Added deck "{name}"

One component removed:
Deleted deck "{name}"

Same component ID, name changed:
Renamed deck "{old}" to "{new}"
```

A single component add, delete, or rename remains the primary title even when its associated front, back, and data members change in the same checkpoint.

Multiple or ambiguous component operations use:

```text
Updated project structure
```

### Members

```text
Asset added:
Added asset "{filename}"

Asset removed:
Deleted asset "{filename}"

Asset URL/hash replaced:
Replaced asset "{filename}"

Other member added:
Added "{path}"

Other member removed:
Deleted "{path}"

Same member ID, path changed:
Renamed "{oldPath}" to "{newPath}"

Member kind or logical content document replaced:
Replaced "{path}"
```

When a component operation explains the associated member operations, do not list those members separately.

## Game Metadata Rules

Compare these structured fields:

- `name`.
- `players`.
- `description`.
- `tags`.
- `digitableVersion`.
- `extra`.

Titles:

```text
Only name changed:
Renamed game to "{new name}"

Only player range changed:
Updated player count

Only description changed:
Updated game description

Only tags changed:
Updated game tags

Multiple known fields, extra, or version changed:
Updated game details
```

The new game name should be truncated to a safe display length before inclusion in the title.

## Member Content Rules

### Rules

```text
Edited rules
```

### Component SVG

Use the owning component name and side:

```text
Edited "{deck}" front layout
Edited "{deck}" back layout
```

Resolve the side from the component's stable front/back member references, with the path as a defensive fallback.

### Component Data

Use:

```text
Edited "{deck}" spreadsheet
```

Do not count individual cell, row, or column changes in this first version.

### Table Setup

```text
Edited table setup
```

### Feedback Registry

```text
Updated playtests
```

### Feedback Markdown

```text
Edited playtest "{filename without .md}"
```

### Asset Content

Assets normally change through root URL/hash replacement. If heads change without a manifest replacement, use:

```text
Updated asset "{filename}"
```

### Defensive Fallback

If exactly one changed member cannot be classified safely:

```text
Edited "{path}"
```

## Multiple Changed Members

If all changed members belong to one component:

```text
Updated deck "{name}"
```

If exactly two independent semantic descriptions are short, combine them:

```text
Edited rules and "Cards" front layout
```

For three or more independent files:

```text
Updated {count} files
```

Count logical changed members after removing member changes already explained by a component structural operation.

## Explicit Message Precedence

Explicit messages always win and bypass semantic derivation.

Preserve:

- Initial project messages.
- Fork messages.
- Merge preparation and result messages.
- Branch-point messages.
- Branch-switch messages.
- User or command messages passed through `createCheckpoint()`.

If an explicit checkpoint request finds an already existing identical checkpoint, return the existing checkpoint without changing its message.

## Debounce And Grouping

Keep the current trailing 750 ms quiet-period behavior.

```text
change
change
change
750 ms quiet
one checkpoint and one title
```

Consequences:

- Continuous title typing normally becomes one `Renamed game to "..."` entry.
- A pause longer than 750 ms can produce more than one checkpoint.
- Changes to several member documents within the quiet period receive one aggregate title.
- Explicit branch switch, close, fork, and merge flushes still capture pending state.

Separately evaluate a longer inactivity period after semantic naming is shipped and observed. Do not combine that behavior change with this feature.

## In-Flight Checkpoint Safety

Strengthen the recorder so a change arriving while checkpoint generation is active cannot be lost.

Track a pending rerun flag:

```text
checkpoint starts
new document change arrives
mark checkpoint dirty
checkpoint finishes
restart trailing timer
record the newer state
```

The current same-state deduplication remains the final guard against duplicate entries.

Before an explicit checkpoint operation:

1. Cancel the automatic timer.
2. Wait for an active automatic checkpoint promise.
3. Synchronize the project.
4. Record the explicitly named checkpoint.

## Failure Behavior

Semantic title generation is best-effort. Snapshot persistence is not.

Use this fallback boundary:

```ts
const title = await describeProjectCheckpoint(repo, previous, next).catch(() => 'Project edit');
```

Use `Project edit` when:

- No previous checkpoint exists for the branch.
- A required historical root/member view is unavailable.
- A historical document does not match its expected kind.
- The manifests are inconsistent.
- No supported semantic difference can be identified.
- Description generation throws unexpectedly.

Do not hide failures from checkpoint capture, document flush, history mutation, or storage. Those remain synchronization errors.

## Schema And Migration

No schema migration is required.

Keep:

```ts
type ProjectCheckpoint = {
	message: string;
	// existing fields
};
```

Keep `ProjectHistoryDocument.schemaVersion` unchanged.

Existing entries remain byte-for-byte unchanged, including existing `Project edit` messages.

The history sheet continues rendering `checkpoint.message` and needs no naming-specific state.

## Implementation Sequence

1. Add `checkpoint-title.ts` with historical root/member resolution helpers.
2. Implement structural root comparison and structural title precedence.
3. Implement game metadata field comparison.
4. Implement path/kind-based member descriptions.
5. Implement multiple-member aggregation.
6. Make `recordProjectCheckpoint()` accept an optional message.
7. Make the automatic recorder omit the message.
8. Preserve all explicit message call sites.
9. Add pending-rerun handling to the checkpoint recorder.
10. Add focused E2E coverage.
11. Update `automerge-current-integration.md` after verification.

## E2E Test Plan

Extend `e2e/project-branches.test.ts`. Use real project sessions and OPFS without mocks.

Required scenarios:

1. Change only game description and assert one `Updated game description` checkpoint.
2. Change only game name and assert `Renamed game to "New Name"`.
3. Change player range and description inside one quiet period and assert `Updated game details`.
4. Type multiple characters continuously and assert one checkpoint, not one per keystroke.
5. Edit rules and assert `Edited rules`.
6. Edit a front SVG and assert `Edited "{deck}" front layout`.
7. Edit component data and assert `Edited "{deck}" spreadsheet`.
8. Edit setup and assert `Edited table setup`.
9. Add a deck on Main and assert `Added deck "{name}"`.
10. Rename a deck and assert `Renamed deck "{old}" to "{new}"`.
11. Replace an asset and assert `Replaced asset "{filename}"`.
12. Change several unrelated files inside one quiet period and assert `Updated {count} files`.
13. Create a branch and assert explicit branch-point/fork messages remain unchanged.
14. Merge a branch and assert the explicit merge result message remains unchanged.
15. Confirm `Initial project` remains unchanged.

Do not corrupt stored Automerge documents to force the fallback path. The fallback is defensive; E2E coverage should verify every reachable normal member kind.

## Acceptance Criteria

- Newly created automatic checkpoints no longer use `Project edit` when their changes can be described safely.
- Editing only the game title produces `Renamed game to "..."`.
- Existing history entries are never renamed.
- Explicit checkpoint messages are preserved exactly.
- Titles are derived from exact checkpoint views, not live state or timestamps.
- Multiple rapid document changes produce one coherent aggregate title.
- A title-generation failure still records the checkpoint with `Project edit`.
- No AI service, network request, or user-authored commit message is required.

## Assumptions

- Checkpoints on one branch can be ordered by `createdAt` with checkpoint ID as the deterministic tie-breaker.
- Member and component IDs remain stable across ordinary rename operations.
- Historical views referenced by a stored checkpoint remain available in Automerge storage.
- Semantic descriptions are UI labels and do not affect merge, checkout, or checkpoint identity.
