---
name: game-metadata-scaffold
description: Narrow file-writing skill for creating only a Digitable game folder and game.json after the user explicitly asks to scaffold project metadata or after new-game-discovery has established the title, player count, component scope, and prototype direction.
compatibility: opencode
metadata:
  digitable-kind: game-creation
---

# Game Metadata Scaffold

Use this skill only when the user wants to scaffold a new Digitable game project folder and `game.json`.

This is not the main entry point for vague or early-stage game ideas.
Use `new-game-discovery` first when the user says they want to make, start, create, design, or prototype a new game and they are still discovering the fantasy, mechanics, scope, component structure, or first playable loop.
Use `game-metadata-scaffold` once the required metadata is known or when the user explicitly wants to scaffold the folder and `game.json` now.

If the user says "I want to create a new game" and describes an idea, theme, genre, mechanism, target experience, or component concept, do not use this skill first. Hand off to `new-game-discovery`.

## Workflow

1. Read the schema at `references/game-metadata-schema.json`.
2. Ask the user for any missing required fields in a conversational way.
3. Normalize the folder name by converting whitespace to underscores.
4. Create a new top-level folder for the game.
5. Write `game.json` into that folder.
6. Ensure the JSON matches the schema exactly.

## Rules

- Do not invent required metadata when the user can answer it.
- Keep optional fields empty or omitted according to the schema.
- If the target folder already exists, ask before overwriting or adding files.
- The output `game.json` must be valid JSON, not Markdown.

## Handoff

Use `new-game-discovery` before scaffolding when the game idea is still taking shape, and after scaffolding if the user wants to continue toward a first playable prototype. Use `rules-explorer` if the user already has rules that need hardening.
