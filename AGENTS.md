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

- `bun dev` - Start both app and game server
- `bun dev:app` - Start SvelteKit app only
- `bun dev:server` - Start game server only
- `bun build` - Build app for production
- `bun test` - Run e2e tests (Playwright)
- `bun test:e2e` - Run specific e2e test
- `bun lint` - Check prettier and ESLint
- `bun format` - Format with prettier
- `bun check` - TypeScript and Svelte check
- `bun storybook` - Run Storybook dev server

## Key Technologies

- **Frontend**: SvelteKit with Svelte 5, TypeScript, Tailwind CSS
- **Backend**: Colyseus game server with TypeScript
- **Testing**: Playwright for e2e, Vitest + Storybook for components
- **Package Manager**: Bun (always use bun, not npm)

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:
ALWAYS use tailwindcss when possible. Prefer xs sm md lg xl over explicit sizes.

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
