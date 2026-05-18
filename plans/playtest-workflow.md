# Playtest Workflow Plan

## Summary

Turn playtests into versioned design snapshots with many playable sessions. A playtest owns the frozen project/SVG files, survey definition, lifecycle state, and session history. Each session is a separate room with its own URL, Colyseus lifecycle, notes, survey answers, and command replay.

## Key Changes

- Store immutable SHA-256 hashes when creating a playtest: per uploaded file, aggregate project hash, and aggregate playable SVG/data hash.
- Keep playtest snapshots immutable. Testing a new file or SVG version creates a new playtest.
- Add playtest states: `open`, `closed`, and `deleted`.
- Closing a playtest blocks new sessions but preserves old sessions, replay, notes, surveys, and imports.
- Deleting a playtest removes it from the designer workflow and invalidates public access in v1.
- Change `/playtests/:playtestId` into a public playtest lobby that lists open rooms.
- Let anonymous playtesters create a room or join an existing open room from the playtest lobby.
- Add `/playtests/:playtestId/sessions/:sessionId` as the direct session URL.
- Sessions start in a lobby. Any participant can start play, so sessions work without the designer present.
- A session closes when a participant ends it or when everybody disconnects after the reconnection window.
- Once closed, the Colyseus server blocks new joins, closes remaining connections, commits the session, and the session appears under the current playtest.
- Add lightweight anonymous playtester identities for users who join through a playtest link.
- Store anonymous participant identity with a playtest cookie and use it for room membership, notes, survey answers, and replay attribution.
- Add a designer survey builder with text, rating, checkbox, and multiple-choice questions, including required flags.
- Require players to complete the survey at session end.
- Keep the rich notes panel available during active play so players can quickly record notes.
- Persist notes with session timestamps so they appear at the right points in replay/review.
- Record a server-side command timeline for each session.
- Build replay from the command timeline and overlay notes and survey events at matching timestamps.
- Creator review shows playtest snapshot info, committed sessions, player notes, survey answers, replay, reviewer labels, reviewer sentiment, and usefulness rating.

## Public Interfaces / Types

- Extend playtest metadata with `status`, `closedAt`, `deletedAt`, `snapshotHash`, `playableHash`, and file manifest entries containing `path`, `size`, `contentType`, and `sha256`.
- Add session metadata with `sessionId`, `playtestId`, `privateRoomId`, `status`, `createdAt`, `startedAt`, `endedAt`, `committedAt`, participants, and connection summary.
- Add session APIs for listing open sessions, creating a session, joining a session, starting play, ending play, submitting notes, submitting survey answers, and reading committed replay/review data.
- Update Colyseus private rooms so session close blocks new joins, disconnects active clients, and commits only after no clients remain.
- Update feedback import to group feedback by playtest session and preserve chronological notes, survey answers, replay references, and reviewer metadata.

## Test Plan

- E2E: creating a playtest stores immutable file/SVG hashes and shows snapshot information on the designer screen.
- E2E: closed playtests reject new session creation but still show prior committed sessions.
- E2E: deleted playtests disappear from the designer list and public links no longer open.
- E2E: anonymous player opens a playtest link, creates or joins an open room, enters lobby, starts play, writes rich notes, ends or is routed to survey, and submits required answers.
- E2E: session closes when all participants disconnect after the reconnection window.
- E2E: ending a session closes Colyseus connections and the committed session appears under the playtest.
- Integration: session commit persists command timeline, note timestamps, survey answers, participant attribution, and connection end state.
- Unit/import: feedback import creates chronological review artifacts grouped by session and player.

## Assumptions

- Playtest snapshots are immutable.
- Sessions can work without the designer present.
- V1 replay is command replay, not browser video or screen recording.
- Anonymous playtester identity is scoped to playtesting and does not require normal sign-up.
- Hard deletion of S3 objects and historical session artifacts is deferred unless explicitly required later.
