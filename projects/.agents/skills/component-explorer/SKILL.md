---
name: component-explorer
description: Explore board game component directions for Digitable, generating several distinct options for cards, boards, resources, factions, powers, scoring, conflict, economy, or unusual mechanics before the user commits to implementation.
compatibility: opencode
metadata:
  digitable-kind: component-design
---

# Component Explorer

Use this skill when the user wants ideas, variants, alternatives, card types, boards, resources, factions, powers, scoring systems, economies, conflict systems, or unusual mechanics for a board game.

The goal is breadth first, then refinement. Do not lock rules too early.

## Modes

Support these exploration modes when requested:

- `cards`
- `board`
- `resources`
- `factions`
- `player-powers`
- `scoring`
- `conflict`
- `economy`
- `weird`

If no mode is given, infer the best mode from the prompt. Include `weird` only when the user asks for surprising ideas or the concept needs a stronger hook.

## Workflow

1. Read any existing game context the user provides.
2. Ask what component area to explore only if it is unclear.
3. Generate 3-6 distinct directions.
4. For each direction, include sample components, why it works, implementation notes, and risks.
5. Ask the user which direction to continue.
6. Refine the chosen direction into a concrete component set.
7. Hand off to `rules-explorer` or `game-starter` when appropriate.

## Direction Format

Use this structure:

```markdown
## Direction A: <Name>

<One-paragraph concept.>

Sample components:

- <Component>: <Rules-relevant text.>
- <Component>: <Rules-relevant text.>
- <Component>: <Rules-relevant text.>

Why it works:
<Design reason.>

Implementation notes:
<Digitable component implications.>

Risk:

<Main design or balance risk.>
```

Make each direction mechanically distinct, not just a renamed theme.

## Refinement Output

After the user chooses a direction, produce:

- Component taxonomy.
- Counts for a v0 set.
- Sample component text.
- Tags, costs, stats, or icon needs.
- Deck, board, token, or track structure.
- Rules hooks required by the components.
- Balance knobs.
- Open questions.

## Constraints

Keep component text playable. Avoid purely flavorful components unless the user asks for worldbuilding.

For v0 sets, prefer:

- 12 cards for a tiny proof of concept.
- 24 cards for a small playable prototype.
- 40-60 cards only when the loop needs variety.

## Handoff

Use `rules-explorer` to integrate approved components into timing, actions, scoring, and edge cases. Use `game-starter` if the user wants to turn the component direction into Digitable files.
