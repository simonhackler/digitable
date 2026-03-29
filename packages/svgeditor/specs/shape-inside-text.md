# Shape-Inside Text Editing + Inkscape Export

## Goal
Provide a flow-text editing experience in the browser while saving SVGs in Inkscape’s SVG2 format (shape-inside + SVG 1.1 fallback) so files remain editable and renderable in Inkscape and other viewers.

## Non-goals
- Implement full SVG2 text layout engine in-browser.
- Guarantee pixel-perfect fallback layout matching Inkscape.

## High-level behavior
- **Editing in browser:** use `<foreignObject>` with a HTML `<div>` for live multi-line editing and wrapping.
- **Text creation:** always create a **rect** that defines the text flow area. The text is typed into this rect.
- **Save:** convert editor `<foreignObject>` blocks into Inkscape-style SVG2 text:
  - `<text style="...;shape-inside:url(#rectId);...">`
  - `<tspan ...>...</tspan>` fallback lines (SVG 1.1 layout)

## Data model / metadata
- Each flow-text item has:
  - `rectId` (the shape-inside target)
  - `textId` (stable identifier used in data editor)
  - `textContent`
  - `style` (font-family, font-size, font-weight, font-style, line-height, letter-spacing, text-align, fill/color)
  - optional `transform`
- Store metadata on the `<foreignObject>` while editing via `data-*` attributes, e.g.:
  - `data-flow-rect="rect123"`
  - `data-flow-id="effect_zone"`
  - `data-flow-lineheight="1.25"`

## DOM representation (edit mode)
1) A rect in `<defs>` defines the text area:
   ```
   <defs>
     <rect id="rect123" x="10" y="20" width="40" height="15" />
   </defs>
   ```
2) The editor replaces SVG `<text>` with a `<foreignObject>`:
   ```
   <foreignObject id="effect_zone" x="10" y="20" width="40" height="15"
                  data-flow-rect="rect123" data-flow-id="effect_zone">
     <div xmlns="http://www.w3.org/1999/xhtml">Hello</div>
   </foreignObject>
   ```

## Text creation flow
- When user adds text:
  1) Create rect in `<defs>` with a unique id (e.g. `rect_<uuid>`).
  2) Create `<foreignObject>` using that rect’s x/y/width/height.
  3) Insert `<div>` with default font styles and placeholder text.
  4) Track `textId` (id on foreignObject) for data editor integration.

## Save/export flow (Inkscape format)
For each `<foreignObject data-flow-rect>`:
1) Resolve rect (x/y/width/height) from defs via `data-flow-rect`.
2) Generate `<text>` element:
   - `xml:space="preserve"`
   - `style` includes:
     - `shape-inside:url(#rectId)`
     - `white-space:pre`
     - `line-height`, `font-*`, `text-align`, `letter-spacing`, `fill`
     - `display:inline`
     - optional `-inkscape-font-specification` (if we can preserve it)
   - preserve `transform` if present on foreignObject
   - use `id = data-flow-id`
3) Insert fallback lines as `<tspan>` children:
   - Use a simple line-wrap algorithm to break the text to fit rect width.
   - Each line becomes a `<tspan>` with explicit `x` and `y` positions.
   - The first line uses `y = rect.y + fontSize` (baseline approx); next lines use `dy = lineHeightPx`.
   - Honor text-align by setting `text-anchor` and x position:
     - start: `x = rect.x`
     - middle: `x = rect.x + rect.width / 2`
     - end: `x = rect.x + rect.width`
4) Remove the `<foreignObject>` from the saved SVG.

## Fallback layout strategy
- Line wrapping is approximate; it should be “good enough” for non-SVG2 renderers.
- Use a hidden SVG `<text>` element to measure line width with `getComputedTextLength()` so font metrics match SVG.
- Preserve explicit newlines as hard breaks.

## Load/import behavior
When loading an SVG:
- If a `<text>` has `shape-inside:url(#rectId)`:
  - Convert to `<foreignObject>` using the rect bounds.
  - Copy styles from `<text>` to `<div>`.
  - Use `<tspan>` text content (concatenate with `\n` between lines).
- If no `shape-inside`:
  - Use current text import behavior (single-line), or upgrade to rect-based editing if user opts in.

## Integration points
- `ReferenceEditor` / `SvgCanvasHost` should work with both native SVG text and flow-text foreignObjects.
- Data editor expects stable `id` on editable nodes. Ensure `foreignObject.id` matches original `<text id>`.
- `parseSvg` should include flow-text columns using the `foreignObject` id (not the rect id).

## Edge cases
- Empty text: still create rect + foreignObject; export a `<text>` with empty `<tspan>`.
- Transform on text: apply same transform to foreignObject while editing; preserve on export.
- Multiple text boxes: avoid rect id collisions; ensure defs is kept stable.

## Open questions
- Do we need to preserve Inkscape-specific attributes (e.g. `inkscape:label`)?
- Should we keep SVG2 text even when we can compute fallback? (Probably yes.)
- Where to store default font + line-height presets for new text?
