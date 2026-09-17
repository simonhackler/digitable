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

Synchronization currently connects same-origin browser tabs through `BroadcastChannel`. There is no cross-device sync service yet.

## Project Graph

Each project has one stable root Automerge document using schema version 2.

The root document contains:

- A dynamic member registry.
- Stable component records independent of directory names.
- Stable file member IDs independent of component renames.
- File paths, document kinds, and linked Automerge URLs.
- BLAKE3 hashes for binary members.

File and component IDs for newly discovered paths are deterministic BLAKE3-based IDs. This prevents separate tabs from creating different registry keys for the same path.

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

Per-member pending materialization journals continue to protect file/config updates. Structural component operations are serialized with Web Locks. A dedicated multi-step structural operation journal is not yet implemented.

## Multi-Tab Coordination

Each tab owns a project-scoped Automerge Repo backed by `.automerge/storage`.

Coordination uses:

- BroadcastChannel for document synchronization.
- Web Locks for bootstrap, root/config changes, reconciliation, and storage adapter mutations.
- Latest-config rereads while holding the project lock.
- Deterministic IDs and commit-time path revalidation.
- Projected heads to prevent stale filesystem imports.

Local save status distinguishes synchronization work from idle state. It does not imply acknowledgement from another device.

## Ephemeral Presence

Each open project session attaches one application-owned presence service to the stable root document handle. Presence uses Automerge Repo's `DocHandle.broadcast()` and `ephemeral-message` event; cursor state is never written to an Automerge document or the filesystem.

Presence messages are versioned and runtime-validated. A message carries the collaborator display name, an exact page ID, and a receiver-resolvable pointer or null. The Automerge sender peer ID identifies a browser client and deterministically selects its cursor color, but it is not treated as a user identity. Email addresses are not broadcast.

The page ID combines the SvelteKit route ID with sorted dynamic parameters. Clients therefore share cursors only while viewing the same project page, including the same component on parameterized deck routes. Query parameters do not create separate presence scopes. A centralized route policy disables pointer presence on `PlaySurface` routes.

The service exchanges hello, complete state, and leave messages. Participant identity, page membership, and pointer position have separate update methods while each network message remains a replaceable complete state because ephemeral delivery is not guaranteed. Five-second heartbeats repair missed startup messages, stale clients expire after 60 seconds, visibility restoration reannounces current state, and normal project-session shutdown sends a best-effort leave before the Automerge Repo disconnects.

A layout-owned surface registry captures and resolves pointer positions against the receiver's current DOM. The registry is deliberately non-reactive: registration only updates its element maps, while the cursor layer recalculates geometry on actual scroll, resize, visibility, and remote-presence updates. The games layout registers the default project surface, while reusable Markdown and spreadsheet boundaries and the SVG editor pages register stable nested regions. Regions can use element-box, scroll-content, or visible-viewport coordinates. Rules and card previews use visible-viewport coordinates so cursor movement remains visible across different editor heights, while the spreadsheet uses scroll-content coordinates. Surface fallback positions render only across compatible responsive breakpoints. Unresolved or offscreen positions are hidden.

A single cursor layer in the games layout uses pointer events, prefers the deepest registered region, throttles outgoing updates, and renders matching peers above project content but below modal overlays. Hit testing prevents sidebars and portalled overlays from publishing positions over hidden page content. Routes that mount `PlaySurface` do not mount this cursor layer because the play surface owns its pointer interactions; multiplayer play routes are outside the games layout and are excluded as well.

The active project owns one reactive snapshot of remote presence, shared by the cursor layer and project sidebar. Sidebar navigation rows render compact shadcn-svelte Avatar fallback stacks for peers on Rules, each deck, TTS, Paper, Setup, Local Test, Playtests, and the project overview. Deck layout and spreadsheet routes aggregate on the corresponding deck row. Page membership is published even where pointer presence is disabled, so Local Test users remain visible without enabling cursors over `PlaySurface`. Stacks show at most three peer avatars followed by a remaining count; the local client is not included.

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

Existing regressions cover:

- Metadata editing and invalid external JSON recovery.
- Metadata synchronization between tabs.
- Component create, rename, and delete.
- CSV save and navigation persistence.
- SVG editor persistence.
- Semantic table SVG persistence.
- Asset upload and image selection.

## Current Boundaries

- Synchronization is same-browser only.
- Presence regions follow receiver DOM geometry but do not yet expose semantic ProseMirror, spreadsheet-cell, or SVG user-space positions.
- Setup table collaboration remains text-based rather than semantic.
- Remote semantic SVG changes currently install a complete sanitized SVG projection. Incremental keyed DOM reconciliation and undo rebasing remain future work.
- Mounted setup and spreadsheet editors do not yet apply every remote document patch directly to their third-party editor instance; filesystem projections and remounts remain part of those integrations.
- SVG drag previews, selections, and soft claims are not yet exchanged as semantic ephemeral presence.
- Binary documents are immutable but are not deduplicated by hash.
- Structural operations have config repair but no dedicated operation journal.
- Collaborative whole-project discovery and deletion require a workspace-level Automerge document.

## Next Steps

1. Add structural operation journals for component rename and deletion.
2. Make the typed table model authoritative, materialize `setup/table.svg` from it, and bind the mounted setup editor directly.
3. Bind the mounted spreadsheet editor directly to component data documents.
4. Add keyed SVG DOM reconciliation and rebase local undo history across compatible remote edits.
5. Add ephemeral SVG selection, drag-preview, and deterministic soft-claim messages.
6. Add authenticated cross-device Automerge networking.
7. Add a workspace project registry and project deletion tombstones.
8. Add binary deduplication and retention policy if repository growth requires it.
9. Add semantic presence adapters for ProseMirror cursors, spreadsheet cells, and SVG user-space coordinates where DOM regions are not precise enough.
