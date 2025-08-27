# Goal

Create a new modal component for image selection that displays the SVG card, allows switching between images of selected columns using arrows (displaying like "< current_url >"), enables switching between cards, and instantly updates the spreadsheet with selected images.

# Ordered Items

1. Create the new modal component file
   How (implementation):
   - Create a new Svelte file at `src/routes/games/[gameName]/decks/[deckName]/data/image-selection-modal.svelte`, mirroring the structure of generate-images-modal.svelte.
   - Import UI components: Dialog, Button, Label, and utilities from `$lib` (similar to the image generation modal).
   - Define props: `selection`, `spreadsheet`, `svgTemplate`, `onSelectionChange` (optional callback, akin to `onGenerateImages`).
   - Use `$state` for modal open/close, current card index, and selected images map (inspired by `columnPrompts` and `open` in the generation modal).
   - Add `$derived` for `selectionData` (to compute image columns and rows, similar to the generation modal's derived logic).
   - Include snippets for reusable elements like `columnBadge` and `columnHeader` to match the generation modal's style.
   - Acceptance note: File creates successfully with structure inspired by the image generation modal.

2. Implement SVG card display
   How (implementation):
   - Render the `svgTemplate` as an SVG element in the modal content without a fixed width container—let it scale naturally.
   - Use dynamic binding to update the SVG with selected images from the current card and column.
   - Acceptance note: The SVG displays correctly and scales responsively.

3. Add switching between images of selected columns
   How (implementation):
   - For each selected column (from `selectionData.imageColumns`), display the column name and an image selector with left/right arrows.
   - Only allow selection for the files inside the generated that have the row id in the name. see the Toolbar.svelte file for naming
   - Show the current image URL or preview like "< current_url >" in the center.
   - Bind arrow clicks to update the selected image index in `$state`, cycling through available images for that column.
   - Update the SVG display in real-time when switching. Look at the svg-data-editor
   - Acceptance note: Arrows allow cycling through images, and the SVG updates instantly.

4. Add switching between cards
   How (implementation):
   - Add navigation controls (e.g., prev/next buttons) to switch between cards in the selection (rows from `selection.borderTopIndex` to `selection.borderBottomIndex`).
   - Update the current card index in `$state` and refresh the SVG and image selections accordingly.
   - Ensure the modal shows the current card's data (e.g., row ID) for context.
   - Acceptance note: Switching cards updates the displayed SVG and resets image selections to the current card's values.

5. Implement instant spreadsheet updates
   How (implementation):
   - Use `$effect` or event handlers to instantly call `spreadsheet.setValue()` whenever an image selection changes for the current card and column.
   - No save button—updates happen on selection change.
   - Handle edge cases: no selection (no update), invalid images (skip or log error).
   - Acceptance note: Spreadsheet cells update immediately after image selection, reflecting the new values without manual saving.
