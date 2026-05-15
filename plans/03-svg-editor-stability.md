# SVG Editor Stability

## Goal

Stabilize the SVG editor's core editing interactions before investing in a broader layers/layout redesign.

## User Stories

- As a designer, when I leave text editing mode I can select and manipulate other SVG elements normally.
- As a designer, I can rotate selected SVG elements and trust the saved result.
- As a designer, I can use the structure view without losing normal keyboard input.
- As a designer, I can confirm structure view edits with Enter.

## Proposed Behavior

- Fix the bug where selection remains stuck in text mode.
- Fix rotation for selected SVG elements.
- Fix structure view keyboard handling:
  - Typing `l` works inside structure view inputs.
  - Enter confirms the active structure view edit.
- Keep the current editor layout mostly intact for this stability pass.
- Capture the layers/layouting redesign as follow-up work after the bugs are fixed.

## Implementation Notes

- Start in the embedded `@svg-table/svgeditor` integration and identify whether bugs live in the app wrapper or the editor package.
- Preserve the existing autosave behavior in `/editor` while fixing interaction bugs.
- Prefer narrow fixes around event handling, focus management, and transform serialization.
- Avoid broad panel/layout changes until the stability issues have regression coverage.

## Acceptance Criteria

- Text editing mode can be exited and normal element selection resumes.
- Rotating an element changes the SVG visibly and persists after reload.
- Structure view accepts the letter `l` where text input is expected.
- Enter confirms structure view edits without breaking editor shortcuts.
- Existing front/back side switching still works.

## Tests

- Add focused regression coverage where the editor can be driven reliably.
- Add e2e coverage for rotation persistence if Playwright can interact with the editor controls consistently.
- Add component or lower-level tests for keyboard event handling if full e2e is brittle.
- Manually verify front/back editing and save persistence during the first implementation pass.

## Open Questions

- Which layer workflows are most important for the later layouting pass: reordering, hiding/locking, grouping, renaming, or selecting nested elements?
