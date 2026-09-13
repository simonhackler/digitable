# Automerge Current Integration

## Status

`game.json` is the first Automerge-managed project file in `packages/app`.

Automerge is authoritative for game metadata. The physical `game.json` file remains a human-editable projection that is imported into Automerge when changed externally and materialized from Automerge after document changes.

Component data, SVG templates, rules, table setup, and assets are not yet managed by Automerge. In particular, component `data.csv` reconciliation is deliberately disabled in the application integration until component creation, rename, and deletion are represented in the project graph.

## Current Architecture

### Project sessions

Each open project has one `ProjectSession` created by `openProjectSession`.

The session owns:

- A project-scoped Automerge Repo.
- Project-local Repo storage under `.automerge/storage/`.
- The stable project root document.
- The linked game metadata document.
- Filesystem reconciliation.
- External-file observation.
- Repo flushing and shutdown.

The `/games` layout owns the active session lifecycle. It opens the project named by the route, closes the previous session before switching projects or workspaces, and prevents project children from rendering until the session is ready.

A generation counter prevents a slow project open from replacing a newer navigation result.

### Svelte reactivity

Automerge is connected to Svelte 5 through `document-state.svelte.ts`.

The adapter:

- Stores the current immutable Automerge document in `$state.raw`.
- Reassigns that state when the `DocHandle` emits a change.
- Exposes a typed `change()` method that delegates to `DocHandle.change()`.
- Removes the handle listener when destroyed.
- Avoids wrapping Automerge documents in Svelte deep proxies.

The integration does not use `@automerge/automerge-repo-svelte-store`. Its writable `set()` and `update()` methods only mutate the Svelte store and do not write to Automerge, while its handle listener has no explicit teardown API.

### Project graph

Every project has a stable root document with linked members.

The current root includes:

- The game metadata member.
- A component registry structure reserved for later project integration.

The metadata member has its own Automerge document and URL. Local folder names remain route and materialization keys; they are not the synchronized project identity.

### Game metadata model

The metadata document contains:

- `name`
- An atomic `{ min, max }` player range.
- `description`
- `tags`
- Optional `digitableVersion`.
- Unknown `game.json` properties in `extra`.

The player range is one CRDT value so independently valid concurrent changes cannot merge into an invalid combination such as a minimum greater than the maximum.

The materializer converts between this document and the existing `game.json` shape containing `minPlayers` and `maxPlayers`.

Unknown properties are preserved when the UI edits known fields.

### Metadata editing

The game metadata page no longer reads or writes `game.json` directly.

Valid field edits enter Automerge immediately:

- `name` and `description` use Automerge `updateText`.
- Player-limit changes replace the atomic player-range value.
- Fields not exposed by the form remain unchanged.

The form reads directly from rune-backed Automerge state, so remote document changes update the mounted page. The submit button validates the current document and explicitly flushes its filesystem projection.

Save status distinguishes local persistence from remote acknowledgement:

- `Saving locally`
- `Saved locally`
- A reconciliation error message

Metadata materialization currently has no debounce. This starts local persistence immediately after an edit. SvelteKit navigation awaits a session flush, and full-page unload is guarded while reconciliation is active.

### Filesystem reconciliation

Each managed file tracks:

- Its Automerge document URL.
- Last materialized Automerge heads.
- Last materialized file hash.
- Projection path.

Reconciliation performs these operations in order:

1. Recover an interrupted materialization journal.
2. Read and hash the current file.
3. Import a changed file at the last materialized heads with `changeAt`.
4. Merge that change with the latest Automerge state.
5. Validate and serialize the merged document.
6. Flush Automerge Repo storage.
7. Recheck the file hash to detect concurrent filesystem changes.
8. Write a pending materialization journal.
9. Write and verify the canonical projection.
10. Update `.automerge/config.json`.
11. Remove the journal.

Invalid external JSON is preserved rather than overwritten. Reconciliation reports an error and retries after a later file or document change. Once the file is corrected, it is imported normally.

Unexpected deletion of a managed projection currently restores the file from canonical Automerge state.

### Bootstrap and recovery

Opening an existing project without Automerge configuration imports `game.json` and creates:

- A project root document.
- A game metadata document.
- Project-local Repo storage.
- `.automerge/config.json`.

Bootstrap uses a pending journal and source hashes so interrupted initialization can be resumed safely.

If Automerge storage exists but `config.json` is missing, the session refuses to create a replacement identity. This prevents silently abandoning project history and collaborators.

### Multi-tab coordination

BroadcastChannel synchronizes Automerge documents between same-origin tabs.

Web Locks serialize:

- Project bootstrap.
- Project creation.
- Reconciliation and config updates.
- Automerge storage adapter reads and mutations.

The storage lock is necessary because separate Repo instances may otherwise contend over writable handles in the same `.automerge/storage` directory.

Before materializing, a reconciler verifies that its handle contains the heads recorded by the latest projection config. A stale tab therefore waits for Automerge synchronization rather than writing an older document over a newer projection.

### Project creation and deletion

Project creation now creates a valid canonical `game.json` before navigation. The operation is protected by a Web Lock and rejects normalized folder-name collisions.

If the initial file write fails, the newly created empty directory is removed so creation can be retried.

Local project deletion flushes and closes the active session before removing the project directory.

Collaborative deletion across devices is not implemented yet. That requires a workspace-level project registry and deletion tombstones.

### Playtest exports

Starting a playtest flushes the active project session before reading project files.

`.automerge/**` is excluded from project transfer. Playtests receive materialized project content, not authoring history or project identity.

### Build integration

Automerge requires WASM support in Vite. `vite-plugin-wasm` is configured for both the main build and workers.

The unused Automerge Svelte-store and IndexedDB storage adapters were removed. Project history is stored with the project rather than in browser-specific IndexedDB.

## Verification

The implemented flow is covered by Playwright tests for:

- Existing project bootstrap into `.automerge/config.json`.
- Metadata edits materializing to `game.json`.
- Preservation of tags, `digitableVersion`, and unknown fields.
- Valid external `game.json` changes updating the mounted form.
- Invalid external JSON remaining untouched.
- Recovery after correcting invalid external JSON.
- Metadata synchronization between two tabs.
- Independent fields edited from different tabs being retained.
- Existing game creation, deletion, deck creation, and deck rename behavior.
- Existing CSV editor behavior while CSV remains filesystem-managed.

The application type-check and production build pass. Existing warnings in `PlaySurface.svelte` are unrelated to this integration.

## Current Boundaries

### Metadata only

The application currently opens sessions with component-data management disabled. This is necessary because the existing deck UI still creates, renames, and deletes directories directly.

Enabling the existing CSV materializer now would allow reconciliation to recreate an old `data.csv` path after a deck rename or deletion. Dynamic graph membership must be implemented first.

### No remote server

BroadcastChannel only connects same-origin browser contexts. There is no authenticated cross-device Automerge sync server yet.

`Saved locally` therefore means that Automerge storage and the filesystem projection are current on this client. It does not mean another device has acknowledged the change.

### No collaborative project discovery

Each project has a stable root URL, but there is no workspace Automerge document listing project roots. A remote client cannot discover project creation or deletion from per-project documents alone.

### No shared deletion tombstones

Deleting a project removes one local checkout. Other clients do not yet receive a durable deletion event. A project-wide deletion design must prevent an offline or stale peer from recreating deleted content.

### No binary synchronization

Binary assets remain ordinary files. They are not discoverable or transferable through the Automerge graph.

## Next Necessary Steps

### 1. Make the project graph dynamic

The root project document must become the authoritative component registry.

Required work:

- Observe root-document changes during an active session.
- Add and remove reconciled members without reopening the project.
- Represent every component, including components without `data.csv`.
- Preserve stable component IDs independently of directory names.
- Add operation journals for structural changes.
- Reconcile config projections when root membership changes.
- Define conflict behavior for concurrent component names and paths.

This is the prerequisite for all deck and CSV integration.

### 2. Move deck lifecycle into project commands

Replace direct directory and sidebar mutation with session commands:

- `createComponent`
- `renameComponent`
- `deleteComponent`

Each command must update the root document, member paths, filesystem structure, projection config, and visible project summary as one recoverable operation.

The current `new-deck-dialog.svelte`, `rename-deck-dialog.svelte`, and `create-menu.svelte` should consume these commands rather than writing through `FsDir` directly.

### 3. Enable structured `data.csv` documents

Once component membership is dynamic:

- Enable component-data management in `openProjectSession`.
- Resolve component routes by stable component ID plus local name.
- Convert spreadsheet changes into row, column, order, and cell operations.
- Preserve row IDs in the CSV projection.
- Update the spreadsheet from remote Automerge changes without triggering feedback writes.
- Flush pending spreadsheet edits during navigation and project operations.
- Add conflict handling for concurrent column renames and row deletion/edit combinations.

### 4. Add a workspace Automerge document

Introduce a workspace document containing stable project entries:

- Project ID.
- Project root URL.
- Display name.
- Suggested local folder key.
- Creation metadata.
- Deletion tombstone.

The selected filesystem root remains the local materialization target. The workspace document provides project discovery and shared lifecycle across clients.

Existing workspaces require a migration that scans project configs and registers their root URLs.

### 5. Add authenticated remote synchronization

Replace development-only local synchronization with a production sync service.

Required work:

- Authenticated WebSocket adapter configuration.
- Authorization from users and collaborators to workspace and project document IDs.
- Invitation and join flows.
- Timeouts and offline status.
- Server-side retention and storage policy.
- Clear UI distinction between local persistence and remote synchronization.

Project editing and Colyseus play-session state should remain separate systems.

### 6. Synchronize text project files

After project membership and networking are stable, add managed members for:

- `rules.md`
- Component `front.svg`
- Component `back.svg`
- `setup/table.svg` or its typed semantic source

Markdown can use Automerge text operations.

SVG should not be treated as an unconstrained whole-file string for collaborative editing. Concurrent XML text changes can create invalid documents. Prefer stable element identities and attribute/text operations, with deterministic SVG materialization.

Table setup should use the existing typed table model as the Automerge source and materialize `setup/table.svg` as an artifact.

### 7. Add content-addressed binary assets

Binary bytes should not be stored directly in Automerge history.

Add an Automerge asset manifest containing:

- Stable asset ID.
- Project-relative path.
- Content hash.
- MIME type.
- Size.
- Blob-storage identifier.

Store bytes separately:

- As normal local files under `assets/`.
- In remote object storage keyed by content hash.
- With deduplicated and resumable upload/download.
- With hash verification before materialization.

Renames should only update manifest paths. Deletion should use tombstones and a retention policy rather than immediately removing shared bytes.

### 8. Implement collaborative deletion

Project deletion must eventually:

1. Write a workspace tombstone.
2. Stop accepting project edits.
3. Notify connected peers through the workspace document.
4. Close local project sessions.
5. Remove local projections.
6. Retain or garbage-collect Automerge documents and binary blobs according to policy.

An offline peer must not be able to rematerialize a project after reconnecting.

### 9. Add history, branches, and presence

Only add these after all managed member types support stable identity and materialization.

The todo prototype's versioning controller cannot be ported directly because it hard-codes one todo member. Digitable needs project-wide checkpoints and branch clones covering every managed member.

Presence messages should identify:

- Project root.
- Branch.
- Member ID.
- Editor mode.
- Editor-specific coordinates or cursor positions.

Undo should remain editor-aware. Existing Lexical, SVG editor, and spreadsheet histories should not be replaced by one generic todo-style command stack.

## Recommended Order

1. Dynamic project graph and structural journals.
2. Automerge-backed deck create, rename, and delete commands.
3. Structured `data.csv` editor integration.
4. Workspace project registry and tombstones.
5. Authenticated remote synchronization and invitations.
6. Rules, SVG, and table document types.
7. Content-addressed binary asset synchronization.
8. Collaborative project deletion.
9. Presence, history, undo coordination, and branches.

The immediate next implementation should be dynamic component membership plus recoverable deck lifecycle commands. That removes the current metadata-only boundary and makes it safe to enable the existing structured CSV materializer.
