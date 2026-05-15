# Playtest Pages and Notes

## Goal

Adapt the play page for print-and-play testing by supporting paper page components, freehand writing, undo/redo, and markdown notes saved inside the game project.

## User Stories

- As a designer, I can add A4 or A5 pages to the play table.
- As a designer, I can write or draw on those pages during a playtest.
- As a designer, I can undo and redo writing actions reliably.
- As a designer, I can keep playtest notes in markdown with the rest of the game project.
- As a designer, I can test card decks together with paper pages in one play session.

## Proposed Behavior

- Add page components to the play page, starting with A4 and A5 sizes.
- Page components support orientation selection.
- Freehand ink can be drawn on page components.
- Undo/redo works for ink strokes.
- Playtest notes are saved as markdown files inside the active game project folder.
- Deck-of-cards playtesting remains part of the same play page workflow.

## Implementation Notes

- Build page support as placeable play components rather than making the whole board a fixed paper canvas.
- Store ink strokes in a representation that can be saved and restored with the playtest state.
- Treat undo/redo as a first-class requirement, not a later cleanup task.
- Keep Obsidian-specific integration out of v1; markdown files in the project folder are enough.
- Consider whether pages are created from a component menu, a playtest setup panel, or a simple toolbar action.

## Acceptance Criteria

- Users can add an A4 page and an A5 page to the play table.
- Users can choose page orientation.
- Users can draw freehand ink on a page.
- Undo removes the last stroke and redo restores it.
- Ink remains associated with the page when the page moves.
- Markdown notes can be created and saved under the active project.
- Existing deck interactions still work in the play page.

## Tests

- Add interaction coverage for adding page components.
- Add focused tests for undo/redo state changes if the drawing layer can be tested below e2e.
- Add e2e smoke coverage for drawing on a page if browser input events are reliable enough.
- Add filesystem coverage for creating/saving markdown notes in the game project.

## Open Questions

- Should ink and markdown notes be saved automatically during play, or should the play page expose a manual save action?
