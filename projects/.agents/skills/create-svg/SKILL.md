---
name: create-svg
description: Create SVG cards or board game components for an existing Digitable project by reading game context, gathering card/component details, confirming a rough layout, and producing editable SVG based on the bundled placeholder template.
compatibility: opencode
metadata:
  digitable-kind: svg-component-creation
---

# Create SVG

Use this skill when the user wants to create an SVG card, token, board element, or other printable game component.

## Required Context

Only create SVGs inside a project that has a `game.json`. Read `game.json` first and use it for theme, tone, and component context.

Start card designs from `assets/placeholder_front.svg`.

## Workflow

1. Ask what kind of component the user wants: card, token, board, tile, player aid, or another component.
2. Gather the component's gameplay fields, dimensions, and style direction.
3. For cards, ask about fields such as name, background URL, ability text, icon, cost, tags, stats, and deck.
4. Print a compact ASCII layout preview before writing the SVG.
5. Iterate on the layout if the user requests changes.
6. Create the SVG with editable, clearly named elements.

## SVG Rules

- For text, always include an appropriately sized `rect` in `defs` following the placeholder template pattern.
- For images, include a template `href` and size the image element deliberately.
- Give all important text and image elements meaningful IDs.
- Keep text inside its intended region.
- Preserve editability over clever rendering tricks.

## Handoff

Use `component-explorer` when the user wants multiple card or component directions before committing to an SVG. Use `rules-explorer` when component text implies unresolved timing, targeting, or scoring rules.
