/**
 * Aggregates over a listening profile.
 *
 * The sound map answers one question: where does the music you listen to come
 * from? Given artists placed at their city of origin and minutes streamed, these
 * functions produce the numbers the panel graphs.
 *
 * @module core/soundmap
 */

import { clamp } from "./format.js";

/**
 * @typedef {import("./types.js").ListeningArtist} ListeningArtist
 * @typedef {import("./types.js").SoundSummary} SoundSummary
 */

/**
 * Sum minutes per key.
 *
 * @param {ListeningArtist[]} artists
 * @param {"country"|"genre"} key
 * @returns {Record<string, number>}
 */
export function minutesBy(artists, key) {
  /** @type {Record<string, number>} */
  const totals = {};
  for (const artist of artists) {
    totals[artist[key]] = (totals[artist[key]] ?? 0) + artist.minutes;
  }
  return totals;
}

/**
 * Largest total wins. Ties break alphabetically so the answer is deterministic
 * rather than dependent on the order the profile happened to arrive in.
 *
 * @param {Record<string, number>} totals
 * @returns {string}
 */
export function leaderOf(totals) {
  const entries = Object.entries(totals);
  if (entries.length === 0) return "";
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries[0][0];
}

/**
 * Everything the sound panel displays, in one pass over the profile.
 *
 * @param {ListeningArtist[]} artists
 * @returns {SoundSummary}
 */
export function summarize(artists) {
  const byCountry = minutesBy(artists, "country");
  const byGenre = minutesBy(artists, "genre");
  const totalMinutes = artists.reduce((sum, artist) => sum + artist.minutes, 0);

  return {
    artists: artists.length,
    countries: Object.keys(byCountry).length,
    hours: Math.round(totalMinutes / 60),
    totalMinutes,
    topCountry: leaderOf(byCountry),
    topGenre: leaderOf(byGenre)
  };
}

/**
 * Pin diameter in pixels, scaled by minutes streamed against the heaviest
 * listened artist in the profile. Clamped so a single outlier cannot swallow the
 * map and a long tail artist stays clickable.
 *
 * @param {number} minutes
 * @param {number} maxMinutes
 * @param {{ min?: number, max?: number }} [bounds]
 * @returns {number}
 */
export function glowSize(minutes, maxMinutes, bounds = {}) {
  const min = bounds.min ?? 30;
  const max = bounds.max ?? 76;
  if (!Number.isFinite(maxMinutes) || maxMinutes <= 0) return min;
  const scaled = min + (minutes / maxMinutes) * (max - min);
  return Math.round(clamp(scaled, min, max));
}

/**
 * Profile ordered the way the panel lists it, heaviest first.
 *
 * @param {ListeningArtist[]} artists
 * @returns {ListeningArtist[]}
 */
export function rankByMinutes(artists) {
  return [...artists].sort((a, b) => b.minutes - a.minutes || a.artist.localeCompare(b.artist));
}
