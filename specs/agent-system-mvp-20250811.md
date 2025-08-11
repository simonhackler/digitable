# Agent System MVP Specification

## Description

An AI-powered game development assistant system that auto-generates command definitions and JSON schemas to help game creators through brainstorming and setup processes. The system runs alongside the existing game creation flow and provides structured command files that external applications can consume to guide users through game development workflows.

The MVP focuses on establishing the core file generation infrastructure using the existing `createGameSchema` as the foundation for a single game creation command.

## Scope

### In Scope

- Auto-generation of `.opencode/commands/` folder structure on application startup
- Creation of `create-game.md` command definition file
- Generation of `create-game-schema.json` using existing `createGameSchema` from Zod
- File placement: JSON schema files alongside corresponding command markdown files
- Integration with existing file system structure
- Support for external application consumption of generated files

### Out of Scope

- User interface components for the agent system
- Multiple command types (only createGame for MVP)
- Migration system for file updates (planned for future)
- Integration with existing game creation UI
- Command execution logic
- Validation of generated files
- User authentication or permissions
- Real-time file watching or updates

## Open Questions

None - specification is complete for MVP implementation.
