# Contributing

## Getting set up

```bash
npm install
npm start        # http://localhost:8080
```

Node 20 or newer. The app itself has no runtime dependencies; `npm install` only
fetches the dev tooling.

## Before you push

```bash
npm run check
```

That is ESLint, the type checker, the seed data validator and the tests, which is
the same gate CI runs on Node 20 and 22, and the same gate a deploy has to pass.

## Where code goes

- **`src/core/`** for anything that decides something: filtering, validation,
  link packing, aggregation. No DOM access, no module level state, no globals.
  Whatever a module needs from the environment, it takes as an argument. Every
  function here gets a test.
- **`src/ui/`** for anything that renders. Views do not import each other; they
  are wired together in `src/main.js`.
- **`data/`** for content. It is validated in CI, so a malformed entry fails the
  build rather than the page.

If you find yourself wanting to test something in `ui/`, that is usually a sign
the logic belongs in `core/`.

## House rules

- Dynamic text reaches the page through `textContent` or through `escapeHtml`.
  Never build markup out of a visitor's input.
- No inline event handlers or inline script. The content security policy in
  `index.html` forbids them, and that is deliberate.
- New CDN tags need an integrity hash and a pinned version.
- Anything that moves checks `prefersReducedMotion()` first.
- New interactive elements are real buttons, reachable by Tab, with a visible
  focus style.

## Adding a moment to the seed data

Add an entry to `data/moments.json` with a unique id, coordinates for the venue,
a genre from the list in `src/core/validate.js`, and `videoId: null`. Then run
`npm run validate:data`.

Leave `videoId` null. A guessed YouTube id points at the wrong performance, and a
test enforces it.
