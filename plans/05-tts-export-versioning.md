# TTS Export Versioning

## Goal

Make Tabletop Simulator exports traceable by saving each export into a timestamped folder and showing users where the files were written.

## User Stories

- As a designer, I can run TTS export multiple times without overwriting previous exports.
- As a designer, after export finishes I can see the exact folder path where sheets and JSON were saved.
- As a designer, generated JSON references the sheet files from the same export run.

## Proposed Behavior

- Each export writes to `tts-export/YYYY-MM-DD_HH-mm-ss/`.
- The timestamp folder contains all generated sheet PNGs and the TTS JSON file for that run.
- The completion message includes the export folder path.
- Older timestamped exports are left untouched.
- Generated TTS JSON uses paths that match the timestamped output.

## Implementation Notes

- Update the TTS export page and sheet writer to share one export-run path.
- Generate the timestamp once per export run and reuse it for all output files.
- Keep filenames inside the timestamp folder readable and close to the current names.
- Avoid hardcoding unrelated absolute paths where possible; the displayed path should match the project-relative save location available in the browser filesystem.
- Preserve current export progress behavior.

## Acceptance Criteria

- Running export creates a new timestamped folder under `tts-export`.
- Running export twice creates two distinct folders.
- Export completion displays the saved folder path.
- JSON and sheet files are stored together in the same timestamp folder.
- Existing e2e export assertions are updated to check timestamped output.

## Tests

- Update TTS e2e tests to find the timestamped export folder.
- Assert that required PNG sheets and JSON exist inside the same folder.
- Add a repeated-export test that confirms older output is not overwritten.
- Assert that the success UI includes the saved destination.

## Open Questions

- Should there also be a `latest` pointer or folder later for convenience, or is timestamp history enough for now?
