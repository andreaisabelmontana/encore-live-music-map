/**
 * Poster images for moments, with a fallback that always renders.
 *
 * Two details drive this module:
 *
 *  1. A moment with no clip attached still needs artwork, so it gets a poster
 *     generated from its own name. No network request, no layout shift, and a
 *     rail of cards that all look different from each other.
 *  2. YouTube answers a request for a thumbnail of a dead or private video with
 *     HTTP 200 and a 120x90 grey placeholder, so `onerror` never fires. The only
 *     reliable tell is the decoded width, which is checked on load.
 *
 * The handlers are attached in JavaScript rather than written as `onload`
 * attributes, which is what lets the page ship a content security policy with no
 * `unsafe-inline` for scripts.
 *
 * @module ui/thumbnail
 */

import { thumbnailUrl } from "../core/youtube.js";
import { generatePoster } from "../core/poster.js";

/** Width below which a YouTube response is the grey placeholder, not a frame. */
const PLACEHOLDER_WIDTH = 120;

/**
 * @param {import("../core/types.js").Moment} moment
 * @returns {string}
 */
export function posterFor(moment) {
  return moment.videoId ? thumbnailUrl(moment.videoId) : generatePoster(moment);
}

/**
 * Build a poster `<img>` that degrades to generated artwork in every failure
 * mode. The `is-generated` class tells the stylesheet to leave it alone: the
 * duotone and halftone treatments exist to flatten a photograph, and this is
 * already flat.
 *
 * @param {import("../core/types.js").Moment} moment
 * @param {string} className
 * @returns {HTMLImageElement}
 */
export function createPoster(moment, className) {
  const img = document.createElement("img");
  img.className = className;
  img.loading = "lazy";
  img.decoding = "async";
  // The artist name is already in the adjacent text, so the poster is decorative
  // and an empty alt keeps a screen reader from reading the name twice.
  img.alt = "";

  if (!moment.videoId) {
    img.classList.add("is-generated");
    img.src = generatePoster(moment);
    return img;
  }

  img.src = thumbnailUrl(moment.videoId);

  // Swap once. Assigning `src` inside a handler retriggers that handler, and a
  // provider that answers every request with something unusable would otherwise
  // loop.
  let swapped = false;
  const useFallback = () => {
    if (swapped) return;
    swapped = true;
    img.classList.add("is-generated");
    img.src = generatePoster(moment);
  };

  img.addEventListener("load", () => {
    if (img.naturalWidth > 0 && img.naturalWidth <= PLACEHOLDER_WIDTH) useFallback();
  });
  img.addEventListener("error", useFallback);

  return img;
}
