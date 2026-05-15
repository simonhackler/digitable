# Data Editor Images

## Goal

Make image columns in the data editor reliable enough for normal deck-building workflows:
SVG image fields should appear as image columns, users should be able to choose or generate image values,
previews should update immediately, and saved data should reload/export consistently.

## Current State

- `svg-helpers.ts` already treats SVG `<image>` elements as spreadsheet columns with the `ImageEditor` custom editor.
- `data-loader.ts` already resolves image column values into `imagePaths` for card preview generation.
- `svg-data-editor.svelte` already updates SVG previews when image cell values change.
- `toolbar.svelte` already wires `GenerateImagesModal` and `ImageSelectionModal`.
- `ImageEditor` currently behaves like a plain text editor and shows the raw image path.
- Image selection/generation exists, but it is not covered by e2e tests and has rough edges around discovery, persistence, save state, and preview refresh.

## User Stories

- As a designer, when my SVG template contains an `<image id="portrait">`, I see a `portrait` image column in the data editor.
- As a designer, I can type or paste an image path into an image cell and immediately see the card preview update.
- As a designer, I can choose from existing project images without manually typing file paths.
- As a designer, generated images are saved into the project and filled into empty selected image cells.
- As a designer, image values persist in `data.csv` and still render after navigating away, reloading, exporting, or playing.

## Proposed Behavior

- Allow uploading images to a cell that will then be placed in the appropriate folder
- Preserve the current data model: image cells store project-relative paths such as `placeholder.svg`, `generated/card_123_portrait.png`, or embedded data URLs.
- Continue resolving image cell values through `loadImagePaths` rather than duplicating image-loading logic inside the spreadsheet.
- Detect image columns from SVG `<image>` elements on both front and back templates, including `back_`-prefixed back-side columns.
- Show image columns with a simple custom editor:
  - Display the path text.
  - Keep direct text editing possible.
- Add an explicit image picker flow for selected image cells:
  - List images from the project `files/` directory and useful subfolders such as `files/generated/`.
  - Write the selected project-relative path into the selected cells.
  - Trigger the same preview update and autosave path as normal cell edits.
- Allow uploading from the data editor.
- Keep generated images in `files/generated/`.
- When image generation succeeds, fill only empty target cells by default.
- Missing or broken image files should render as transparent placeholders, not break the data editor.
- Make sure the images display correctly in the svg editor view

## Implementation Notes

- Start every bug fix with a failing e2e test first, then make the smallest app change that makes it pass.
- Reuse `loadImagePaths`, `generateSvg`, `initialSetupForSvgItem`, and `updateSvg` instead of adding parallel image replacement logic.
- Keep image cell values as strings in `data.csv`; do not store blob URLs or absolute browser URLs in CSV.
- Ensure picker/generator writes go through `spreadsheet.setValueFromCoords` or the same path used by normal edits so `onchange`, preview updates, and autosave stay consistent.
- Avoid a large image asset manager in this pass. The data editor only needs selecting known project images and consuming generated images.
- Remove console-only success/error feedback from image flows where it affects user trust; surface failure through the existing save/status pattern or a local dialog error.
- Keep AI generation isolated behind the existing `/api/generate-images` client helper; do not couple the rest of image-column reliability to AI availability.

## Acceptance Criteria

- SVG `<image>` elements create image-type spreadsheet columns.
- Image columns discovered from SVG templates are appended after existing CSV columns when missing.
- Typing a valid project-relative image path into an image cell updates the card preview.
- The image value is saved to `data.csv` and reloads after navigating away and back.
- Existing local images from `files/` can be selected into an image column without manually typing the path.
- Generated images are written to `files/generated/` and empty selected image cells receive the generated relative path.
- Broken or missing image paths do not crash the editor.
- Export/play flows still resolve image paths through the shared loader.

## Tests

- Add e2e coverage in `e2e/data-editor.test.ts` for image-column data behavior when it belongs to the spreadsheet.
- Add or keep editor-specific image preview interactions in `e2e/svg-editor.test.ts` only when the SVG editor is the page under test.
- Add a failing e2e test first for each known regression.
- Cover these scenarios:
  - A template `<image>` creates an image column.
  - A missing image SVG column is appended after existing CSV columns.
  - Editing an image cell updates the preview and persists to `data.csv`.
  - Navigating away and back preserves the image cell value and preview.
  - Selecting an existing project image fills the selected image cell.
  - Broken image paths render safely.
- Prefer real OPFS-seeded project files over mocked routes or browser APIs, following `instructions/testing.md`.
- Add focused unit tests around path resolution only if e2e coverage would be too brittle.

## Deferred

- Bulk asset library management.
- Drag-and-drop uploads directly into spreadsheet cells.
- Cropping, masking, or image positioning controls.
- Prompt history and generation retry queues.
- Replacing the existing AI image API contract.

## Open Questions

- Should the first image picker include all files under `files/`, or only recognized image MIME types/extensions?
- Should selecting an image apply to all selected rows, only the active cell, or both via explicit controls?
- Should generated images overwrite filled cells behind a confirm step, or always keep the current fill-empty behavior?
- Should image thumbnails be shown inside spreadsheet cells immediately, or only in the card preview and picker?
