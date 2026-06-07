# Playtest Workflow Plan

## Summary

Turn playtests into versioned design snapshots with many playable sessions. A playtest owns the frozen project/SVG files, survey definition, lifecycle state, and session history. Each session is a separate room with its own URL, Colyseus lifecycle, notes, survey answers, and command replay.

## Key Changes

- Keep playtest snapshots immutable. Testing a new file or SVG version creates a new playtest. (probably done. Should allow continuing from this version. I need git)
- Add playtest states: `open`, `closed`, and `deleted`.
- Closing a playtest blocks new sessions but preserves old sessions, replay, notes, surveys, and imports.
- Deleting a playtest removes it from the designer workflow and invalidates public access in v1.
- A playtest should show each session as seperate info etc.
- A session closes when a participant ends it or when everybody disconnects after the reconnection window.
- Once closed, the Colyseus server blocks new joins, closes remaining connections, commits the session, and the session appears under the current playtest.

- Add a designer survey builder with text, rating, checkbox, and multiple-choice questions, including required flags.
- Require players to complete the survey at session end.
- Keep the rich notes panel available during active play so players can quickly record notes.
- Persist notes with session timestamps so they appear at the right points in replay/review.
- Record a server-side command timeline for each session.
- Build replay from the command timeline and overlay notes and survey events at matching timestamps.
- Creator review shows playtest snapshot info, committed sessions, player notes, survey answers, replay, reviewer labels, reviewer sentiment, and usefulness rating.
