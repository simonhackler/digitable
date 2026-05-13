# Deck Management

## Goal

Add safe deck renaming based on the underlying deck folder while preserving deck contents and avoiding name collisions.

## User Stories

- As a designer, I can rename a deck from the deck list or deck actions menu.
- As a designer, my front SVG, back SVG, data CSV, and related files remain intact after renaming.
- As a designer, I get a clear error if the new deck name is invalid or already exists.
- As a designer, after renaming I stay in the matching renamed deck route.

## Proposed Behavior

- Deck rename changes the folder name under `{gameName}/system/{deckName}`.
- Rename preserves all files in the deck folder as-is.
- Validate names with the same basic constraints as deck creation.
- Prevent collisions with existing deck folders.
- Update sidebar state immediately after a successful rename.
- If the user is currently inside the renamed deck route, navigate to the equivalent route for the new name.

## Implementation Notes

- Add rename as an action in the deck overflow menu.
- Use filesystem adapter capabilities where available; if no direct rename exists, implement copy-then-delete only if it can be made safe.
- Collision checks should happen before mutating files.
- Do not introduce separate display-name metadata in v1.
- Preserve route suffixes when possible, for example `/editor` remains `/editor` after rename.

## Acceptance Criteria

- Renaming `old_deck` to `new_deck` moves the deck folder and keeps `front.svg`, `back.svg`, and `data.csv`.
- The sidebar shows `new_deck` and no longer shows `old_deck`.
- Existing deck names cannot be reused.
- Invalid names show validation feedback and do not change files.
- Current deck routes update to the renamed path after success.

## Tests

- Add e2e coverage for successful rename from the deck menu.
- Add e2e coverage for collision handling.
- Add e2e coverage for invalid names.
- Add persistence coverage by reloading after rename and confirming the renamed deck appears.

## Open Questions

- Should deck rename be available only from the sidebar overflow menu, or also from a deck settings/details page later?
