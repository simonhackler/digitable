# Layout Editor Undo Redo Regression

## Goal

Make Layout editor undo and redo reliable enough to trust for normal SVG editing.

## User Stories

- As a designer, I can undo an SVG edit and see the saved SVG return to the previous state.
- As a designer, I can redo an undone SVG edit and see the saved SVG return to the edited state.
- As a designer, undo and redo behave correctly after loading a deck side.
- As a designer, undo and redo do not carry state across deck navigation.

## Proposed Behavior

- Audit undo and redo in the `@svg-table/svgeditor` integration.
- Confirm undo stack reset behavior after SVG load and side/deck changes.
- Add regression tests that compare actual serialized SVG output, not only visible UI state.
- Cover at least one simple element edit.
- Cover text editing if the test can drive it reliably.
- Keep fixes narrow around command history, change emission, and stack state.

## Implementation Notes

- Start in `packages/svgeditor/src/lib/core/createSvgCanvas.ts`, `SvgCanvasHost.svelte`, and `createEditorController.svelte.ts`.
- Verify whether changes made by toolbar controls and canvas interactions both enter undo history.
- Ensure `on:change` events report user changes after undo and redo so the app autosave path persists the result.
- Normalize SVG output before comparing in tests to avoid noise from formatting or generated ids.
- Do not broaden this into a full editor command-system rewrite unless the audit shows no narrower fix is possible.

## Acceptance Criteria

- Undo after a simple SVG edit restores the prior serialized SVG.
- Redo after that undo restores the edited serialized SVG.
- Undo and redo update the enabled/disabled toolbar state or exposed stack counts.
- Loading a new SVG clears old undo and redo history.
- Switching decks does not allow undoing changes from the previous deck.
- Autosave persists the SVG that results from undo and redo.

## Tests

- Read `instructions/testing.md` before adding tests.
- Add focused regression coverage in `e2e/svg-editor.test.ts` or a lower-level SVG editor test if e2e interaction is brittle.
- Compare normalized actual SVG strings for before, edited, undone, and redone states.
- Run the focused test in a red-green loop with `devenv shell -- bun run playwright test`.
