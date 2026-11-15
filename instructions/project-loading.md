# Project loading

The games layout owns one project session. Switching projects closes it durably;
document handles are shared across pages only while that session is open.

## Declare dependencies in the route

Universal `+page.ts` and `+layout.ts` loads return descriptions, without accessing
the filesystem or waiting for a session:

```ts
import { member, optional } from '$lib/collaboration/dependencies';
import type { PageLoad } from './$types';

export const load = (() => ({
	projectNeeds: {
		rules: member('rules', 'rules.md'),
		table: optional(member('table-setup', 'setup/table.svg'))
	}
})) satisfies PageLoad;
```

Use generated `PageProps`/`LayoutProps` in the component. Resolve the declaration
through the contextual session, then consume the returned references:

```ts
const documents = await project.session.require(data.projectNeeds);
const rules = createDocumentState(documents.rules.handle);
```

`rules.handle` is a `DocHandle<MarkdownFileDocument>`. `table` may be undefined.
Kinds, path shapes, keys, and optionality are checked by TypeScript. Existence and
document validity are checked at runtime. Destroy reactive document wrappers when
their component is destroyed.

Use an async `$derived` when dependencies change within a reused component. Set
component contexts before starting async derivations. A layout publishing a loader
through context must make that loader await its requirements, too: children can
initialize concurrently with their layout. Rendering and bindings should depend on
the resolved references rather than a separate, unused readiness promise.

## Session contract

- `require()` promotes queued work and shares in-flight loading. Live documents are
  reconciled with their files, including pending-write recovery, before resolving.
- Loaded handles remain in the session. Observation invalidates readiness when a
  file changes; requesting an already-ready member reuses its handle.
- `member()` and `members()` are synchronous accessors for **loaded** documents.
  Resolve requirements before using them. Unloaded does not mean absent.
- `collection(kind, scope)` discovers and loads matching members within a scope.
- `snapshot()` declares a complete, reconciled project snapshot. Exports and play
  use this when they need the whole project. `session.snapshot()` provides the same
  complete-snapshot guarantee to imperative callers.
- `components()` reads the root inventory without loading component documents.
  Sidebar updates must not take full project snapshots.
- Historical dependencies load checkpoint versions and never reconcile live files.

Background work is bounded, and foreground requests have priority. File discovery
and document loading happen outside the project lock; inventory updates and file
reconciliation run in bounded units under it. Page loading and local saving have
their own UI; background loading status is tracked without a banner above the top bar.

Fresh imports still initialize a complete graph. Branch checkout finishes replacing
the working tree before publishing its new session. Close drains synchronization,
records the checkpoint, and shuts down the repository.

## Migrations and discovery

Each project's `.digitable.json` records its layout version. Only the requested
project migrates, and its marker advances after successful migration. Unmarked
projects run the legacy migration even in an already-migrated workspace, so newly
copied legacy projects are not incorrectly treated as current.

Workspace discovery reads names, descriptions, and tags progressively. It neither
migrates projects nor loads component inventories, and does not gate opening.
