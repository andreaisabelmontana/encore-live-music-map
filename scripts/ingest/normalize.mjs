/**
 * Turning a MusicBrainz event into a moment.
 *
 * Pure functions over plain objects, so the awkward shapes that real data
 * actually contains can be tested without touching the network: events with no
 * date, events with three headliners, a place with no city, a name longer than
 * the schema allows.
 *
 * Anything that cannot be made into a valid moment is dropped and counted.
 * Reporting how much was dropped and why is the difference between a pipeline
 * and a hopeful script.
 *
 * @module ingest/normalize
 */

import { validateMoment } from "../../src/core/validate.js";

/** Relation types that identify who actually played. */
const PERFORMER_TYPES = new Set(["main performer", "support act", "performer"]);

/**
 * @param {any} event
 * @returns {number|null}
 */
export function yearOf(event) {
  const begin = event?.["life-span"]?.begin ?? event?.begin ?? null;
  if (typeof begin !== "string") return null;
  const year = Number.parseInt(begin.slice(0, 4), 10);
  return Number.isInteger(year) ? year : null;
}

/**
 * The billed act. A bill with several performers is listed main performer first
 * by MusicBrainz, and the first is the one a person would remember the night by.
 *
 * @param {any} event
 * @returns {{id: string, name: string}|null}
 */
export function mainPerformer(event) {
  const relations = Array.isArray(event?.relations) ? event.relations : [];
  const billed =
    relations.find((/** @type {any} */ r) => r?.artist && r?.type === "main performer") ??
    relations.find((/** @type {any} */ r) => r?.artist && PERFORMER_TYPES.has(r?.type)) ??
    relations.find((/** @type {any} */ r) => r?.artist);

  if (!billed?.artist?.name) return null;
  return { id: String(billed.artist.id ?? ""), name: String(billed.artist.name) };
}

/**
 * @param {any} event
 * @returns {string|null}
 */
export function placeIdOf(event) {
  const relations = Array.isArray(event?.relations) ? event.relations : [];
  const held = relations.find((/** @type {any} */ r) => r?.place?.id);
  return held ? String(held.place.id) : null;
}

/**
 * A short, stable identifier. MusicBrainz ids are UUIDs, which are too long to
 * repeat forty thousand times in a file the browser downloads. The first eight
 * hex characters are stable across runs, and collisions are checked at pack
 * time rather than assumed away.
 *
 * @param {string} mbid
 * @returns {string}
 */
export function shortId(mbid) {
  return String(mbid).replace(/-/g, "").slice(0, 8);
}

/**
 * @typedef {object} NormalizeContext
 * @property {Map<string, {name: string, lat: number, lng: number, city: string}>} places
 * @property {Map<string, {genre: string, origin: string}>} artistGenres
 */

/**
 * @param {any} event
 * @param {NormalizeContext} context
 * @returns {{ ok: true, moment: import("../../src/core/types.js").Moment } | { ok: false, reason: string }}
 */
export function toMoment(event, context) {
  const performer = mainPerformer(event);
  if (!performer) return { ok: false, reason: "no performer" };

  const placeId = placeIdOf(event);
  if (!placeId) return { ok: false, reason: "no venue" };

  const place = context.places.get(placeId);
  if (!place) return { ok: false, reason: "venue has no coordinates" };

  const year = yearOf(event);
  if (year === null) return { ok: false, reason: "no date" };

  const genre = context.artistGenres.get(performer.id)?.genre ?? "other";

  /** @type {import("../../src/core/types.js").Moment} */
  const moment = {
    id: `mb-${shortId(event.id)}`,
    artist: performer.name,
    venue: place.name,
    city: place.city || place.name,
    year,
    genre,
    // Four decimals is about eleven metres, which is finer than a venue needs
    // and keeps the packed file small.
    lat: Number(place.lat.toFixed(4)),
    lng: Number(place.lng.toFixed(4)),
    videoId: null,
    story: "",
    likes: 0
  };

  const check = validateMoment(moment);
  return check.ok ? { ok: true, moment } : { ok: false, reason: check.errors[0] };
}

/**
 * Normalise a batch, keeping a tally of why records were rejected.
 *
 * @param {any[]} events
 * @param {NormalizeContext} context
 * @param {Record<string, number>} [tally]
 * @returns {{ moments: import("../../src/core/types.js").Moment[], tally: Record<string, number> }}
 */
export function normalizeBatch(events, context, tally = {}) {
  /** @type {import("../../src/core/types.js").Moment[]} */
  const moments = [];

  for (const event of events) {
    const result = toMoment(event, context);
    if (result.ok) moments.push(result.moment);
    else tally[result.reason] = (tally[result.reason] ?? 0) + 1;
  }

  return { moments, tally };
}
