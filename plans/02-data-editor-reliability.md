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
- When loading `data.csv`, preserve existing CSV column order, preserve CSV-only columns, and append any missing SVG columns to the end.
- Add append-only plus controls:
  - A column plus button below the spreadsheet appends a new column.
  - A row plus button at the right of the spreadsheet appends a new row.
- Reset create-deck form values after successful deck creation so new decks start cleanly. Currently when creating a deck and then a new deck the input values go to 0 0
- Allow decimal comma values when creating a new deck.

## Implementation Notes

- Review `svg-data-editor.svelte`, `data-loader.ts`, and related spreadsheet setup for stale derived state or one-time initialization.
- Treat save state as data editor UI state, not console output.
- Add a navigation flush similar to the SVG editor's pending-save handling.
- Append controls should use jspreadsheet APIs and then trigger the same save path as normal edits.
- Keep the first version simple: append only, no "insert near selection" behavior.
- Keep image upload and autofill out of this reliability pass.

## Acceptance Criteria

- Editing a cell updates previews and persists to `data.csv`.
- Reloading or navigating away and back shows the saved value.
- Navigating from `/editor` to `/data` shows current data for the active deck.
- Save status changes to saving during writes, saved after success, and error on failure.
- The row plus appends one new row.
- The column plus appends one new column.
- Creating a second deck does not reuse the previous deck name, dimensions, or transient data values.
- Missing SVG columns are appended after the existing CSV columns.
- Decimal comma dimensions create SVGs with the expected normalized dimensions.

## Tests

- For known regressions and bugs, add a focused failing e2e test first, run it, confirm the failure, then change app code.
- Add e2e coverage for edit, autosave, reload, and value visibility after navigation.
- Add e2e coverage for appending a row and column.
- Add a regression test for creating two decks in sequence with distinct values.
- Add a regression test for missing SVG columns being appended to the end.
- Add a regression test for decimal comma dimensions during deck creation.
- Prefer outcome assertions over implementation details, following `instructions/testing.md`.

## Deferred

- Image upload into image columns.
- Autofill interactions for selected cells or columns.
