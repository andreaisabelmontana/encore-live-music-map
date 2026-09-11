/**
 * Respect for `prefers-reduced-motion`.
 *
 * ENCORE leans on movement: a splash that fades, pins that fly across the globe,
 * a feed that slides up. For someone with vestibular sensitivity that is not
 * decoration, it is a reason to close the tab. Every animation in the app asks
 * here first, and falls back to an instant change.
 *
 * @module ui/motion
 */

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia(QUERY).matches;
}

/**
 * Fly the map to a place, or jump there when motion is unwelcome.
 *
 * @param {import("leaflet").Map} map
 * @param {[number, number]} latlng
 * @param {number} zoom
 * @param {number} [duration] seconds
 */
export function moveTo(map, latlng, zoom, duration = 1.1) {
  if (prefersReducedMotion()) {
    map.setView(latlng, zoom, { animate: false });
    return;
  }
  map.flyTo(latlng, zoom, { duration });
}

/**
 * Same idea for a bounds fit.
 *
 * @param {import("leaflet").Map} map
 * @param {import("leaflet").LatLngBounds} bounds
 * @param {object} options
 */
export function fitTo(map, bounds, options) {
  if (prefersReducedMotion()) {
    map.fitBounds(bounds, { ...options, animate: false });
    return;
  }
  map.flyToBounds(bounds, options);
}
