# Automerge Current Integration

## Status

Automerge is authoritative for every recognized authoring file in a project.

Recognized files are:

- `game.json`
- `rules.md`
- `components/<component>/front.svg`
- `components/<component>/back.svg`
- `components/<component>/data.csv`
- `assets/**`
- `setup/table.svg`
- `feedback/playtests.json`
- `feedback/**/*.md`

The project scanner deliberately ignores unknown paths. It also excludes:

- `.automerge/**`, which contains local Automerge repository state and journals.
- `tts-export/**`, which contains generated Tabletop Simulator results.

Generated images below `assets/generated/**` are synchronized because project data can reference them as authoring inputs.

Synchronization connects same-origin browser tabs through `BroadcastChannel` and signed-in browsers through the authenticated `/app/sync` WebSocket service.

## Project Graph

Each project has one stable root Automerge document using schema version 2.

The root document contains:

- A dynamic member registry.
- Stable component records independent of directory names.
- Stable file member IDs independent of component renames.
- File paths, document kinds, and linked Automerge URLs.
- BLAKE3 hashes for binary members.

New file and component records use opaque UUIDs. Existing IDs are preserved. Paths and component names are validated separately, so independent branches can represent different additions at the same path and report that ambiguity during merge instead of collapsing both additions into one registry key.

Components are represented even when they have no `data.csv`. Their optional front, back, and data member references are stored separately.

Replicated member paths are validated against the recognized-file policy before their linked documents are resolved or materialized. A root document cannot use a member entry to overwrite `.automerge`, `tts-export`, or an unknown project path.

## Member Documents

### Game metadata

`game.json` retains its structured metadata document:

- `name`
- Atomic `{ min, max }` player range
- `description`
- `tags`
- Optional `digitableVersion`
- Unknown JSON properties in `extra`

Known text fields use Automerge text updates. Unknown JSON properties survive form edits and canonical materialization.

### Component data

`data.csv` uses a structured document with stable row and column IDs, explicit row and column ordering, and Automerge text cells.

Initial and external CSV imports accept missing row IDs and assign deterministic internal IDs. Adoption preserves the original projection bytes; spreadsheet saves materialize the stable IDs.

The spreadsheet still emits complete CSV projections, but in-app writes are imported directly into the linked component document at the last projected heads. Reconciliation then processes only that member.

### Text files

The following files currently use linked Automerge text documents:

- `setup/table.svg`
- Feedback Markdown
- The playtest feedback registry

In-app writes update these linked documents through the project session. External editor changes are imported with `changeAt()` using the recorded projection heads.

Table files currently merge as text. Moving setup to its typed table model remains future work.

### Component SVG

Component `front.svg` and `back.svg` use normalized semantic SVG documents owned by `@svg-table/svgeditor`. Each document stores a stable root ID, a flat node registry, and a resource registry. Nodes remain at a stable registry key while their atomic placement register supplies parent and dense globally unique sibling order. Deletion uses node tombstones rather than removing records.

Known geometry, decomposed transforms, presentation, paint, image sources, path commands, polygon points, and text are structured independently. Path commands and points have their own stable IDs, tombstones, and dense order identifiers. Unknown SVG elements and attributes retain defensive raw projections so existing project SVGs continue to round-trip.

The rendered hierarchy is derived from child-to-parent placements. Missing parents fall back deterministically, deleted ancestors hide descendants, and cycles are broken at a deterministic node ID. Stable node, path-command, and point identities are materialized as reserved SVG data attributes so filesystem edits can retain application identity.

Existing linked text documents migrate in place without replacing their Automerge URL. External SVG changes are parsed and applied at the recorded projection heads, mutating existing semantic fields instead of replacing whole node objects.

The mounted layout editor binds directly to each side's document handle. Local editor changes use `changeAt()` from the heads represented by the canvas, while remote document changes install a sanitized projection without remounting the Svelte editor. Projection application preserves selection, mode, and zoom, suppresses local echo events, and clears SVG-Edit undo history because its commands retain DOM references replaced by a remote projection.

### Rules Markdown

`rules.md` uses a dedicated linked Markdown document whose `content` field is Automerge rich text. A project-owned Markdown schema and codec define the supported ProseMirror nodes, Automerge blocks and marks, and Markdown projection.

The mounted rules editor binds directly to the member handle through `@automerge/prosemirror`. Local ProseMirror transactions update Automerge immediately, and remote Automerge patches update the mounted editor without a filesystem round trip or remount.

Existing schema-version-1 text documents are migrated in place, preserving their linked Automerge URL. External filesystem changes are parsed as Markdown and applied with `changeAt()` at the recorded projection heads before being merged with the current rich-text document.

### Binary assets

Assets use immutable linked Automerge documents following the Backstitch model.

The root member stores:

```text
path -> Automerge URL + BLAKE3 hash
```

The linked binary document stores:

```text
{
  type: "binary-file",
  schemaVersion: 1,
  content: Uint8Array
}
```

Replacing an asset performs these operations:

1. Read and hash the complete new file.
2. Create a new Automerge binary document.
3. Flush that document before publishing its URL.
4. Change the root member to point to the new URL and hash.
5. Retain the previous binary document through project history.

Receiving sessions resolve the linked document with `repo.find()`, verify its BLAKE3 hash, and only then materialize its bytes.

Binary payloads do not inflate the root document. There is currently no hash deduplication or external blob protocol.

## Dynamic Inventory

The active session scans recognized paths after opening and while the project remains mounted.

It handles:

- New recognized files.
- New components, including empty components.
- External text changes.
- Binary replacements.
- Optional file deletion.
- Root members added, removed, relinked, or renamed by another tab.

Refresh requests are coalesced. If a file or root change occurs during an active refresh, one dirty rerun processes the newer state immediately.

Every synchronization scan verifies current file bytes with BLAKE3. Size and modification time are recorded for diagnostics but are never trusted as content identity.

Reconciliation tracks exact dirty member IDs. A CSV or SVG edit no longer causes every project member to be reserialized.

## Project Commands

The session exposes commands for:

- Writing one or more project files.
- Renaming a component.
- Deleting a component.
- Flushing all pending project work.

Blank component creation, rename, and deletion use these commands. Component rename changes member paths while preserving component and member IDs.

CSV, table SVG, uploaded assets, and generated assets write through the active project session. Rules and component SVGs edit their linked handles directly and use session reconciliation for filesystem materialization. Premade deck generation and feedback import hand their completed filesystem mutations to an explicit session sync.

New-path writes are projection-first so UI navigation does not wait for whole-project discovery. Existing managed text files are imported into Automerge before their save operation completes. Project switch, close, playtest export, and explicit synchronization await all pending refresh and reconciliation work.

## Bootstrap And Migration

New projects bootstrap a stable root and the required `game.json` member before rendering. The remaining recognized inventory is adopted immediately in the background.

Version 1 projects retain their existing root URL. Migration upgrades the root and config schema first, then dynamic inventory adopts the additional file types without replacing project identity.

Pending bootstrap configurations are recovered before source comparison. Existing Automerge storage without a config still fails safely instead of creating a replacement identity.

When the root and config differ after an interrupted root mutation, opening rebuilds affected projections from the loaded root. Those projections are marked materialization-only so stale filesystem bytes cannot be imported over a newer linked document.

Config version 2 records the root heads it represents. A tab that reads a newer shared config waits until its local root handle contains those heads before repairing or materializing project files.

Per-member pending materialization journals continue to protect file/config updates. Structural component operations are serialized with Web Locks. Branch merges use a version-2 phased journal that stores the reviewed checkpoint IDs, resolutions, final root registries, stable operation ID, and completed phase without storing binary bytes.

## Multi-Tab Coordination

Each tab owns a project-scoped Automerge Repo backed by `.automerge/storage`.

Coordination uses:

- BroadcastChannel for document synchronization.
- Web Locks for bootstrap, root/config changes, reconciliation, and storage adapter mutations.
- Latest-config rereads while holding the project lock.
- Opaque creation IDs and commit-time path revalidation.
- Projected heads to prevent stale filesystem imports.

Local save status distinguishes synchronization work from idle state. It does not imply acknowledgement from another device.

## Project Sharing

The project-history Automerge URL is the stable sharing identity. Share links use `/app/games/join#automerge:<document-id>` so the capability remains in the browser fragment rather than ordinary HTTP requests and access logs.

Sharing uses signed-in bearer capabilities. The reverse proxy authenticates the WebSocket connection, the sync server does not announce stored documents, and any signed-in user who knows a document URL can request it. Links grant edit access to the complete project history and can be forwarded; there are no project roles, membership records, expiry, or revocation yet.

Joining creates `.automerge/pending-join.json` before loading remote data. The client resolves and validates the history document, checked-out branch, root, and linked member documents, flushes them into project-local Repo storage, then writes a version-3 config whose projections are marked materialization-only. The normal reconciler creates every recognized project file without importing absent or stale destination bytes as edits. Failed joins remain resumable for the same history URL.

The active branch is loaded eagerly. Other branches and checkpoints remain available through the shared history document and are fetched when opened. A workspace scan prevents joining the same history URL into a second local folder.

## Ephemeral Presence

Each open project session attaches one application-owned presence service to the stable root document handle. Presence uses Automerge Repo's `DocHandle.broadcast()` and `ephemeral-message` event; cursor state is never written to an Automerge document or the filesystem.

Presence messages are versioned and runtime-validated. A message carries the collaborator display name, an exact page ID, and a receiver-resolvable pointer or null. The Automerge sender peer ID identifies a browser client and deterministically selects its cursor color, but it is not treated as a user identity. Email addresses are not broadcast.

The page ID combines the SvelteKit route ID with sorted dynamic parameters. Clients therefore share cursors only while viewing the same project page, including the same component on parameterized deck routes. Query parameters do not create separate presence scopes. A centralized route policy disables pointer presence on `PlaySurface` routes.

The service exchanges hello, complete state, and leave messages. Participant identity, page membership, and pointer position have separate update methods while each network message remains a replaceable complete state because ephemeral delivery is not guaranteed. Five-second heartbeats repair missed startup messages, stale clients expire after 60 seconds, visibility restoration reannounces current state, and normal project-session shutdown sends a best-effort leave before the Automerge Repo disconnects.

A layout-owned surface registry captures and resolves pointer positions against the receiver's current DOM. The registry is deliberately non-reactive: registration only updates its element maps, while the cursor layer recalculates geometry on actual scroll, resize, visibility, and remote-presence updates. The games layout registers the default project surface, while reusable Markdown and spreadsheet boundaries and the SVG editor pages register stable nested regions. Regions can use element-box, scroll-content, or visible-viewport coordinates. Rules and card previews use visible-viewport coordinates so cursor movement remains visible across different editor heights, while the spreadsheet uses scroll-content coordinates. Surface fallback positions render only across compatible responsive breakpoints. Unresolved or offscreen positions are hidden.

A single cursor layer in the games layout uses pointer events, prefers the deepest registered region, throttles outgoing updates, and renders matching peers above project content but below modal overlays. Hit testing prevents sidebars and portalled overlays from publishing positions over hidden page content. Routes that mount `PlaySurface` do not mount this cursor layer because the play surface owns its pointer interactions; multiplayer play routes are outside the games layout and are excluded as well.

The active project owns one reactive snapshot of remote presence, shared by the cursor layer and project sidebar. Sidebar navigation rows render compact shadcn-svelte Avatar fallback stacks for peers on Rules, each deck, TTS, Paper, Setup, Local Test, Playtests, and the project overview. Deck layout and spreadsheet routes aggregate on the corresponding deck row. Page membership is published even where pointer presence is disabled, so Local Test users remain visible without enabling cursors over `PlaySurface`. Stacks show at most three peer avatars followed by a remaining count; the local client is not included.

### SVG Interactions

Each project session also owns a separate SVG interaction service on the stable root handle. It uses its own versioned and runtime-validated ephemeral message namespace rather than extending cursor presence. Complete replaceable snapshots carry one active interaction plus retained commit handoffs, while monotonically increasing revisions prevent delayed messages from restoring stale previews.

One continuous SVG gesture produces many ephemeral updates and at most one durable Automerge change. Fill and stroke inputs use no-undo local preview transactions; move, resize, and rotation use lightweight values already calculated by SVGCanvas's transient `transition` events. The editor's native pointer path only stores the newest preview and schedules one animation-frame publication; it performs no collaboration-specific geometry reads, document cloning, validation, or networking. Wire updates are broadcast at most every 40 milliseconds with a trailing update. A 1.5-second heartbeat repairs dropped state, inactive local gestures expire after five seconds, and visual handoffs expire after two seconds.

Local SVGCanvas interaction is deliberately fail-open. Ephemeral channel startup, claim acquisition, validation, transport, and rendering never gate or cancel a gesture after SVGCanvas starts it. If the channel is unavailable, a claim races with the gesture, or an element does not yet have a semantic node ID, the local move/resize/rotation continues at native editor speed and still produces its normal durable mouse-up change; only the remote preview is omitted. Missing or duplicated semantic IDs are repaired on the durable change boundary so later interactions can be previewed.

The first transmitted movement state contains the first real delta, bounds, or angle calculated by SVGCanvas rather than a zero-valued placeholder. Subsequent native transitions only replace a plain pending preview. One animation-frame callback crosses the component boundary, and the project interaction service performs validation, cloning, revision updates, and throttled broadcast outside the browser's synchronous pointer-move callback.

Interactions are scoped by exact page ID and component SVG document ID, so front and back editors do not share previews. Claims use stable semantic node IDs and domains. Move and rotation claim transform, resize claims geometry and transform, while fill and stroke claim only their corresponding presentation domain. Compatible interactions compose. Claims already known at pointer-down block a conflicting gesture, but a gesture is never canceled after SVGCanvas starts moving; simultaneous races continue locally and converge through their final CRDT changes.

Remote previews render as pointer-inert SVG clones outside canonical `svgcontent`. Clone IDs are namespaced, ancestor transforms are projected relative to `svgcontent`, and compatible transform/fill/stroke previews compose without entering `getSvg()`, undo history, Automerge, filesystem projections, or exports. Preview nodes are keyed and cloned once; subsequent packets update only their transform or paint attributes on the existing overlay.

Remote interaction state has one propagation owner. Route subscriptions update Svelte state, the reference editor exposes claim state to controls, and the canvas host applies each accepted remote snapshot to the SVG overlay exactly once. Compatible local edits refresh an overlay's cached source state at animation-frame or durable-change boundaries without rebuilding it for every network packet.

On completion, the final editor projection is applied once with `changeAt()` at the heads captured when the interaction began. The active interaction becomes a visual-only commit handoff carrying the resulting heads; handoffs never participate in claim arbitration. Receivers observe the component Automerge handle directly with `hasHeads()` and remove a handoff as soon as its durable change is available, including when the durable change arrived before the ephemeral handoff. Handoffs can coexist with a new local interaction.

## Branches And Checkpoints

Project config version 3 links the stable project to a separate Automerge project-history document. Existing version 1 and 2 projects migrate in place without replacing their Main root or member document identities.

The history document contains:

- One project-global checked-out branch register.
- A parent-linked branch tree.
- Complete immutable project checkpoints.
- Merge records and branch tombstones.

Each branch is a normal complete project graph. Forking clones the root and mutable members at the selected checkpoint heads, then rewrites the cloned root to those cloned mutable member URLs. Immutable binary members initially reuse the checkpoint URL and hash. This eager mutable-clone model deliberately preserves the existing editor, reconciler, and filesystem contracts; branch-local copy-on-write overlays can be introduced later without changing the branch or checkpoint schema.

A checkpoint records the root URL and heads plus the URL, heads, kind, path, hash, and component identity of every member referenced by that root. Checkpoints are therefore exact project-wide manifests and do not reconstruct other documents by timestamp. Durable root and member changes are checkpointed after a short quiet period and before branch switches and merges.

New automatic checkpoints receive concise semantic titles derived from the immutable previous and candidate checkpoint views. Stable component and member IDs identify deck structure changes, metadata fields, rules, layouts, spreadsheets, table setup, playtests, and assets; multiple independent changes are combined or summarized by file count. Explicit operation and user-provided messages retain precedence, existing checkpoints are never rewritten, and an unavailable or unsupported historical view falls back to `Project edit` without blocking persistence. The 750 millisecond trailing quiet period is unchanged. Changes arriving during checkpoint capture mark the recorder dirty and schedule a later pass, while explicit operations and session close cancel pending timers, await active capture, synchronize, and drain pending changes before continuing.

Branch checkout is shared by every tab that has the project open because all tabs also share one materialized project directory. A checkout first synchronizes and checkpoints the current branch, updates the history document, and then every tab closes and reopens its session against the selected branch. Reconciliation verifies both history identity and branch ID before importing filesystem bytes, so files materialized by a new checkout cannot be imported into the old branch.

Historical selection is per tab and URL-addressable through `checkpoint` and `baseline` search parameters. Opening a checkpoint resolves read-only root and member handles at its exact heads and never runs the filesystem observer or reconciler. A read-only virtual `FsDir` materializes the checkpoint's typed documents in memory for setup, spreadsheet, play, and export readers without touching the real project directory. Session and filesystem mutations reject historical writes, and the authoring UI disables direct editor controls. The baseline is independent from the displayed checkpoint and currently drives changed-file summaries in the history sheet.

Creating a branch from history produces a normal writable branch. Nested branches remember their parent and immutable Base checkpoint, merge upward, and retain that Base when an ancestor merge reparents them.

History schema version 2 stores each branch's Base checkpoint and Base branch, and complete merge records containing Base, Source, Target, and Result checkpoint IDs. Existing schema-1 histories migrate in place without changing branch, checkpoint, root, member, or component identities; legacy merge records remain readable.

Merge preparation synchronizes the source, captures exact Source and Parent checkpoints, resolves the stored Base checkpoint, verifies immutable assets by BLAKE3, and builds a typed three-way structural plan without mutating Parent. The preview lists automatic operations, mutable CRDT merges, and typed conflicts. Commit rejects stale Source or Parent state, requires an explicit valid resolution for every conflict, merges mutable Branch checkpoint views into Parent member handles, verifies selected assets, and publishes the complete validated Parent root in one change.

`.automerge/pending-branch-operation.json` advances through prepared, members-applied, root-published, checkpoint-recorded, and history-finalized phases. Before mutation it stores the deterministic expected heads for every mutable merge member. Recovery runs under the project Web Lock, accepts each member only at its reviewed Parent or exact merged heads, accepts the Parent root only at its reviewed heads or exact planned structure, and uses the stable operation ID to produce one result checkpoint and merge record. This also covers a crash after durable member or root writes but before the next phase marker. Version-1 merge journals remain accepted for migration recovery and must still target their recorded Parent. Writable branches support component creation, rename, deletion, recognized member additions/removals, and immutable asset replacement; historical checkpoint sessions remain read-only.

## Playtests And Exports

Starting a playtest synchronizes the active project before reading its projections.

Project transfer excludes:

- `.automerge/**`
- `tts-export/**`

Playtests receive materialized project files, not authoring history or generated TTS output.

TTS export continues writing directly below `tts-export/**`. Those writes do not enter the project graph or trigger synchronization.

## Verification

Focused Playwright coverage verifies:

- Background adoption of every recognized file kind.
- Exclusion of TTS and unknown component files.
- External Markdown import while preserving the linked document URL.
- Live rules synchronization between mounted editors.
- External rules Markdown updates applied to mounted editors.
- Live semantic SVG synchronization between mounted layout editors.
- Concurrent changes to different SVG nodes preserved in both canvases and the filesystem projection.
- Ephemeral fill and movement previews excluded from filesystem projections until one durable commit.
- Semantic SVG claim blocking, compatible-domain editing, commit-head handoff, and single-step color undo.
- Real held-pointer movement updating the local SVG immediately and the remote preview multiple times before mouse-up.
- Ephemeral transport failure never preventing the local gesture or its final durable commit.
- Ephemeral cursor presence between clients on the same exact route.
- Region-based cursor resolution across different sender and receiver viewport sizes.
- Cursor isolation between different routes in the same project.
- Sidebar page-location avatars, including deck aggregation and pointer-disabled Local Test membership.
- Immutable binary replacement with a new linked document URL.
- Exact binary projection bytes.
- Dynamic component file discovery.
- Stable project identity after reload.
- Component creation through a project command.
- Stable member IDs across component rename.
- Branch isolation and project-global checkout across browser tabs.
- Exact read-only checkpoint views and independent comparison baselines.
- Forking from latest and historical checkpoints.
- Merge-to-parent materialization.
- Three-way structural merge of a branch component addition/rename with an independent Parent metadata edit.
- Merge preview and explicit prepare/commit flow.
- Delete/modify conflict preview and Parent component restoration.
- Automatic immutable asset replacement merge and explicit different-byte asset conflict resolution.
- Identical asset replacement without a conflict and one-sided member deletion.
- Same-path and same-name collision preview, rename resolution, and two-tab structural convergence.
- Parent component rename composed with Branch member edits while the Base checkpoint retains its original paths and asset bytes.
- Nested child Base retention after ancestor merge and reparenting.
- Reload recovery after every journal phase and the durable pre-marker member/root/checkpoint/history boundaries.
- Exact Base, Source, Target, and Result merge history IDs.
- Semantic automatic checkpoint titles for metadata, every supported member kind, deck structure, asset replacement, and grouped multi-file changes.
- Preservation of initial, branch-point, fork, and merge checkpoint messages.

Existing regressions cover:

- Metadata editing and invalid external JSON recovery.
- Metadata synchronization between tabs.
- Component create, rename, and delete.
- CSV save and navigation persistence.
- SVG editor persistence.
- Semantic table SVG persistence.
- Asset upload and image selection.

## Current Boundaries

- Sharing links are bearer capabilities with edit access and cannot be individually revoked.
- The sync service does not expose remote acknowledgement, quota management, garbage collection, or end-to-end encryption.
- Joined projects are materialized independently in each browser workspace; there is no account-level cloud project list.
- Presence regions follow receiver DOM geometry but do not yet expose semantic ProseMirror, spreadsheet-cell, or SVG user-space positions.
- Setup table collaboration remains text-based rather than semantic.
- Remote semantic SVG changes currently install a complete sanitized SVG projection. Incremental keyed DOM reconciliation and undo rebasing remain future work.
- Mounted setup and spreadsheet editors do not yet apply every remote document patch directly to their third-party editor instance; filesystem projections and remounts remain part of those integrations.
- SVG text-frame resize does not yet emit the same semantic transition previews as ordinary SVG resize.
- Remote SVG selections are not yet rendered independently from active interaction previews.
- Binary documents are immutable but are not deduplicated by hash.
- Component rename and deletion have config repair but no dedicated per-command operation journal.
- Collaborative whole-project discovery and deletion require a workspace-level Automerge document.
- Branches eagerly clone mutable project members rather than cloning documents only when they diverge.
- Cross-device structural creation still relies on post-convergence collision validation; same-browser commands are serialized with the project Web Lock.

## Next Steps

1. Add structural operation journals for component rename and deletion.
2. Make the typed table model authoritative, materialize `setup/table.svg` from it, and bind the mounted setup editor directly.
3. Bind the mounted spreadsheet editor directly to component data documents.
4. Add keyed SVG DOM reconciliation and rebase local undo history across compatible remote edits.
5. Add remote SVG selection rendering and text-frame resize previews.
6. Add account-backed project membership, roles, and capability revocation if bearer links are no longer sufficient.
7. Add a workspace project registry and project deletion tombstones.
8. Add binary deduplication and retention policy if repository growth requires it.
9. Add semantic presence adapters for ProseMirror cursors and spreadsheet cells where DOM regions are not precise enough.
10. Replace eager branch member cloning with per-document copy-on-write if project size makes it necessary.
