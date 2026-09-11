# Architecture

ENCORE is a static site. There is no server, no build step and no framework. What
holds it together is a single rule: **the rules of the app do not touch the DOM,
and the views do not talk to each other.**

## The shape

```mermaid
flowchart TD
    subgraph data["data/ (JSON)"]
        M[moments.json]
        P[listening-sample.json]
    end

    subgraph core["src/core/ — pure, tested, no DOM"]
        V[validate.js]
        MO[moments.js]
        SH[share.js]
        YT[youtube.js]
        SM[soundmap.js]
        ST[storage.js]
        STATE[state.js]
    end

    subgraph ui["src/ui/ — views, unaware of each other"]
        MAP[mapView.js]
        FEED[feed.js]
        MD[momentDialog.js]
        PF[pinForm.js]
        SP[soundPanel.js]
        FIL[filters.js]
    end

    MAIN[main.js<br/>composition root]

    M --> MAIN
    P --> MAIN
    MAIN --> V
    MAIN --> STATE
    STATE -->|state changed| MAIN
    MAIN -->|filtered moments| MAP
    MAIN -->|ranked moments| FEED
    MAIN --> MD
    MAIN --> PF
    MAIN --> SP
    MAIN --> FIL
    MO -.-> MAIN
    SH -.-> MAIN
    ST -.-> MAIN
    YT -.-> MD
    SM -.-> SP
    LS[(localStorage)] <--> ST
```

Solid arrows are data moving. Dotted arrows are logic a caller reaches for.

## One render path

Every visible change follows the same path, which is why there is no way for the
map and the feed to disagree about what is on screen:

1. Something happens. A chip is clicked, a key is typed, a moment is pinned.
2. The handler patches the store: `state.set({ genre: "rock" })`.
3. The store notifies its subscriber, which is `render` in `main.js`.
4. `render` filters the moments once and hands the same list to the chips, the
   feed and the map.

Before this, filter state lived in three module level variables and every handler
had to remember to call three render functions. Missing one was the most common
bug in the app.

## The pipeline

The dataset is built, not typed. Everything under `scripts/ingest/` runs in CI on
a schedule and never in a browser.

```mermaid
flowchart LR
    MB[(MusicBrainz)]

    subgraph ingest["scripts/ingest — runs in CI"]
        HTTP[http.mjs<br/>one queue, 1 req/s<br/>retry, disk cache]
        P1[places<br/>id → coordinates]
        P2[genres<br/>artist → genre]
        P3[events<br/>concerts]
        N[normalize.mjs<br/>join + validate<br/>count the rejects]
        K[bundle.js<br/>pack columnar]
    end

    OUT[(data/performances.json)]
    APP[the browser]

    MB --> HTTP
    HTTP --> P1 & P2 & P3
    P1 --> N
    P2 --> N
    P3 --> N
    N --> K --> OUT --> APP
```

Three passes rather than one, because of how the API is shaped. The event search
returns concerts with a date, a performer and a venue, but no coordinates. The
place search returns coordinates. Events carry no genre at all, and a lookup per
artist would be tens of thousands of requests, so artists are enumerated by genre
tag instead and joined by id.

The rate limit is the design constraint. One request per second, roughly seventeen
hundred requests for a full sweep, which is half an hour at best. Three things
follow from that:

- **Every response is cached on disk**, so a failure at request 1,600 costs one
  request rather than all of them, and the weekly run in CI restores the cache
  before it starts.
- **Backoff is flat before it is exponential.** Sampling the endpoint at two
  different intervals produced the same refusal rate, which means congestion
  rather than punishment, and doubling the wait against a coin flip just wastes
  minutes.
- **Rejects are tallied by reason.** The run ends with how many records were
  dropped for having no performer, no date or a venue with no coordinates. A
  pipeline that silently loses half its input looks exactly like one that works.

## Where the moments come from

```
data/moments.json           curated, written by people, carries the stories
data/performances.json      ingested, packed, rebuilt weekly
  → fetch on boot
  → validateMoment() on every entry, invalid ones dropped and reported
  → merged with your own pins from localStorage
  → stored like counts folded in as deltas, so editing the seed file still shows through
  → the store
```

Like counts for seed moments are stored as a delta rather than an absolute. If
the seed file later says a moment has 3,000 hearts instead of 2,840, a visitor
who added one still sees 3,001 rather than a stale 2,841.

## Two untrusted inputs

Everything else in the app is data the repository controls. These two are not:

| Input | Who controls it | What guards it |
|---|---|---|
| The pin form | the visitor | `validateMoment` before the moment exists, `textContent` on the way to the page |
| A `#p=` share link | anyone who sends one | length ceiling, base64url decode in a `try`, `validateMoment`, identity and heart count assigned locally, never read from the link |

Both end up in the same validator, so the rules cannot drift apart. The content
security policy in `index.html` is the backstop: no inline script anywhere in the
app means a string that somehow became markup still cannot execute.

## Failure modes, and what happens

| What fails | What the visitor sees |
|---|---|
| Leaflet does not load | A message saying so, not a blank page |
| The cluster plugin does not load | Pins draw individually, unclustered |
| The basemap starts failing | The layer swaps to OpenStreetMap, darkened in the browser |
| Local storage is blocked | Everything works, nothing is saved |
| A stored value is unparseable | Treated as absent |
| A seed moment is malformed | Dropped, counted in a console warning, rest of the map renders |
| A share link is tampered with | Ignored, the map opens normally |
| A YouTube poster is missing | A gradient poster, which is also what a moment with no clip gets |

## Testing

`src/core/` is pure by construction, so it is tested directly on the Node test
runner with no framework, no DOM emulation and no mocking library. Where a module
needs something from the environment it takes it as an argument: `createStore`
takes a storage backend, `debounce` takes a scheduler. That is what lets a test
block storage or run a clock forward without touching globals.

`src/ui/` is not unit tested. It is thin by design, and the parts of it worth
testing were moved into `core` instead.
