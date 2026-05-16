---
name: component-explorer
description: Explore board game component directions for Digitable, generating several distinct options for cards, boards, resources, factions, powers, scoring, conflict, economy, or unusual mechanics before the user commits to implementation.
compatibility: opencode
metadata:
  digitable-kind: component-design
---

# Component Explorer

Use this skill when the user wants ideas, variants, alternatives, card types, boards, resources, factions, powers, scoring systems, economies, conflict systems, or unusual mechanics for a board game.

Do not use this as the first response to a vague "I want to make a game" prompt unless the user specifically asks for component ideas. Use `new-game-discovery` first to discover the game shape.

For a new game, do not use this skill to create specific cards, detailed component lists, card text, or component inventories until `new-game-discovery` has established a playable first ruleset loop. If the concept has component categories but the turn structure, actions, timing, or conflict rules are still vague, hand back to `new-game-discovery` or `rules-explorer` instead of generating content.

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
2. Ask what component area to explore if it is unclear.
3. Ask any missing constraint that would make generated options useful.
4. Generate 3-6 distinct directions only after the component area is clear.
5. For each direction, include sample components, why it works, implementation notes, and risks.
6. Ask the user which direction to continue.
7. Refine the chosen direction into a concrete component set.
8. Hand off to `rules-explorer` or `new-game-discovery` when appropriate.

When constraints are missing, ask a question and stop. Do not fill in the component taxonomy, counts, costs, or card text before the user has chosen a direction.
When the first ruleset loop is missing, do not fill in the component taxonomy, counts, costs, or card text before the rules loop is resolved.

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

Use `rules-explorer` to integrate approved components into timing, actions, scoring, and edge cases. Use `new-game-discovery` if the user wants to turn the component direction into Digitable files.
