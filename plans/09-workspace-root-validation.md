# Workspace Root Validation

## Goal

Prevent users from accidentally opening the wrong local folder as their Digitable projects root.

## User Stories

- As a designer, when I pick a folder I get a clear error if it is not a Digitable workspace.
- As a designer, I can start with an empty folder and have Digitable initialize it safely.
- As a designer, Digitable remembers basic workspace metadata for future compatibility checks.

## Proposed Behavior

- When picking a local projects folder, accept only:
  - An empty folder.
  - A folder containing a `.digitable` file.
- If an empty folder is accepted, create a `.digitable` file at the root.
- The `.digitable` file contains small JSON metadata, including schema version and last opened app version.
- If a picked folder is not empty and has no `.digitable` file, show a blocking error and do not save the folder handle.
- Existing game discovery continues to use child folders containing `game.json`.
- Browser storage remains available without requiring a picked-folder validation dialog.

## Implementation Notes

- Add validation to the local folder picking flow before `saveFolderHandle`.
- Reuse the file-browser adapter APIs instead of directly walking native handles after the adapter is created.
- Treat `.digitable` as a workspace marker, not a game marker.
- Keep the metadata schema minimal for the first version:
  - `schemaVersion`
  - `lastOpenedAppVersion`
  - `updatedAt`
- If `.digitable` exists but is invalid JSON, show a clear error and do not use the folder.
- If writing `.digitable` fails for an empty folder, show a clear error and do not save the folder handle.

## Acceptance Criteria

- Picking an empty local folder initializes `.digitable` and opens the app.
- Picking a folder with `.digitable` opens the app.
- Picking a non-empty folder without `.digitable` shows an error and does not persist the folder preference.
- Reloading after a successful pick still restores the chosen folder.
- Game listing still discovers projects by child `game.json` files.

## Tests

- Add focused e2e coverage around the folder-pick flow if the browser test environment can exercise `showDirectoryPicker`.
- Add lower-level tests for the workspace validation helper with empty, valid, invalid, and wrong-folder cases.
- Verify the rejected-folder path does not call the storage preference save function.
