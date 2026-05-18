# Play Surface Plan

## Summary

Improve the Play table so it supports real playtesting workflows: cards and pages behave differently, stacking and drawing are explicit enough to avoid accidents, table scale matches the source layouts, and multiplayer state is clearer.

## Quick Fixes

- Render single-card sources as loose cards instead of one-card stacks.
- Remove hover darkening from pages/maps.
- Record the "couldn't select some cards" issue as deferred until there is a reliable repro. When investigated, focus on Pixi hit areas, hidden/renderable state, stack wrappers, and local z-order.

## Larger Features

- Add distinct Play component behavior for `card` and `page`.
- Cards can stack, draw, flip, move, and be selected.
- Pages are locked writable sheets: they accept pen strokes, never stack, never draw to hand, and are movable only in setup mode.
- Keep the existing draw-to-hand command.
- Add a new draw-to-cursor/table command that draws the top card from a stack under the pointer, keeps it on the table, and does not auto-flip unless the command explicitly asks for that.
- Require a modifier key drop for stacking. Normal overlapping drops move the card only.
- Add setup mode before play. First version should let the creator arrange pages/cards/grid and then enter play mode, where setup-only objects are locked.
- Add a question-mark help menu with current actions and hotkeys.
- Add pen thickness presets. Keep color and opacity fixed for the first pass.
- Render objects using real SVG/page dimensions and a shared physical table scale so cards and maps compare correctly.
- Add visible grid and snap-to-grid. Snap is on by default. Default grid size is `10mm`.
- Use local selected/dragged lift only: selected or dragged objects render above others locally while preserving server order until dropped.
- Keep pan and zoom inside the Pixi viewport. The Play page should lock document/body overflow and avoid browser-created scrollbars.
- Add remote player cursors and remote selection outlines with stable per-player colors.
- Add a shared global server command history foundation for undo/redo. Store apply/inverse records so the same model can later support playtest replay.

## Public Interfaces / Types

- Expand Play component modeling to distinguish at least `card` and `page`.
- Preserve the current draw-to-hand command behavior.
- Add a draw-to-table/cursor command.
- Add command history records on the server for global undo/redo and later replay.
- Add room state or messages for remote cursor and remote selection presence.

## Test Plan

- E2E: a one-card source appears as a loose card on the table.
- E2E: normal overlapping card drop does not stack; modifier drop stacks.
- E2E: existing draw command still moves a drawn card to hand.
- E2E: new draw-to-cursor command places the drawn card under the pointer on the table.
- E2E: page objects accept pen strokes, do not hover-darken, and do not stack.
- E2E: Play page has no document scrollbars at desktop and mobile viewports.
- E2E: grid snap defaults on and uses a `10mm` grid.
- Unit/server tests: undo/redo command history applies and reverses shared commands in order.

## Assumptions

- Token components are out of scope for this pass.
- Setup mode UX can stay simple in v1.
- Server z-order persistence is out of scope; only local selected/dragged lift is planned.
