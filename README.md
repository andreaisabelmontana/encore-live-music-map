# ◉ ENCORE — the map of live music memory

**Bandsintown × Google Maps × Pinterest.** A world map where every pin is a live
performance — the shows you were at, the ones that meant something, and the ones
you missed but can still relive through fan-recorded clips.

> Google Maps shows you *places*. ENCORE shows you the *moments* that happened there.

This is a working front-end prototype.

---

## ✦ What it does

- **Explore a dark, vector world map** of live-music moments (Leaflet + CARTO tiles — no API key).
- **Tap a pin** to open a moment: an embedded performance video + the story of *why it mattered*.
- **Browse the feed** — a Pinterest-style rail of recently-pinned moments, sorted by love.
  On mobile it's a toggleable bottom sheet.
- **Filter by genre**, search by artist / city / venue. Nearby pins **cluster** at low zoom.
- **Pin your own moment** — click the map to drop a location, paste a YouTube link
  (we **embed**, never re-host), and add the story. Your pins and loves **persist**
  across reloads (localStorage — nothing leaves your browser).
- **Share any moment** — every moment has a link. Your own pins encode themselves
  *into* the URL (base64), so a friend opens the exact pin with no backend at all.
  Shared links skip the intro and land straight on the moment.
- **Cassette → stage intro** splash to set the mood.

## 🟢 Connect Spotify — your Sound Map

Tap **connect spotify** to map your most-streamed artists by *where their sound
comes from*. Green origin pins glow across the world (sized by minutes streamed),
and a panel graphs the geography of your taste: top artists, countries, hours
streamed, dominant genre, and "your sound lives mostly in ___."

> Prototype note: real login needs Spotify OAuth + a serverless proxy, and the
> artist→hometown mapping comes from MusicBrainz (Spotify's API gives your top
> artists but not their origin). The demo loads a sample profile from `spotify.js`
> and is structured for that real pipeline to drop in.

## 🎬 The intro

Two looping clips power the splash screen (`assets/cassette.webp`, `assets/stage.webp`),
compressed from source GIFs (~200 MB → ~1 MB each) into web-native animated WebP.

## ▶ Video: embed, never scrape

The hero feature — "watch a show you couldn't go to" — works by **embedding**
existing YouTube clips (YouTube hosts the video; we point at it). We never
download or re-host footage. That keeps the platform clean of copyright liability
while still surfacing the moment.

Seed moments ship with `youtubeId: null` on purpose, so each shows a
"watch fan clips on YouTube" poster that searches the correct `artist + venue + year`.
Paste a real link via **pin a moment** and it embeds inline.

## 🧱 Stack

| Layer | Choice | Why |
|---|---|---|
| Map | Leaflet + CARTO dark tiles | No key, free on GitHub Pages, on-aesthetic |
| Data | `data.js` seed (Setlist.fm-shaped) | Models a real past-shows + venue-geo API |
| Video | YouTube `nocookie` iframe embed | Legal, zero hosting cost |
| UI | Vanilla HTML/CSS/JS | Zero build step — just static files |

## 🚀 Run it

It's static — no build:

```bash
# any static server, e.g.
python -m http.server 8080
# then open http://localhost:8080
```

Or just open `index.html`.

### Deploy to GitHub Pages
Push to a repo → **Settings → Pages → Deploy from branch → `main` / root**.

## 🔌 Wiring a live API (next step)

A pure GitHub Pages site can't hold a secret API key safely. To pull real shows
automatically instead of seeding `data.js`:

1. Add a tiny serverless proxy (Cloudflare Worker / Vercel function, ~20 lines)
   that holds the key and calls **Setlist.fm** (past setlists + venue geo) and the
   **YouTube Data API** (clip search per show).
2. Replace the `MOMENTS` constant with a `fetch()` to that proxy.

The UI already renders from a plain array of moment objects, so this is a drop-in.

## 🗺️ Roadmap

- [ ] Live API ingest (Setlist.fm + YouTube) via serverless proxy
- [ ] Real Spotify OAuth + MusicBrainz origins (replace `spotify.js` sample)
- [ ] Artist view: every show of an artist as a timeline + touring map + follow
- [ ] User accounts + "boards" (Pinterest-style collections)
- [ ] Gig-poster card aesthetic (duotone cut-outs, warped display type, sticker accents)
- [x] Cluster pins at low zoom · shareable moment links · persistent pins
- [ ] Heatmap of "most-relived" venues
- [ ] Extend beyond music: festivals, sports, protests — any moment tied to a place

---

*Prototype. Seed data is illustrative; stories and like counts are placeholders.*
