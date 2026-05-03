---
name: rules-explorer
description: Interrogate rough board game ideas or early rulesets, expose missing and ambiguous rules, ask focused question batches, and produce a hardened Digitable-ready ruleset draft with examples, edge cases, risks, and open questions.
compatibility: opencode
metadata:
  digitable-kind: rules-design
---

# Rules Explorer

Use this skill when the user provides a board game idea, partial ruleset, pasted rulebook draft, or asks for rules clarification. Do not rush into a complete ruleset when critical rules are missing.

## Operating Mode

Start friendly for rough ideas. Become stricter once the user has a real rules draft or asks for implementation.

Your job is to make the game playable by removing ambiguity:

- Extract what is already known.
- Identify what is vague, missing, contradictory, or risky.
- Ask concrete questions in batches of 8-12.
- Force operational answers that could be implemented or playtested.
- After enough answers, write a ruleset draft and list unresolved risks.

Limit yourself to at most 3 question rounds before producing a draft. If the user asks for a draft immediately, produce one but clearly mark assumptions.

## First Pass

Create a compact rules map:

- Theme and intended feel.
- Objective and end condition.
- Player count and playtime target.
- Components and zones.
- Setup.
- Turn or round structure.
- Always-available actions.
- Conditional actions.
- Resources and currencies.
- Hidden information.
- Conflict and interaction.
- Randomness.
- Scoring.
- Timing and effect resolution.
- Known edge cases.
- Missing rules.
- Dangerous balance assumptions.

## Question Batches

Ask questions across the highest-risk gaps first. Prefer concrete choices over open-ended prompts.

Cover these categories as needed:

- Game identity: player feeling, target audience, competitiveness, player count, length.
- Core loop: normal turn, recurring decision, optimization target, tension source.
- Objective: win condition, shared wins, player elimination, end trigger, scoring.
- Components: decks, hands, markets, boards, tokens, tracks, hidden information.
- Turn structure: order, phases, simultaneous play, reactions, start/end steps.
- Actions: available actions, action limits, repeats, costs, board/card/resource requirements.
- Resources: gain, spend, storage, trade, theft, loss, conversion, scarcity.
- Conflict: attacks, blocking, randomness, defense, targeting, kingmaking controls.
- Timing: simultaneous effects, interrupts, optional effects, active player priority, card overrides.
- Balance: comeback levers, runaway leader checks, dominant strategy risks.
- Teaching: first concept, example turn, first scenario, one-sentence pitch.

Bad answer: "Players can attack sometimes."

Good answer: "A player may attack once per turn after moving, targeting one adjacent enemy."

## Draft Output

When ready, produce:

```markdown
# Ruleset v0.1: <Game Name>

## Game Summary

## Players and Time

## Components

## Setup

## Objective

## Turn Structure

## Actions

## Cards, Effects, and Timing

## Conflict

## End of Game and Scoring

## Example Turn

## Edge Cases

## Open Questions

## Design Risks
```

Always include edge cases for empty decks, simultaneous effects, invalid targets, players unable to act, ties, and effects that conflict with core rules when those concepts exist.

## Handoff

Recommend `component-explorer` when the rules need alternate cards, resources, factions, scoring, or board structures. Recommend `game-starter` when the user wants the smallest playable Digitable prototype created.
