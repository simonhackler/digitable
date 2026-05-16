# AGENTS.md

Essential information for AI coding agents working in this SVG Table monorepo.
This project is a boardgame design and testing tool

## Monorepo Structure

- **Root**: Main package.json with workspace configuration
- **packages/app/**: SvelteKit application (main frontend)
- **packages/game-server/**: Colyseus game server
- **packages/studio/**: Homepage, blog, overview
- **projects/**: Game project files and assets

## Build/Test Commands (use bun)

`devenv up` runs the development environment. Usually this is already running.
`devenv shell --quiet` to run commands
`bun playwright test` for playwright. Playwright is installed via devenv

### Playwright Checks

- Use the repo runner inside devenv: `devenv shell -- bun run playwright test <spec-or-grep>`.
- If checking a page on an already-running dev server, set the base URL on the same command, for example: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5179 devenv shell -- bun run playwright test e2e/example.test.ts`.
- Do not run `npx playwright install`, `playwright install`, or other browser install commands. The devenv Playwright setup provides the browser path used by `bun run playwright test`.
- Do not use ad hoc `node -e` scripts that import Playwright for validation. Add or reuse a focused Playwright spec, run it with `bun run playwright test`, and remove temporary specs before finishing.
- For visual or viewport checks, prefer assertions such as `toBeVisible()` and `toBeInViewport()` in a focused Playwright test. Capture screenshots through the test runner only when they help diagnose a failure.

## Code style

Use defensive coding. E.g use assert: import { assert } from '$lib/utils/assert';
Write code in a functional style. That means return new object and make sure functions recieve everything they use as input parameters.

## Key Technologies

- **Frontend**: SvelteKit with Svelte 5, TypeScript, Tailwind CSS
- **Backend**: Colyseus game server with TypeScript
- **Testing**: Playwright for e2e, Vitest + Storybook for components
- **Package Manager**: Bun (always use bun, not npm)

## Svelte Notes

- `packages/studio` has Svelte's `compilerOptions.experimental.async` enabled. Top-level `await` in components and `await` inside `$derived(...)` are expected to compile there.

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:
ALWAYS use tailwindcss when possible. Prefer xs sm md lg xl over explicit sizes.

When writing tests ALWAYS read `instructions/testing.md` first.
When writing e2e tests, NEVER mock app routes, network requests, browser APIs, databases, or backend services. E2E tests must exercise the real integrated flow.

## Bug fixing

When fixing bugs always implement the simplest most straightforward fix and test it with an e2e test.

## Available MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
Only run this tool on larger svelte code changes. You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
