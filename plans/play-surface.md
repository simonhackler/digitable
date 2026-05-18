# Play Surface Plan

## Larger Features

- Add distinct Play component behavior for `card` and `page`. Pages should not hover darkly when hovering. Page components need to be integrated in the menu workflow as well
- Support locking components. So they can't move

- Keep the existing draw-to-hand command. Add a new draw-to-cursor/table command that draws the top card from a stack under the pointer, keeps it on the table, and does not auto-flip unless the command explicitly asks for that.

- Require a modifier key drop for stacking. Normal overlapping drops move the card only.
- Add a question-mark help menu with current actions and hotkeys.

- Add pen thickness presets. Keep color and opacity fixed for the first pass.

- Render objects using real SVG/page dimensions and a shared physical table scale so cards and maps compare correctly.
- Add visible grid and snap-to-grid. Snap is on by default. Default grid size is `10mm`.

- Use local selected/dragged lift only: selected or dragged objects render above others locally while preserving server order until dropped.
- Rework layering. Server needs to have a proper component structure to support layering and updating layers. How? How will the structure look like
- Keep pan and zoom inside the Pixi viewport. The Play page should lock document/body overflow and avoid browser-created scrollbars.
- Add remote player cursors and remote selection outlines with stable per-player colors.
- Add a shared global server command history foundation for undo/redo. Store apply/inverse records so the same model can later support playtest replay.
