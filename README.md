# ◉ ENCORE

**A world map where every pin is a live performance.** The shows you were at, the
ones that meant something, and the ones you missed but can still relive through
fan footage.

> Google Maps shows you *places*. ENCORE shows you the *moments* that happened there.

**[Open the live map](https://andreaisabelmontana.github.io/encore-live-music-map/)**

[![CI](https://github.com/andreaisabelmontana/encore-live-music-map/actions/workflows/ci.yml/badge.svg)](https://github.com/andreaisabelmontana/encore-live-music-map/actions/workflows/ci.yml)
[![Deploy](https://github.com/andreaisabelmontana/encore-live-music-map/actions/workflows/pages.yml/badge.svg)](https://github.com/andreaisabelmontana/encore-live-music-map/actions/workflows/pages.yml)
![Node](https://img.shields.io/badge/node-%E2%89%A520-informational)
![Dependencies](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

![The map, with the feed of recently pinned moments](docs/screenshots/map.png)

---

## What you can do

- **Explore a dark world map** of live music moments. Nearby pins cluster as you
  zoom out.
- **Open a moment** to see the performance and the story of why it mattered.
- **Search and filter** by artist, city, venue or genre. Search ignores accents,
  so `rosalia` finds Rosalía.
- **Pin your own moment.** Click the map to set the place, paste a YouTube link,
  write what happened. Your pins and hearts survive a reload.
- **Share any moment.** Seed moments share by id. A moment you pinned encodes
  itself into the link, so the person you send it to opens your exact pin with no
  account, no database and no server.
- **Map your listening.** Connect a listening profile and every artist you play
  appears at the city their sound came from, with a panel that graphs the
  geography of your taste.

| | |
|---|---|
| ![A moment open, with its story and the route to fan footage](docs/screenshots/moment.png) | ![The sound map, artists placed at their city of origin](docs/screenshots/soundmap.png) |

## How it is built

The app is plain ES modules with no bundler, no framework and no runtime
dependency beyond Leaflet, which the page loads from a CDN. It is split so that
the rules of the app can be tested without a browser.

```
src/
  main.js          composition root, the only file that wires views together
  core/            pure logic, no DOM, 100% of the unit tests
    moments.js     filtering, accent insensitive search, ranking, distance
    share.js       pack a moment into a link, unpack it safely
    validate.js    one validator, used by the seed data and by shared links
    youtube.js     read an id out of any YouTube link shape, build embed URLs
    soundmap.js    aggregates over a listening profile
    storage.js     local storage that cannot throw
    state.js       a small observable store, plus debounce
    format.js      escaping and display formatting
  ui/              views, each one unaware of the others
    mapView.js     tiles, pins, clustering, and their fallbacks
    feed.js        the keyboard reachable list of every moment on the map
    momentDialog.js, pinForm.js, soundPanel.js, filters.js, splash.js
    dialog.js      focus trap, Escape, focus restore, shared by all three overlays
    thumbnail.js   posters that always render
    motion.js      one place that honours prefers-reduced-motion
data/              seed moments and the sample listening profile, as JSON
test/              69 unit tests on the Node test runner
```

State lives in one observable store. A handler describes a change, subscribers
redraw. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data flow, and
[docs/DECISIONS.md](docs/DECISIONS.md) for why the map has no API key, why the
video is embedded rather than hosted, and why there is no build step.

## Engineering notes

If you are reviewing the code, these are the parts worth a look.

- **Tested rules.** Every decision the app makes lives in `src/core/` and is
  covered by 69 tests that run in under a second on the Node test runner, with no
  test framework installed. `test/share.test.js` is the interesting one.
- **Types without a build.** JSDoc annotations checked by `tsc --checkJs` in
  strict mode. Full type coverage, zero compile step, source that ships as it is
  written. The Leaflet global is typed through `types/globals.d.ts`.
- **Two untrusted inputs, handled as such.** The pin form and the share link
  payload both pass through the same validator before anything renders, no
  dynamic text reaches the page as markup, and the page ships a content security
  policy with no inline script. The CDN tags carry subresource integrity hashes.
- **Everything degrades.** If the cluster plugin does not load, pins still draw.
  If the basemap starts failing, the map falls back to OpenStreetMap darkened in
  the browser. If local storage is blocked, the app runs with nothing saved. If a
  seed moment is malformed, it is dropped and reported rather than rendered.
- **Accessible on purpose.** The map is not keyboard reachable by nature, so
  every moment on it is also a button in the feed, reached by a skip link. All
  three overlays trap focus, close on Escape and return focus where it came from.
  Animation honours `prefers-reduced-motion`, and result counts are announced in
  a live region.
- **Measured performance choices.** Search is debounced before it redraws the
  pin layer, posters load lazily, and the tile provider is preconnected.

## Run it locally

Needs Node 20 or newer. The app has no runtime dependencies; the dev tooling is
the only thing `npm install` fetches.

```bash
npm install
npm start
```

Then open `http://localhost:8080`. The server is forty lines of `node:http` in
`scripts/serve.mjs`, because ES modules do not load over `file://` and that did
not seem worth a dependency.

## Checks

```bash
npm run check
```

Runs ESLint, the type checker, the seed data validator and the test suite. The
same four run in CI on Node 20 and 22, and again before anything deploys to
GitHub Pages.

```bash
npm test            # unit tests
npm run coverage    # unit tests with coverage
npm run lint
npm run typecheck
npm run validate:data
```

## The data

`data/moments.json` holds the seed moments, shaped the way a live API would
return them: one performance, one venue, one point on the earth. Every entry is
validated in CI against the same rules a shared link has to satisfy.

Seed moments carry `videoId: null` deliberately. A guessed YouTube id resolves to
the wrong performance, so instead of pretending, each seed moment offers a search
for fan footage of that exact artist, venue and year. Paste a real link through
the pin form and it embeds inline.

## What a real backend would change

Less than it looks. The app renders from a plain array of moment objects, and two
functions in `main.js` are the entire seam:

- `loadMoments()` reads a JSON file today. Point it at a small serverless proxy
  holding a Setlist.fm key for past setlists and venue geography, plus the
  YouTube Data API for clip lookup, and everything above it is unchanged.
- `loadListeningProfile()` reads a sample profile today. A real one needs Spotify
  OAuth for top artists and MusicBrainz for where each artist is from, because
  Spotify exposes the artist but not the origin.

Neither belongs in a static site: a page served from GitHub Pages has nowhere
safe to keep an API key.

## Roadmap

- [x] Clustering, shareable links, persistent pins, a keyboard path through the app
- [ ] Live ingest through a serverless proxy
- [ ] Real listening profiles rather than the sample
- [ ] Artist view: every show as a timeline and a touring map
- [ ] Collections, so a set of moments can be saved and shared as one
- [ ] A heat map of the most relived venues
- [ ] Beyond music: festivals, sport, protest, any moment tied to a place

## License

MIT. See [LICENSE](LICENSE).

Seed stories and heart counts are illustrative. Video is embedded from YouTube
and never re-hosted. Basemap tiles come from Esri and OpenStreetMap contributors.
