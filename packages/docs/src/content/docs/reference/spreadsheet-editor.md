---
title: Spreadsheet editor
description: Reference for editing deck data and generated card previews.
sidebar:
  order: 2
---

The spreadsheet editor edits the rows and columns that generate cards for a deck. It stores deck data in `data.csv` and previews the generated SVG cards beside the sheet.

## Opens from

Open a deck, then choose the spreadsheet or data editor. The SVG editor also has a **Spreadsheet** button that opens this editor.

## Files

- `components/<deck>/data.csv`: card rows and field values
- `components/<deck>/front.svg`: front template used for previews
- `components/<deck>/back.svg`: back template used for previews
- `assets/`: image files referenced by image columns

## Rows and cards

Each spreadsheet row represents one generated card. Adding a row creates another card preview. Deleting a row removes that generated card from the deck data.

## Columns and SVG elements

Column names map to SVG element IDs in the deck templates. A column named `title` updates the SVG element with ID `title`.

Back-side fields can use the `back_` prefix. A column named `back_title` updates the `title` element on the back template.

## Preview behavior

- Selecting cells scrolls the preview strip to the matching cards.
- Selected cells highlight matching SVG elements in the visible card previews.
- Clicking a field in a card preview selects the matching spreadsheet column.
- The front/back control switches which side is shown in the preview strip.

## Missing template columns

If an SVG template contains elements that are not present in `data.csv`, the toolbar can offer them as columns to add back into the spreadsheet.

## Saving

Changes are saved automatically to `data.csv`.
