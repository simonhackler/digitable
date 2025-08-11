# AGENTS.md

This file contains essential information for AI coding agents working in this repository.

## Code Style Guidelines

- Svelte 5 with runes (`$state`, `$derived`, `$props`, `$bindable`)
- Use `$lib/` imports for internal modules
- Use Tailwind CSS
- Use Top Level await, which is supported now in svelte 5

## IMPORTANT
- Try to keep things in one function unless composable or reusable
- DO NOT do unnecessary destructuring of variables
- DO NOT use else statements unless necessary
- DO NOT use try/catch if it can be avoided
- AVOID try/catch where possible
- AVOID else statements
- AVOID using any type
- AVOID let statements
- PREFER single word variable names where possible

## Component Guidelines

- Before creating new components, check `@ieedan/shadcn-svelte-extras` with jsrepo
- Use the pinned version from jsrepo.json when fetching external components
- Components should use TypeScript and proper type definitions
- Use the `cn()` utility for className merging
- Follow the existing component structure with module and instance scripts
