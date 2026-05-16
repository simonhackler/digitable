# SVG Reload And Performance

## Goal

Keep both deck editor views fresh when SVG files change externally, and remove the SVG data bottleneck that slows editing.

## User Stories

- As a designer, when I save an SVG in Inkscape, Digitable reloads the changed SVG in the Spreadsheet editor.
- As a designer, when I save an SVG in Inkscape, Digitable reloads the changed SVG in the Layout editor.
- As a designer, switching between decks always shows the newly selected deck's current SVGs and data.
- As a designer, large SVG templates do not make both editor views noticeably slow.

## Proposed Behavior

- Investigate the performance cost around SVG parsing, the SVG data `Map`, generated previews, and editor mount/update paths.
- Auto-reload `front.svg` and `back.svg` in both editor views when external changes are detected.
- Navigating between decks forces fresh loading in both the Layout editor and Spreadsheet editor.
- Avoid overwriting unsaved in-app changes with external reloads while a local save is pending.
- Keep reload behavior limited to the current deck and active editor context.

## Implementation Notes

- Start by measuring `parseSvg`, `getSvgDataMap`, `loadSvgsAndData`, generated preview creation, and `ReferenceEditor` remounts.
- Check whether repeated cloning, random SVG ids, or reactive `Map` recreation causes unnecessary work.
- Prefer memoizing by file content, deck path, or SVG file version over global mutable caches.
- Use existing file adapter APIs where possible; if polling is needed, keep the interval conservative and stop it on unmount.
- Make deck route parameters part of keyed loading so deck navigation cannot reuse stale templates or spreadsheet state.
- Document any browser File System Access limitations that prevent perfect external-change detection.

## Acceptance Criteria

- Saving `front.svg` or `back.svg` outside the app is reflected in the Spreadsheet editor without a full browser reload.
- Saving `front.svg` or `back.svg` outside the app is reflected in the Layout editor without a full browser reload.
- Navigating from one deck to another reloads SVG templates and spreadsheet data for the target deck.
- Returning to the first deck shows that deck's current files, not stale state from the previous deck.
- The identified SVG data slowdown has a measured before and after result or a documented finding if no code change is justified.

## Tests

- Add an e2e test that edits SVG files through the real file system adapter, then verifies both views observe the change.
- Add e2e coverage for deck-to-deck navigation reloading Spreadsheet and Layout state.
- Add lower-level tests for any memoization or reload helper introduced.
- For performance work, capture a small reproducible measurement in the implementation notes or PR description.
