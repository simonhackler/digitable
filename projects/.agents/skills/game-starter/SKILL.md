---
name: game-starter
description: Guide a rough board game idea into a first Digitable prototype through an iterative discovery loop, asking focused questions before proposing rules, components, or files.
compatibility: opencode
metadata:
  digitable-kind: prototype-builder
---

# Game Starter

Use this skill when the user says they want to make, start, create, or prototype a new game in Digitable.

Your goal is not to build the whole game. Your goal is to help the user discover the smallest playable prototype that can be created, tested, and improved.

The user owns the game vision. Do not jump from a rough theme to a complete set of rules, components, or a prototype plan. Treat early answers as signals to investigate, not permission to design the whole game for them.

## Workflow

1. Reflect the idea back in 1-3 bullets using only facts the user supplied.
2. Identify the single most important unknown that blocks the next decision.
3. Ask one focused question, or at most three tightly related questions if they are simple metadata.
4. Stop and wait for the user's answer.
5. Repeat until the required prototype decisions are known.
6. Only then summarize the agreed first playable wedge.
7. Ask before drafting starter rules, component lists, or Digitable files unless the user explicitly requested that output.
8. Create or instruct creation of Digitable files only after the required metadata and first playable scope are explicit.

If the user gives enough information, do not over-question. Summarize the known decisions and ask for confirmation before turning them into rules or files.

## Discovery Discipline

Borrow this cadence from strong product office-hours workflows:

- Ask forcing questions that reveal the user's intent, constraints, and taste.
- Ask one decision at a time when the answer changes the game shape.
- Smart-skip questions already answered by the user's words.
- Quote or paraphrase the user's actual details before asking the next question.
- Offer 2-4 options only when it helps the user answer faster.
- Include an "unsure / help me choose" option in prose when the user is still exploring.
- Stop after the question. Do not append a draft plan after asking it.

Do not:

- Invent card types, turn structures, win conditions, resource systems, component counts, or starter scenarios before the user has chosen the relevant direction.
- Present speculative rules as "recommended" while the user is still describing the concept.
- Fill the conversation with a full prototype plan when the next useful move is a question.
- Treat genre defaults as user decisions. "Card game" does not imply deckbuilding, hand size, draw rate, attack rules, or 24 cards unless the user confirms them.

## Prototype Questions

Use these questions as a backlog, not a checklist. Ask the highest-leverage unanswered question first.

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

## First Response Pattern

For a very rough prompt, respond like this:

```markdown
I have this so far:

- <fact from the user>
- <fact from the user>

The next design decision is <specific unknown>. Which direction should this lean?

1. <option grounded in the user's idea>
2. <option grounded in the user's idea>
3. <option grounded in the user's idea>

You can also answer in your own words.
```

Then stop.

Example: if the user says "I want to create a post apocalyptic vehicle building game. Players will add cards to their vehicle and attack other vehicles," do not propose rules, card counts, chassis cards, scrap income, or hull values. Ask the next shaping question, such as:

```markdown
I have this so far:

- Post-apocalyptic vehicle building.
- Players attach cards to vehicles.
- Vehicles can attack each other.

The next design decision is what the core tension should be. Which version sounds closest?

1. Tactical duel: build one vehicle and outfight one rival.
2. Arena brawl: several vehicles pile on, with alliances and opportunistic attacks.
3. Survival run: vehicles fight while racing through hazards and scarce supplies.

You can also answer in your own words.
```

## Ready-to-Plan Gate

Do not produce the full `Prototype Plan` until these decisions are known or explicitly assumed with user consent:

- Working title or permission to use a placeholder title.
- Player count target.
- Intended playtest length or complexity.
- Core tension or main pleasure.
- Primary component format.
- The different cards/component types and what values will be needed for them
- First prototype scope.
- One known win/loss condition or scoring direction.

If one or more are missing, ask the next question instead of writing the plan.

## Scope Rule

After the ready-to-plan gate is satisfied, recommend one smallest playable wedge and explicitly defer nonessential ideas:

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

When the ready-to-plan gate is satisfied and the user wants the plan, produce:

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
