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

- `rules.md`
- Component `front.svg` and `back.svg`
- `setup/table.svg`
- Feedback Markdown
- The playtest feedback registry

In-app writes update these linked documents through the project session. External editor changes are imported with `changeAt()` using the recorded projection heads.

SVG and table files currently merge as text. Moving them to stable semantic element and table models remains future work.

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

Rules, CSV, component SVG, table SVG, uploaded assets, and generated assets write through the active project session. Premade deck generation and feedback import hand their completed filesystem mutations to an explicit session sync.

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
- SVG and table collaboration is text-based rather than semantic.
- Mounted Lexical, SVG, and spreadsheet editors do not yet apply every remote document patch directly to their third-party editor instance; filesystem projections and remounts remain part of those integrations.
- Binary documents are immutable but are not deduplicated by hash.
- Structural operations have config repair but no dedicated operation journal.
- Collaborative whole-project discovery and deletion require a workspace-level Automerge document.

## Next Steps

1. Add structural operation journals for component rename and deletion.
2. Bind mounted rules, SVG, table, and spreadsheet editors directly to remote member changes.
3. Replace text SVG merging with stable element and attribute identities.
4. Make the typed table model authoritative and materialize `setup/table.svg` from it.
5. Add authenticated cross-device Automerge networking.
6. Add a workspace project registry and project deletion tombstones.
7. Add binary deduplication and retention policy if repository growth requires it.
