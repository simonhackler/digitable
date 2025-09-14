# AGENTS.md
Essential information for AI coding agents working in this SVG Table monorepo.
This project is a boardgame design and testing tool

## Monorepo Structure
- **Root**: Main package.json with workspace configuration
- **packages/app/**: SvelteKit application (main frontend)
- **packages/game-server/**: Colyseus game server
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

