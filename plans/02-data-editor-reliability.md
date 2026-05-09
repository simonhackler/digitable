# Data Editor Reliability

## Goal

Make the data editor trustworthy: values load consistently, autosave is visible, and spreadsheet editing supports the basic row and column workflows.

## User Stories

- As a designer, when I switch from the SVG editor to the data editor I see the current deck values.
- As a designer, when I edit spreadsheet data I can tell whether changes are saving, saved, or failed.
- As a designer, I can append rows and columns without using hidden context menus.
- As a designer, newly created decks do not inherit stale values from previous forms or editor state.

## Proposed Behavior

- Keep autosave as the primary save model.
- Show visible save state near the data editor toolbar: saving, saved, and error.
- Flush pending autosaves before navigating away from the data editor.
- Ensure `data.csv` is read and applied every time the data editor loads for the current deck.
- Add append-only plus controls:
  - A column plus button below the spreadsheet appends a new column.
  - A row plus button at the right of the spreadsheet appends a new row.
- Add autofill text support for selected cells or a selected column.
- Reset create-deck form values after successful deck creation so new decks start cleanly.

## Implementation Notes

- Review `svg-data-editor.svelte`, `data-loader.ts`, and related spreadsheet setup for stale derived state or one-time initialization.
- Treat save state as data editor UI state, not console output.
- Add a navigation flush similar to the SVG editor's pending-save handling.
- Append controls should use jspreadsheet APIs and then trigger the same save path as normal edits.
- Keep the first version simple: append only, no "insert near selection" behavior.

## Acceptance Criteria

- Editing a cell updates previews and persists to `data.csv`.
- Reloading or navigating away and back shows the saved value.
- Navigating from `/editor` to `/data` shows current data for the active deck.
- Save status changes to saving during writes, saved after success, and error on failure.
- The row plus appends one new row.
- The column plus appends one new column.
- Creating a second deck does not reuse the previous deck name, dimensions, or transient data values.

## Tests

- Add e2e coverage for edit, autosave, reload, and value visibility after navigation.
- Add e2e coverage for appending a row and column.
- Add a regression test for creating two decks in sequence with distinct values.
- Prefer outcome assertions over implementation details, following `instructions/testing.md`.

## Open Questions

- What exact autofill interactions should be supported first: fill selected empty cells, fill down a column, or generate placeholder values from SVG element names?
