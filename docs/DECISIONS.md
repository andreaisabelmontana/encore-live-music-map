# Decisions

Short records of the choices that shaped this app, kept so that the reasoning
outlives the memory of making it. Each one names the constraint first, because
the constraint is the interesting part.

---

## 1. The map has no API key

**Constraint.** The site is served from GitHub Pages. A page served from a static
host has nowhere to keep a secret: anything the browser can read, a visitor can
read.

**Choice.** A basemap that serves anonymous traffic. Esri's dark canvas over
OpenStreetMap data, keyless, dark, and light enough on labels that pins stay
readable.

**Consequences.** No key management, no billing surprise, no proxy to maintain.
The cost is that the app depends on a provider it does not pay, which is why the
tile layer counts failures and falls back to OpenStreetMap after six of them.

**What changed.** This started on CARTO's dark basemap for the same reason.
CARTO began watermarking unregistered tiles with "API KEY REQUIRED", which is
exactly the failure this fallback exists for.

---

## 2. Video is embedded, never hosted

**Constraint.** The best feature of the app is watching a show you could not get
to. The footage belongs to the people who filmed it and the artists who performed
it.

**Choice.** Embed YouTube through `youtube-nocookie.com`. The file never leaves
YouTube, the uploader keeps their view count, and ENCORE stores an eleven
character id.

**Consequences.** Zero hosting cost, zero copyright exposure, and a feature that
can ship. The cost is that a deleted video takes its moment's clip with it, which
is why a missing clip degrades to a poster rather than an error.

---

## 3. Seed moments ship without clip ids

**Constraint.** Twelve famous performances, and no reliable way to find the one
correct clip for each without an API key.

**Choice.** Ship `videoId: null` and send the visitor to a YouTube search for
that exact artist, venue and year.

**Consequences.** The app never shows a video and claims it is a different night.
A guessed id would have demoed better and lied. A test enforces this, so a later
edit cannot quietly reintroduce hard coded ids.

---

## 4. Shared moments travel inside the link

**Constraint.** Sharing usually means a database. There is no database, and
adding one would turn a static site into a service with accounts, moderation and
a bill.

**Choice.** A seed moment shares as `#m=<id>`, because both people already have
the seed data. A moment a visitor pinned exists only in their browser, so the
link carries the moment itself: compact JSON, UTF-8, base64url, in the fragment.

**Consequences.** Sharing works with no backend at all, and the fragment never
reaches a server, so the content of a private moment stays between the two
people. The costs are a link of roughly 250 characters, a practical size ceiling,
and a payload anyone can edit, which is why the decoder validates everything and
assigns identity and heart count locally instead of trusting the link.

---

## 5. ES modules and JSDoc types, not TypeScript and a bundler

**Constraint.** The app is a few thousand lines of browser code deployed to a
static host. It should be readable in the browser's own sources panel, and it
should not rot because a build tool moved on.

**Choice.** Native ES modules, typed with JSDoc and checked by `tsc --checkJs` in
strict mode.

**Consequences.** Full type checking in CI, no compile step, and what runs in the
browser is exactly what is in the repository. The cost is annotation syntax that
is wordier than TypeScript, and that ES modules need a server even in
development, which `scripts/serve.mjs` provides in forty lines of standard
library.

---

## 6. Tests on the Node test runner, with no test framework

**Constraint.** A small project with test dependencies tends to end up with a
test suite that cannot run two years later.

**Choice.** `node:test` and `node:assert`, which ship with the runtime. Pure
logic lives in `src/core/`, so nothing needs a DOM.

**Consequences.** 69 tests, under a second, zero test dependencies, and a suite
that will still run on any Node 20 or newer. The cost is no browser level
testing, which the design compensates for by keeping the view layer thin.

---

## 7. The feed is the accessible path, not a decoration

**Constraint.** A Leaflet marker is a positioned div on a tile canvas. Keyboard
and screen reader users cannot meaningfully navigate a world map of them.

**Choice.** Every moment on the map is also a real button in the feed, the first
Tab stop on the page is a skip link to that feed, and result counts are announced
in a live region.

**Consequences.** The app is usable without a mouse, and the feature that makes
it usable is one people with a mouse also enjoy. No separate accessible version
to keep in sync.

---

## 8. Local storage, deltas, and never throwing

**Constraint.** Pins and hearts should survive a reload without an account.
Storage refuses to work more often than it is given credit for: private browsing,
blocked site data, a full quota.

**Choice.** A wrapper that probes with a real write, falls back to memory when
refused, and returns the caller's fallback on any failure. Hearts on seed moments
are stored as deltas rather than absolutes.

**Consequences.** Nothing leaves the browser, nothing can throw at a call site,
and editing the seed data does not strand a visitor on a stale count. The cost is
that pins live on one device only, which is the honest trade for having no
accounts.
