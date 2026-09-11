/**
 * Moment validation.
 *
 * Two callers, both handling data this app does not control: the seed file
 * checked in CI, and the share link decoder, which parses a payload any stranger
 * can hand craft. One validator serves both so the rules cannot drift apart.
 *
 * @module core/validate
 */

import { isVideoId } from "./youtube.js";

/** Genres the UI offers. `other` is the escape hatch on the pin form. */
export const GENRES = Object.freeze([
  "reggaeton", "pop", "rock", "hip-hop", "electronic",
  "indie", "r&b", "latin", "other"
]);

/** Recorded sound predates this, live video on the map does not. */
const EARLIEST_YEAR = 1900;
const STORY_MAX = 600;
const NAME_MAX = 120;

/**
 * @param {unknown} value
 * @param {number} max
 * @returns {boolean}
 */
const isText = (value, max) =>
  typeof value === "string" && value.trim() !== "" && value.length <= max;

/**
 * Check a candidate moment and collect every problem, rather than failing on the
 * first, so `npm run validate:data` can report a whole file in one pass.
 *
 * @param {unknown} candidate
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateMoment(candidate) {
  /** @type {string[]} */
  const errors = [];

  if (typeof candidate !== "object" || candidate === null) {
    return { ok: false, errors: ["moment is not an object"] };
  }
  const m = /** @type {Record<string, unknown>} */ (candidate);

  if (typeof m.id !== "number" && typeof m.id !== "string") errors.push("id must be a number or string");
  if (!isText(m.artist, NAME_MAX)) errors.push("artist must be a non empty string");
  if (!isText(m.venue, NAME_MAX)) errors.push("venue must be a non empty string");
  if (!isText(m.city, NAME_MAX)) errors.push("city must be a non empty string");

  const year = Number(m.year);
  if (!Number.isInteger(year) || year < EARLIEST_YEAR || year > new Date().getFullYear() + 1) {
    errors.push(`year must be an integer between ${EARLIEST_YEAR} and next year`);
  }

  if (typeof m.genre !== "string" || !GENRES.includes(m.genre)) {
    errors.push(`genre must be one of: ${GENRES.join(", ")}`);
  }

  if (typeof m.lat !== "number" || !Number.isFinite(m.lat) || m.lat < -90 || m.lat > 90) {
    errors.push("lat must be a finite number between -90 and 90");
  }
  if (typeof m.lng !== "number" || !Number.isFinite(m.lng) || m.lng < -180 || m.lng > 180) {
    errors.push("lng must be a finite number between -180 and 180");
  }

  if (m.videoId !== null && !isVideoId(m.videoId)) {
    errors.push("videoId must be null or an 11 character YouTube id");
  }

  if (typeof m.story !== "string" || m.story.length > STORY_MAX) {
    errors.push(`story must be a string of at most ${STORY_MAX} characters`);
  }

  if (typeof m.likes !== "number" || !Number.isFinite(m.likes) || m.likes < 0) {
    errors.push("likes must be a number of at least 0");
  }

  return { ok: errors.length === 0, errors };
}

/**
 * @param {unknown} candidate
 * @returns {candidate is import("./types.js").Moment}
 */
export function isValidMoment(candidate) {
  return validateMoment(candidate).ok;
}
