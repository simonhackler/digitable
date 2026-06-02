# Project Structure and Editor Plan

## Summary

Clarify deck creation, fix the spreadsheet context menu bug, introduce a versioned project folder migration path, and add a Digitable font feature for system fonts and Inkscape imports.

## Quick Fixes

- Fix the spreadsheet bug where the first right-click does not open the context menu. Add regression coverage for first right-click on the spreadsheet. (Write the test first and make sure it fails)

## Larger Features

- Move project folder naming toward `components` plus `assets`.
- Replace current `system` usage with `components` after migration.
- Replace current `files` usage with `assets` after migration.
- Add per-project schema/version metadata.
- Add a lazy migration prompt when opening an old project.
- After migration, write and edit only the new structure. Do not maintain permanent dual support. (Migration should move)

- Add a Digitable font feature:
  - use google fonts or whatever for all the font's.
  - make loaded fonts available in the SVG text font picker;
  - preserve `font-family` and Inkscape font metadata on import;
  - show missing imported fonts and let users map them to loaded system/browser fonts;
  - fall back to browser fonts when system font access is unavailable.
