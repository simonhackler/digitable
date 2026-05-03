---
name: game-starter
description: Turn a rough board game idea into a narrow first Digitable prototype by asking onboarding questions, choosing the smallest playable wedge, drafting starter rules, and specifying initial components and TODOs.
compatibility: opencode
metadata:
  digitable-kind: prototype-builder
---

# Game Starter

Use this skill when the user says they want to make, start, create, or prototype a new game in Digitable.

Your goal is not to build the whole game. Your goal is to get to the smallest playable prototype that can be created, tested, and improved.

## Workflow

1. Capture the idea in one paragraph.
2. Ask only the questions needed to choose a first prototype.
3. Recommend a narrow playable wedge.
4. Draft the starter rules and component list.
5. Define the first test scenario or first-turn tutorial.
6. Create or instruct creation of Digitable files when the environment supports it.
7. Leave explicit TODOs for the next iteration.

If the user gives enough information, do not over-question. State assumptions and move to the prototype.

## Prototype Questions

Ask the most relevant questions from this list:

- Audience: kids, families, hobby gamers, party gamers, solo players.
- Tone: funny, strategic, dramatic, cozy, mean, chaotic, tense.
- Complexity: very light, light, medium, heavy.
- Format: card game, board game, tile game, dice game, social game, hybrid.
- Medium: digital-only, print-and-play, publishable physical game.
- Player count and playtime.
- Core mechanic: drafting, deckbuilding, movement, bidding, bluffing, trading, fighting, puzzle solving, push-your-luck, storytelling.
- Main pleasure: tactical choice, engine building, negotiation, surprise, story, chaos.
- First scope: card-only, board-plus-cards, tokens, tracks, dice.
- Initial size: 12, 24, 40, or 60 cards/components.
- Visual requirements: art placeholders, icons, tags, costs, effects.

## Scope Rule

Prefer a 2-player or solo-testable prototype unless the concept requires more players.

Recommend one smallest playable wedge and explicitly defer nonessential ideas:

```text
Recommended first prototype:
A 2-player card-only market game with 24 cards and one scoring condition.

Not yet:
- No asymmetric factions.
- No event deck.
- No campaign mode.
- No advanced trading.
```

## Output Format

Produce:

```markdown
# Prototype Plan: <Game Name>

## Pitch

## Target Experience

## First Playable Wedge

## Components to Create

## Starter Rules

## First Test Scenario

## Files or Digitable Objects

## TODOs
```

For Digitable objects, be concrete:

- Game name.
- `game.json` fields.
- Deck names.
- Card or tile counts.
- Required SVG templates.
- Tokens, boards, tracks, or player aids.
- Starter scenario.

When implementation is possible, create the smallest useful file set rather than only describing it.

## Handoff

Use `rules-explorer` next when the starter loop needs hardening. Use `component-explorer` next when the user wants more card, board, resource, faction, or scoring alternatives.
