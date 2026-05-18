# Project Structure and Editor Plan

## Summary

Clarify deck creation, fix the spreadsheet context menu bug, introduce a versioned project folder migration path, and add a Digitable font feature for system fonts and Inkscape imports.

## Quick Fixes

- Keep deck dimensions as normal `width x height`.
- Add clearer orientation preview/copy in the create deck dialog so portrait cards are not mistaken for flipped dimensions.
- Fix the spreadsheet bug where the first right-click does not open the context menu.
- Add regression coverage for first right-click on the spreadsheet.

## Larger Features

- Move project folder naming toward `components` plus `assets`.
- Replace current `system` usage with `components` after migration.
- Replace current `files` usage with `assets` after migration.
- Add per-project schema/version metadata.
- Add a lazy migration prompt when opening an old project.
- After migration, write and edit only the new structure. Do not maintain permanent dual support.
- Add a Digitable font feature:
  - use browser local/system font access where available;
  - load selected system fonts into the editor with temporary `@font-face` rules;
  - make loaded fonts available in the SVG text font picker;
  - preserve `font-family` and Inkscape font metadata on import;
  - show missing imported fonts and let users map them to loaded system/browser fonts;
  - fall back to browser fonts when system font access is unavailable.

## Public Interfaces / Types

- Add per-game/project metadata with schema version and migration state.
- Add migration code from old `system`/`files` structure to new `components`/`assets` structure.
- Update deck/component loading and saving to use the new structure after migration.
- Add font availability state for browser fonts, selected loaded system fonts, and missing imported fonts.
- Add mapping data for imported SVG font names to available Digitable fonts.

## Test Plan

- E2E/unit: blank deck creation writes SVGs with the expected width and height.
- E2E: create deck dialog clearly communicates orientation for portrait and landscape values.
- E2E: first spreadsheet right-click opens the custom context menu.
- Unit: old project structure is detected and migration prompt is required.
- Unit/integration: migration rewrites `system` to `components` and `files` to `assets`.
- Unit/integration: after migration, project reads and writes use only the new structure.
- Component/browser test: imported SVG with known `font-family` is shown in the font picker.
- Component/browser test: missing imported font is surfaced and can be mapped.
- Component/browser test: unavailable local font access falls back to browser fonts without blocking editing.

## Assumptions

- The exact `components` substructure can be refined during implementation, but the old top-level names should not remain after migration.
- Permanent old/new dual support is out of scope.
- Uploaded/project font files are not part of v1 fallback; unsupported browsers use browser fonts only.
