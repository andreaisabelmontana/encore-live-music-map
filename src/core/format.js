/**
 * Small formatting helpers. Pure functions, no DOM.
 * @module core/format
 */

/** @type {Record<string, string>} */
const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

/**
 * Escape a value for safe interpolation into an HTML string.
 *
 * Every template literal in the UI layer that ends up in `innerHTML` runs its
 * dynamic parts through this. Visitor supplied text reaches the page from two
 * untrusted directions, the pin form and the share link payload, so escaping is
 * not optional.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Format a count with thousands separators, stable across locales so that
 * snapshots and tests do not drift with the machine running them.
 *
 * @param {number} count
 * @returns {string}
 */
export function formatCount(count) {
  return Number(count).toLocaleString("en-US");
}

/**
 * One line of context under a moment title: venue, city and year.
 *
 * @param {Pick<import("./types.js").Moment, "venue"|"city"|"year">} moment
 * @returns {string}
 */
export function formatMeta(moment) {
  return [moment.venue, moment.city, moment.year].filter((part) => part !== "" && part != null).join(" \u00b7 ");
}

/**
 * Clamp a number into a range, used for sizing glow pins.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
