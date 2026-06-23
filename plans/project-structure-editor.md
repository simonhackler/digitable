# Project Structure and Editor Plan

- Add a Digitable font feature:
  - use google fonts or whatever for all the font's.
  - make loaded fonts available in the SVG text font picker;
  - preserve `font-family` and Inkscape font metadata on import;
  - show missing imported fonts and let users map them to loaded system/browser fonts;
  - fall back to browser fonts when system font access is unavailable.
  - Fonts have to be loadable by other users.
