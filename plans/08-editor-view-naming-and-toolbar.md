# Editor View Naming And Toolbar

## Goal

Make the deck editing views easier to understand by naming them after familiar tools and giving both views a shared toolbar pattern.

## User Stories

- As a designer, I understand that the spreadsheet view edits deck data.
- As a designer, I understand that the layout view edits the SVG template.
- As a designer, I can move between Spreadsheet and Layout without hunting for page-specific buttons.
- As a designer, I can use common deck editor controls from a consistent toolbar in both views.

## Proposed Behavior

- Rename user-facing "Data editor" text to "Spreadsheet editor".
- Rename user-facing SVG editor text to "Layout editor".
- Add a shared deck editor toolbar component used by both the Spreadsheet editor and Layout editor.
- The toolbar shows view navigation between Spreadsheet and Layout.
- The Spreadsheet editor toolbar includes the existing card side flip controls and image actions.
- The Layout editor toolbar includes the existing front/back side controls and upload action.
- Add a Spreadsheet editor action that navigates to the matching Layout editor context for the selected SVG element or card.
- Make snap to page enabled by default in the Layout editor.

## Implementation Notes

- Keep route paths unchanged for now: `/data` and `/editor` can remain internal URLs.
- Update visible labels, button titles, aria labels, and empty states to use Spreadsheet and Layout wording.
- Prefer a small shared toolbar shell that accepts view-specific actions as snippets or props.
- Keep toolbar controls compact and tool-like; use existing button and icon patterns.
- If the SVG editor package exposes snap settings through `ReferenceEditor` config, set the default there from the app wrapper.
- If snap to page is owned inside `@svg-table/svgeditor`, implement the default in that package without changing unrelated snapping behavior.

## Acceptance Criteria

- Deck navigation and page controls use Spreadsheet and Layout names consistently.
- The Spreadsheet editor and Layout editor both render a shared toolbar shell.
- The toolbar provides a clear way to navigate between the two views.
- Existing Spreadsheet editor image actions still work.
- Existing Layout editor front/back switching and upload still work.
- Layout editor starts with snap to page enabled by default.

## Tests

- Update existing e2e assertions that look for old user-facing labels.
- Add focused e2e coverage that navigation from Spreadsheet to Layout and Layout to Spreadsheet works.
- Add coverage that the Layout editor still switches between front and back sides.
- Add coverage for the Spreadsheet editor navigate-to action if the target behavior can be asserted without visual positioning.
