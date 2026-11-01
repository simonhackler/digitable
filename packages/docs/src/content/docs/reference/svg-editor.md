---
title: SVG editor
description: Reference for editing card face SVG templates.
sidebar:
  order: 1
---

The SVG editor edits the visual templates for a deck. Each deck has a front template and a back template, stored as `front.svg` and `back.svg` in the deck folder.

## Opens from

Open a deck, then choose the layout or SVG editor for that deck.

## Files

- `components/<deck>/front.svg`: front face template
- `components/<deck>/back.svg`: back face template
- `assets/`: shared image assets used by SVG image elements

## Main controls

- **Spreadsheet** opens the spreadsheet editor for the same deck.
- **Front / Back** switches the active card side.
- **Upload** replaces the current side's SVG template with an uploaded SVG file.
- The SVG toolbar provides the drawing, selection, text, shape, and image tools supplied by the embedded SVG editor.

## Template creation

If a deck does not have SVG templates yet, the editor shows a **Create templates** action. The dialog creates matching front and back SVG files using the selected canvas width and height.

## Spreadsheet binding

SVG element IDs are used as spreadsheet column names. For example, a text or image element with ID `title` is populated from the `title` column in `data.csv`.

Back-side data can use the `back_` prefix. For example, `back_title` targets the `title` element on the back template.

## Saving

Changes are saved automatically to the current side's SVG file.
