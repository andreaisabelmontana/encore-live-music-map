/**
 * The rail of recently pinned moments.
 *
 * The feed is not decoration, it is the keyboard and screen reader path through
 * the app. A Leaflet marker is a div on a canvas, effectively unreachable by
 * keyboard, so every moment on the map is also a real `<button>` in this list,
 * reachable by Tab and announced with its venue, city and year.
 *
 * @module ui/feed
 */

import { createPoster } from "./thumbnail.js";
import { formatCount, formatMeta } from "../core/format.js";

/**
 * @typedef {import("../core/types.js").Moment} Moment
 */

/**
 * @param {object} elements
 * @param {HTMLElement} elements.list
 * @param {HTMLElement} elements.count
 * @param {HTMLElement} elements.status   Polite live region for result counts.
 * @param {(moment: Moment) => void} onSelect
 */
export function createFeed(elements, onSelect) {
  /**
   * @param {Moment[]} moments
   */
  function render(moments) {
    elements.count.textContent = String(moments.length);
    elements.list.replaceChildren(...moments.map((moment) => card(moment, onSelect)));

    if (moments.length === 0) {
      const empty = document.createElement("p");
      empty.className = "feed-empty";
      empty.textContent = "no moments match that search yet. try another artist, city or venue.";
      elements.list.replaceChildren(empty);
    }

    elements.status.textContent =
      moments.length === 1 ? "1 moment on the map" : `${formatCount(moments.length)} moments on the map`;
  }

  return { render };
}

/**
 * @param {Moment} moment
 * @param {(moment: Moment) => void} onSelect
 * @returns {HTMLButtonElement}
 */
function card(moment, onSelect) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card";

  const play = document.createElement("span");
  play.className = "card-play";
  play.setAttribute("aria-hidden", "true");
  play.textContent = "▶";

  const body = document.createElement("div");
  body.className = "card-body";

  const artist = document.createElement("span");
  artist.className = "card-artist";
  artist.textContent = moment.artist;

  const meta = document.createElement("span");
  meta.className = "card-meta";
  meta.textContent = formatMeta(moment);

  const foot = document.createElement("span");
  foot.className = "card-foot";

  const genre = document.createElement("span");
  genre.className = "card-genre";
  genre.textContent = moment.genre;

  const likes = document.createElement("span");
  likes.className = "card-likes";
  likes.textContent = `♥ ${formatCount(moment.likes)}`;

  foot.append(genre, likes);
  body.append(artist, meta, foot);
  button.append(play, createPoster(moment, "card-thumb"), body);

  button.addEventListener("click", () => onSelect(moment));
  return button;
}
