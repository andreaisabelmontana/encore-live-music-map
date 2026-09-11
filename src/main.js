/**
 * Composition root.
 *
 * Everything below is wiring: load the data, build the state, hand each view the
 * one thing it needs. The rules of the app live in `core/`, which knows nothing
 * about the DOM and is unit tested; the views in `ui/` know nothing about each
 * other and talk only through this file.
 *
 * @module main
 */

import { createAppState } from "./core/state.js";
import { createStore } from "./core/storage.js";
import { applyLikeBumps, filterMoments, sortByLove } from "./core/moments.js";
import { isValidMoment } from "./core/validate.js";
import { decodeMoment, parseHash, shareUrlFor } from "./core/share.js";
import { createMapView } from "./ui/mapView.js";
import { createFeed } from "./ui/feed.js";
import { createGenreChips, createSearch } from "./ui/filters.js";
import { createMomentDialog } from "./ui/momentDialog.js";
import { createPinForm } from "./ui/pinForm.js";
import { createSoundPanel } from "./ui/soundPanel.js";
import { createSplash } from "./ui/splash.js";

/**
 * @typedef {import("./core/types.js").Moment} Moment
 * @typedef {import("./core/types.js").ListeningArtist} ListeningArtist
 */

const PINS_KEY = "encore.pins.v1";
const LIKES_KEY = "encore.likes.v1";

const store = createStore(safeLocalStorage());

const state = createAppState({
  /** @type {Moment[]} */ moments: [],
  genre: "all",
  query: ""
});

boot().catch((error) => {
  console.error(error);
  showFatal("something went wrong loading the map. try a refresh.");
});

/**
 * `localStorage` throws on access, not just on use, when site data is blocked.
 * @returns {Storage|null}
 */
function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function boot() {
  if (typeof L === "undefined") {
    showFatal("the map library did not load. check the connection and refresh.");
    return;
  }

  const seeds = await loadMoments();
  const seedIds = new Set(seeds.map((moment) => moment.id));

  /** @type {Moment[]} */
  const mine = store.read(PINS_KEY, /** @type {Moment[]} */ ([])).filter(isValidMoment);
  /** @type {Record<string, number>} */
  const bumps = store.read(LIKES_KEY, /** @type {Record<string, number>} */ ({}));

  state.set({ moments: applyLikeBumps([...mine, ...seeds], bumps) });

  const mapView = createMapView("map", {
    onSelect: (moment) => openMoment(moment),
    onMapClick: (latlng) => pinForm.setLocation(latlng)
  });

  const feed = createFeed(
    {
      list: element("feedList"),
      count: element("feedCount"),
      status: element("feedStatus")
    },
    (moment) => {
      document.body.classList.remove("feed-open");
      mapView.focus(moment);
      openMoment(moment);
    }
  );

  const chips = createGenreChips(element("genreFilters"), (genre) => state.set({ genre }));
  const searchInput = /** @type {HTMLInputElement} */ (element("searchInput"));
  createSearch(searchInput, (query) => state.set({ query }));

  // A browser restores what was typed in a search field across a reload without
  // firing an input event, which would otherwise leave a query on screen next to
  // unfiltered results. Read it once at boot so the two agree.
  if (searchInput.value.trim() !== "") state.set({ query: searchInput.value.trim() });

  const momentDialog = createMomentDialog({
    shareUrl: (moment) =>
      shareUrlFor(moment, { origin: location.origin, pathname: location.pathname, seedIds }),
    onLove: (moment) => {
      if (moment.mine) {
        savePins();
      } else if (seedIds.has(moment.id)) {
        bumps[String(moment.id)] = (bumps[String(moment.id)] ?? 0) + 1;
        store.write(LIKES_KEY, bumps);
      }
      render(state.get());
    },
    onClose: () => history.replaceState(null, "", location.pathname + location.search)
  });

  const pinForm = createPinForm({
    fallbackLocation: () => mapView.map.getCenter(),
    onPin: (moment) => {
      state.set((current) => ({ moments: [moment, ...current.moments] }));
      savePins();
      mapView.focus(moment, 11);
      setTimeout(() => openMoment(moment), 700);
    }
  });

  createSoundPanel({ map: mapView.map, loadProfile: loadListeningProfile });

  element("feedToggle").addEventListener("click", () => {
    const open = document.body.classList.toggle("feed-open");
    element("feedToggle").setAttribute("aria-expanded", String(open));
  });

  state.subscribe(render);
  render(state.get());

  createSplash(() => {
    mapView.invalidate();
    openFromLocation();
  });

  window.addEventListener("hashchange", openFromLocation);

  /**
   * @param {Moment} moment
   */
  function openMoment(moment) {
    history.replaceState(
      null,
      "",
      shareUrlFor(moment, { origin: location.origin, pathname: location.pathname, seedIds })
    );
    momentDialog.open(moment);
  }

  /**
   * @param {{moments: Moment[], genre: string, query: string}} current
   */
  function render(current) {
    const visible = filterMoments(current.moments, current);
    chips.render(current.moments, current.genre);
    feed.render(sortByLove(visible));
    mapView.render(visible);
  }

  function savePins() {
    store.write(
      PINS_KEY,
      state.get().moments.filter((moment) => moment.mine)
    );
  }

  /**
   * A shared link skips the intro and lands on the moment it points at. A packed
   * payload is decoded and validated before anything touches the page.
   */
  function openFromLocation() {
    const intent = parseHash(location.hash);
    if (!intent) return;

    const target =
      intent.kind === "seed"
        ? state.get().moments.find((moment) => String(moment.id) === intent.id)
        : decodeMoment(intent.payload);

    if (!target) return;
    mapView.map.setView([target.lat, target.lng], 12, { animate: false });
    openMoment(target);
  }
}

/**
 * Seed moments, validated on arrival. A malformed entry is dropped and reported
 * rather than rendered, so a bad edit degrades to a smaller map instead of a
 * blank one. CI catches the same problem earlier, with `npm run validate:data`.
 *
 * @returns {Promise<Moment[]>}
 */
async function loadMoments() {
  const response = await fetch("data/moments.json");
  if (!response.ok) throw new Error(`moments.json responded ${response.status}`);
  const raw = await response.json();
  if (!Array.isArray(raw)) throw new Error("moments.json is not an array");

  const valid = raw.filter(isValidMoment);
  if (valid.length !== raw.length) {
    console.warn(`dropped ${raw.length - valid.length} invalid moment(s) from moments.json`);
  }
  return valid;
}

/**
 * The seam a real Spotify integration drops into: swap this one function for an
 * OAuth token exchange plus an origin lookup, and every view above is unchanged.
 *
 * @returns {Promise<ListeningArtist[]>}
 */
async function loadListeningProfile() {
  const response = await fetch("data/listening-sample.json");
  if (!response.ok) throw new Error(`listening-sample.json responded ${response.status}`);
  return response.json();
}

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function element(id) {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing element: #${id}`);
  return found;
}

/**
 * @param {string} message
 */
function showFatal(message) {
  const splash = document.getElementById("splash");
  splash?.remove();
  const banner = document.createElement("p");
  banner.className = "fatal";
  banner.setAttribute("role", "alert");
  banner.textContent = message;
  document.body.prepend(banner);
}
