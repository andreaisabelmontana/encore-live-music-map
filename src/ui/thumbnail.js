/**
 * Poster images for moments, with a fallback that always renders.
 *
 * Two details drive this module:
 *
 *  1. A moment with no clip attached still needs a picture, so it gets a woven
 *     gradient drawn as an inline SVG. No network request, no layout shift.
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

/** Width below which a YouTube response is the grey placeholder, not a frame. */
const PLACEHOLDER_WIDTH = 120;

/** A gradient poster, inlined as a data URI so it costs no request. */
export const FALLBACK_POSTER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">
       <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0" stop-color="#ff2e9a"/><stop offset=".5" stop-color="#8a4bff"/>
         <stop offset="1" stop-color="#2ec5ff"/></linearGradient></defs>
       <rect width="320" height="200" fill="#14141c"/>
       <rect width="320" height="200" fill="url(#g)" opacity="0.25"/>
       <text x="50%" y="52%" font-family="sans-serif" font-size="40" fill="#fff"
         text-anchor="middle" opacity="0.85">&#9654;</text>
     </svg>`
  );

/**
 * @param {import("../core/types.js").Moment} moment
 * @returns {string}
 */
export function posterFor(moment) {
  return moment.videoId ? thumbnailUrl(moment.videoId) : FALLBACK_POSTER;
}

/**
 * Build a poster `<img>` that degrades to the gradient in every failure mode.
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
  img.src = posterFor(moment);

  if (moment.videoId) {
    // Swap once. Assigning `src` inside a handler retriggers that handler, and a
    // provider that answers every request with something unusable would
    // otherwise loop.
    let swapped = false;
    const useFallback = () => {
      if (swapped) return;
      swapped = true;
      img.src = FALLBACK_POSTER;
    };

    img.addEventListener("load", () => {
      if (img.naturalWidth > 0 && img.naturalWidth <= PLACEHOLDER_WIDTH) useFallback();
    });
    img.addEventListener("error", useFallback);
  }

  return img;
}
