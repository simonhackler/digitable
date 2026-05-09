# Navigation and Create Flow

## Goal

Make the deck editor the first-class entry point for deck work and remove the old layout page from the user-facing product.

## User Stories

- As a designer, when I create a new deck I land directly in the editor so I can start designing immediately.
- As a designer, when I select an existing deck from the sidebar I open the editor first, with data still one click away.
- As a designer, when I create a new game I stay on the game edit page and can continue setting metadata or create decks.
- As a designer, I can create a game from the project switcher without using the main games overview.

## Proposed Behavior

- Deck links in the sidebar open `/games/{gameName}/decks/{deckName}/editor`.
- Creating a new deck creates the required front/back SVG files, updates sidebar state, closes the dialog, and navigates to `/editor`.
- The deck editor shows direct navigation to the data editor.
- The `/layout` route is removed as a valid page. Old `/layout` URLs should return the normal not-found behavior rather than redirecting.
- Creating a game from either the games overview or project switcher navigates to `/games/{folderName}?gameName={displayName}` and shows the game edit/create form.

## Implementation Notes

- Update deck hrefs and create-deck navigation in `packages/app/src/routes/games/create-menu.svelte`.
- Remove the layout page from navigation and delete or disable the route file under the deck route.
- Wire the project switcher's "New Game" menu item to the existing create-game popover behavior instead of leaving it inert.
- Keep game creation on the game metadata page; do not auto-create a first deck.
- Revisit e2e expectations that currently assert new decks land on `/data`.

## Acceptance Criteria

- New decks open in `/editor` immediately after creation.
- Existing deck sidebar links open `/editor`.
- The editor provides a working path to `/data`.
- Visiting `/games/{game}/decks/{deck}/layout` does not render the old layout page.
- The project switcher can start the create-game flow.
- Creating a game still lands on the game edit page and saves metadata as before.

## Tests

- Update deck creation e2e tests to expect `/editor`.
- Add or update an e2e test for creating a game from the project switcher.
- Add a route-level assertion that `/layout` no longer renders the layout editor.

## Open Questions

- Should the editor include any import/upload affordance that previously lived on the layout page, or should missing SVGs be handled only by the new-deck creation flow?
