/**
 * Filtering, searching and ranking over the moment collection.
 *
 * Every function here takes data in and returns new data out. No DOM, no module
 * level state, so the behaviour the map and the feed share is unit tested once
 * and used twice.
 *
 * @module core/moments
 */

/**
 * @typedef {import("./types.js").Moment} Moment
 */

/**
 * Case and accent insensitive key for matching. Searching "rosalia" should find
 * "Rosalía", which is the whole reason this is not a plain `toLowerCase()`.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalize(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Does a moment match a free text query? Matches across artist, city and venue,
 * the three things a person actually remembers about a show.
 *
 * @param {Moment} moment
 * @param {string} query
 * @returns {boolean}
 */
export function matchesQuery(moment, query) {
  const needle = normalize(query);
  if (needle === "") return true;
  return [moment.artist, moment.city, moment.venue]
    .some((field) => normalize(field).includes(needle));
}

/**
 * Apply the active genre chip and search box to the collection.
 *
 * @param {Moment[]} moments
 * @param {{ genre?: string, query?: string }} [filters]
 * @returns {Moment[]}
 */
export function filterMoments(moments, filters = {}) {
  const genre = filters.genre ?? "all";
  const query = filters.query ?? "";
  return moments.filter(
    (moment) => (genre === "all" || moment.genre === genre) && matchesQuery(moment, query)
  );
}

/**
 * Most loved first, newest first as the tie break so a freshly pinned moment
 * does not sink below an older one with the same count.
 *
 * @param {Moment[]} moments
 * @returns {Moment[]}
 */
export function sortByLove(moments) {
  return [...moments].sort((a, b) => b.likes - a.likes || Number(b.id) - Number(a.id));
}

/**
 * Newest night first. The tie break is the identifier, which for a moment
 * someone pinned is the millisecond they pinned it, so their own additions sort
 * above seed moments from the same year.
 *
 * @param {Moment[]} moments
 * @returns {Moment[]}
 */
export function sortByRecency(moments) {
  return [...moments].sort(
    (a, b) => Number(b.year) - Number(a.year) || String(b.id).localeCompare(String(a.id))
  );
}

/**
 * Closest to a point first, which in the app is whatever the map is centred on.
 * Panning therefore reorders the list, and that is the intent: the rail answers
 * "what happened around here".
 *
 * @param {Moment[]} moments
 * @param {{lat: number, lng: number}} origin
 * @returns {Moment[]}
 */
export function sortByDistanceFrom(moments, origin) {
  return [...moments]
    .map((moment) => ({ moment, km: distanceKm(origin, moment) }))
    .sort((a, b) => a.km - b.km)
    .map((entry) => entry.moment);
}

/**
 * Genres present in the collection, in the order the UI should render chips.
 * Always starts with "all" so the filter bar has a reset.
 *
 * @param {Moment[]} moments
 * @returns {string[]}
 */
export function genresOf(moments) {
  return ["all", ...new Set(moments.map((moment) => moment.genre))];
}

/**
 * Fold stored like counts back into seed moments on boot.
 *
 * Hearts on a seed moment live in local storage as a delta rather than an
 * absolute, so a later edit to the seed file still shows through.
 *
 * @param {Moment[]} moments
 * @param {Record<string, number>} bumps
 * @returns {Moment[]} new array, inputs untouched
 */
export function applyLikeBumps(moments, bumps) {
  return moments.map((moment) => {
    const bump = bumps[String(moment.id)];
    if (moment.mine || !bump) return { ...moment };
    return { ...moment, likes: moment.likes + bump };
  });
}

/**
 * Great circle distance in kilometres, used to tell a visitor how far a moment
 * is from the map centre and to sort "near here" results.
 *
 * @param {{lat: number, lng: number}} a
 * @param {{lat: number, lng: number}} b
 * @returns {number}
 */
export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (/** @type {number} */ deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
