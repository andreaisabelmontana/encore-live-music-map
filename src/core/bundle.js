/**
 * The wire format for the ingested dataset.
 *
 * Tens of thousands of performances written as one JSON object per record comes
 * to several megabytes, most of it the same venue and artist names repeated over
 * and over. This packs them columnar instead: every distinct artist, venue and
 * genre appears once in a dictionary, and each performance becomes four small
 * integers pointing into those dictionaries.
 *
 * Row layout is a flat array with a stride of four rather than an array of
 * arrays, which removes two characters of punctuation per record. At this scale
 * that alone is worth tens of kilobytes.
 *
 *   rows[i * 4 + 0]  artist index
 *   rows[i * 4 + 1]  venue index
 *   rows[i * 4 + 2]  genre index
 *   rows[i * 4 + 3]  year
 *
 * Both ends of the format live here so that a change to one is a change to the
 * other, and so the round trip can be proved in a single test.
 *
 * @module core/bundle
 */

/**
 * @typedef {import("./types.js").Moment} Moment
 */

/**
 * @typedef {object} Bundle
 * @property {number} v                              Format version.
 * @property {string} generated                      ISO date the pipeline ran.
 * @property {string} source                         Where the records came from.
 * @property {string[]} artists
 * @property {string[]} genres
 * @property {Array<[string, string, number, number]>} venues  name, city, lat, lng
 * @property {string[]} ids                          One per row, in row order.
 * @property {number[]} rows                         Flat, stride of four.
 */

export const BUNDLE_VERSION = 1;
const STRIDE = 4;

/**
 * Pack moments into the wire format.
 *
 * @param {Moment[]} moments
 * @param {{ generated?: string, source?: string }} [meta]
 * @returns {Bundle}
 */
export function pack(moments, meta = {}) {
  /** @type {Map<string, number>} */
  const artistIndex = new Map();
  /** @type {Map<string, number>} */
  const genreIndex = new Map();
  /** @type {Map<string, number>} */
  const venueIndex = new Map();

  /** @type {string[]} */
  const artists = [];
  /** @type {string[]} */
  const genres = [];
  /** @type {Array<[string, string, number, number]>} */
  const venues = [];
  /** @type {string[]} */
  const ids = [];
  /** @type {number[]} */
  const rows = [];

  for (const moment of moments) {
    const artist = intern(artistIndex, artists, moment.artist, () => moment.artist);
    const genre = intern(genreIndex, genres, moment.genre, () => moment.genre);

    // A venue is identified by its name and its point, so two rooms with the
    // same name in different cities stay distinct.
    const venueKey = `${moment.venue}|${moment.lat}|${moment.lng}`;
    const venue = intern(venueIndex, venues, venueKey, () => [
      moment.venue,
      moment.city,
      moment.lat,
      moment.lng
    ]);

    ids.push(String(moment.id).replace(/^mb-/, ""));
    rows.push(artist, venue, genre, Number(moment.year));
  }

  return {
    v: BUNDLE_VERSION,
    generated: meta.generated ?? new Date().toISOString().slice(0, 10),
    source: meta.source ?? "MusicBrainz",
    artists,
    genres,
    venues,
    ids,
    rows
  };
}

/**
 * Rebuild moments from the wire format.
 *
 * Returns an empty array rather than throwing when the bundle is the wrong
 * version or malformed, because the caller is a page load and a missing dataset
 * should cost the curated moments nothing.
 *
 * @param {unknown} raw
 * @returns {Moment[]}
 */
export function unpack(raw) {
  if (!isBundle(raw)) return [];

  /** @type {Moment[]} */
  const moments = [];
  const count = Math.floor(raw.rows.length / STRIDE);

  for (let i = 0; i < count; i += 1) {
    const artist = raw.artists[raw.rows[i * STRIDE]];
    const venue = raw.venues[raw.rows[i * STRIDE + 1]];
    const genre = raw.genres[raw.rows[i * STRIDE + 2]];
    const year = raw.rows[i * STRIDE + 3];
    if (artist === undefined || venue === undefined || genre === undefined) continue;

    moments.push({
      id: `mb-${raw.ids[i] ?? i}`,
      artist,
      venue: venue[0],
      city: venue[1],
      year,
      genre,
      lat: venue[2],
      lng: venue[3],
      videoId: null,
      story: "",
      likes: 0
    });
  }

  return moments;
}

/**
 * @param {unknown} raw
 * @returns {raw is Bundle}
 */
export function isBundle(raw) {
  if (typeof raw !== "object" || raw === null) return false;
  const bundle = /** @type {Partial<Bundle>} */ (raw);
  return (
    bundle.v === BUNDLE_VERSION &&
    Array.isArray(bundle.artists) &&
    Array.isArray(bundle.genres) &&
    Array.isArray(bundle.venues) &&
    Array.isArray(bundle.ids) &&
    Array.isArray(bundle.rows) &&
    bundle.rows.length % STRIDE === 0
  );
}

/**
 * @template T
 * @param {Map<string, number>} index
 * @param {T[]} table
 * @param {string} key
 * @param {() => T} build
 * @returns {number}
 */
function intern(index, table, key, build) {
  const existing = index.get(key);
  if (existing !== undefined) return existing;
  const position = table.push(build()) - 1;
  index.set(key, position);
  return position;
}
