---
name: create-game
description: Create a new Digitable game folder and game.json by gathering the required game metadata conversationally, validating it against the bundled schema, and writing the result into the top-level project directory.
compatibility: opencode
metadata:
  digitable-kind: game-creation
---

# Create Game

Use this skill when the user wants to create a new Digitable game project.

This is not the main entry point for vague or early-stage game ideas.
Use `game-starter` first when the user is still discovering the fantasy, mechanics, scope, or component structure.
Use `create-game` once the required metadata is known or when the user explicitly wants to scaffold the folder and `game.json` now.

## Workflow

1. Read the schema at `references/create-game-schema.json`.
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

Use `game-starter` before creation when the game idea is still taking shape, and after creation if the user wants to continue toward a first playable prototype. Use `rules-explorer` if the user already has rules that need hardening.
