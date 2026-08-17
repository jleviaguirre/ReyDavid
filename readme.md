This website https://jleviaguirre.github.io/ReyDavid/#home is hosted in github and many micro sites are stored as cells under this sheet. The pages are driven by google sheets (https://docs.google.com/spreadsheets/d/1SEC-hAwijkrqUOylStPNPC7dUYGTDyzCwZWxb4roQlI/edit?gid=1343595893#gid=1343595893). It is a PWA and also uses appscripts. See appscripts/code.js file

## Repository structure

This repo is synced with https://github.com/jleviaguirre/ReyDavid.git and contains both the published site and non-public source:

- `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.json`, `conferencia.html`, images, `favicon/` — the live static site served by GitHub Pages.
- `App-scripts/code.gs` — the Google Apps Script backend (deployed separately via the Apps Script editor, not run from GitHub Pages). Kept here only for version control/backup.
- `App-scripts/modules/` — micro-module source files that mirror what should be pasted into the `_SETTINGS` sheet (`category = page`, `name = <page key>`, `value = <html>`). Google Sheets is the actual runtime source; files here are just the versioned copy.
- `_config.yml` — tells GitHub Pages' Jekyll build to skip `App-scripts/` and `readme.md` so they stay in the repo (for backup/version control) but are never served at the live site URL.

## Micro-modules

Each micro-module is a self-contained HTML fragment (no `<html>`/`<head>`/`<body>` tags, since it's injected into `#dynamic-module-content` by `app.js`'s `renderDynamicModule()`). It can use the global `SCRIPT_URL` constant already defined by `app.js` and the logged-in user stored in `localStorage.rey_david_user`.

### Check-in (`App-scripts/modules/checkin.html`)

Self-service RSVP/check-in for the most recent `monthly_meetings` event, backed entirely by existing endpoints (`getEvents`, `getAttendance`, `updateAttendance` — no new Apps Script code required):

1. Fetches all events and picks the most recent one that has already started (falls back to the next upcoming one if all events are in the future).
2. Loads that event's attendance stats and the current user's RSVP status via `getAttendance`.
3. Lets the user confirm/update their attendance (going, guests, comments) via `updateAttendance`.
4. Lists everyone currently confirmed as going.

To publish it, copy the contents of `App-scripts/modules/checkin.html` into a new row in `_SETTINGS`: `category = page`, `name = checkin`, `value = <paste file contents>`, `public = FALSE` (requires login).