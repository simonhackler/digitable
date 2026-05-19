# Playtest Workflow Plan

## Summary

Turn playtests into a clearer host-led session flow with loading feedback, a lobby, timed active play, persistent notes, end-of-session survey, and readable creator review.

## Quick Fixes

- Add step status plus spinner when starting a playtest.
- Add step status plus spinner when opening a playtest invite.
- Start/open statuses should name the current phase, such as exporting, uploading, saving locally, importing locally, and joining room.

## Larger Features

- Change lifecycle to lobby -> active session -> survey.
- Host starts the active session from the lobby.
- Host ends the active session and sends players to survey.
- Track only session `startedAt`, session `endedAt`, and note/survey timestamps. Do not track lobby join time in v1.
- Make notes a persistent side panel during active play so players can type immediately.
- Carry any unsent note draft into the survey when the host ends the session.
- Survey submits final written feedback. Players do not set usefulness, sentiment, or labels in v1.
- Creator review screen supports reviewer-owned sentiment, usefulness rating, and custom feedback-type labels.
- Feedback labels are reviewer-defined, support multiple labels per feedback entry, and label the type of feedback.
- Playtest goals are saved as Markdown in the playtest folder. They do not need separate import behavior.
- Imported feedback becomes one Markdown file per player, ordered chronologically inside the file.
- Review screen focuses on readable text review: session timing, player feedback, reviewer labels, reviewer sentiment, and usefulness.

## Public Interfaces / Types

- Add playtest lifecycle state for lobby, active, ended/survey.
- Add `startedAt` and `endedAt` to playtest/session metadata.
- Store note and survey timestamps.
- Add review metadata for usefulness rating, reviewer sentiment, and custom multi-label feedback types.
- Adjust feedback import output to generate one Markdown file per player.

## Test Plan

- E2E: starting a playtest shows phase feedback and disables duplicate starts.
- E2E: opening an invite shows phase feedback while importing locally and joining the room.
- E2E: players land in lobby before host starts.
- E2E: host starts session and active Play surface opens for players.
- E2E: persistent note panel remains available during active play.
- E2E: host ends session and players are routed to survey.
- E2E: unsent note draft appears in the survey.
- Unit/integration: session stores `startedAt`, `endedAt`, and submitted feedback timestamps.
- Unit/import: feedback import creates one chronological Markdown file per player.

## Assumptions

- Player-authored sentiment and player-authored labels are out of scope.
- Command replay UI is handled by the Play surface command history plan, not this first review screen.
- Goals Markdown is saved with the playtest folder and does not need to be imported into normal project feedback files.
