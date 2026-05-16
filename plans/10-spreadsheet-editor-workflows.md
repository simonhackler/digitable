# Spreadsheet Editor Workflows

## Goal

Make the Spreadsheet editor match normal spreadsheet expectations while preserving SVG-backed data safely.

## User Stories

- As a designer, I see readable column names from Inkscape labels instead of technical SVG ids when labels exist.
- As a designer, I can hide columns without deleting data.
- As a designer, I do not see generic column creation controls that are not useful for SVG template data.
- As a designer, hidden or CSV-only data survives save and reload.

## Proposed Behavior

- Use Inkscape labels, such as `inkscape:label`, as spreadsheet column display names when available.
- Keep SVG ids as the internal stable keys for SVG lookup, save, and preview updates.
- Hiding a column hides it from the spreadsheet UI but does not remove values from `data.csv`.
- Deleting or removing SVG-backed columns remains distinct from hiding columns.
- Remove the generic append-column plus button from the Spreadsheet editor.
- Keep the row append control.
- Keep the "Add SVG data" restore flow for SVG columns that were intentionally removed from the visible spreadsheet.

## Implementation Notes

- Extend SVG parsing so each column can carry both an internal key and a display label.
- Preserve CSV headers as stable data keys unless a migration strategy is explicitly added later.
- If jspreadsheet only supports one column title, add a local mapping layer between displayed labels and saved/internal keys.
- Do not use display labels for `getElementById`; use the original SVG id.
- Review context menu behavior for hide versus delete and make sure hide does not enter `deletedSvgColumns`.
- Remove only the generic append-column button; do not remove the SVG data restore popover.

## Acceptance Criteria

- An SVG element with `id="card_title"` and `inkscape:label="Card Title"` appears as `Card Title` in the Spreadsheet editor.
- Editing a labeled column updates the correct SVG element.
- Saving and reloading preserves values for labeled columns.
- Hiding a column removes it from view without removing its saved CSV values.
- Reloading after hiding a column does not lose the hidden column's data.
- The generic append-column plus button is not visible.
- The row append button still works.

## Tests

- Add regression coverage for Inkscape label display with id-backed SVG updates.
- Add coverage for hide-column behavior that saves, reloads, and confirms hidden values are preserved.
- Add coverage that the generic append-column control is absent while row append still works.
- Keep e2e tests focused on outcomes and avoid asserting visual column positions.
