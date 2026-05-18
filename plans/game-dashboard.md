# Game Dashboard Plan

## Summary

Redesign the game main screen into a compact work dashboard that shows completeness and activity signals, then links users into the right existing workflows.

## Larger Features

- Replace the current game landing emphasis with a compact dashboard.
- Show completeness signals:
  - rules presence;
  - component/deck count;
  - asset status;
  - playable setup status;
  - export availability.
- Show activity signals:
  - running playtests;
  - feedback needing review;
  - recent playtest/session state when available.
- Highlight the primary next action based on missing or active work.
- Link each dashboard item to the relevant existing workflow page.
- Keep the dashboard dense and scannable, suitable for repeated project work.
- Do not add persistent checklist state in v1.
- Do not add inline creation/editing widgets in v1; actions navigate to existing workflows.

## Public Interfaces / Types

- Add a dashboard summary model derived from existing project files and playtest metadata.
- Derive completion/activity states from rules, components/decks, assets, exports, running playtests, and feedback review status.
- No new persistent dashboard state is required.

## Test Plan

- Component test: dashboard shows rules missing/present state.
- Component test: dashboard shows deck/component count.
- Component test: dashboard shows running playtest and feedback review states when metadata exists.
- E2E: primary actions navigate to rules, decks/components, play, playtests, feedback review, and exports.
- Responsive check: dashboard remains compact and readable on mobile and desktop.

## Assumptions

- Dashboard is a navigation and status surface only.
- Workflow-specific editing stays on existing pages.
- Completeness signals can be derived from current files and metadata without adding saved checklist state.
