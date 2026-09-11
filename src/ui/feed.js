/**
 * The rail: every moment currently on the map, as a list.
 *
 * It is not a separate feature from the map, it is the same set of moments in a
 * second form, and that is the thing the interface has to make obvious. The
 * heading says "on the map", the line under it says how many and in what order,
 * and the order is a control rather than a mystery.
 *
 * It is also the keyboard and screen reader path through the app. A Leaflet
 * marker is a div on a canvas, effectively unreachable by keyboard, so every pin
 * is also a real `<button>` here, reachable by Tab and announced with its venue,
 * city and year.
 *
 * @module ui/feed
 */

import { createPoster } from "./thumbnail.js";
import { formatCount, formatMeta } from "../core/format.js";

/**
 * @typedef {import("../core/types.js").Moment} Moment
 */

/**
 * The orders the rail can be read in, and how each one describes itself. The
 * description is not decoration: a list whose order is not stated is a list a
 * person has to reverse engineer.
 *
 * @type {Array<{ key: string, label: string, describe: (count: number) => string }>}
 */
export const SORTS = [
  { key: "loved", label: "loved", describe: () => "most loved first" },
  { key: "recent", label: "recent", describe: () => "most recent night first" },
  { key: "near", label: "near", describe: () => "closest to the middle of the map first" }
];

/**
 * @param {object} elements
 * @param {HTMLElement} elements.list
 * @param {HTMLElement} elements.count
 * @param {HTMLElement} elements.status   Live region, and the visible sub line.
 * @param {HTMLElement} elements.sort
 * @param {object} handlers
 * @param {(moment: Moment) => void} handlers.onSelect
 * @param {(sort: string) => void} handlers.onSortChange
 */
export function createFeed(elements, handlers) {
  /** @type {Map<string, HTMLButtonElement>} */
  const sortButtons = new Map();

  for (const sort of SORTS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sort-btn";
    button.textContent = sort.label;
    button.addEventListener("click", () => handlers.onSortChange(sort.key));
    sortButtons.set(sort.key, button);
    elements.sort.append(button);
  }

  /**
   * @param {Moment[]} moments Already in the order they should be read.
   * @param {string} sortKey
   */
  function render(moments, sortKey) {
    const sort = SORTS.find((entry) => entry.key === sortKey) ?? SORTS[0];

    for (const [key, button] of sortButtons) {
      const active = key === sort.key;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }

    elements.count.textContent = String(moments.length);
    elements.list.replaceChildren(...moments.map((moment) => card(moment, handlers.onSelect)));

    if (moments.length === 0) {
      const empty = document.createElement("p");
      empty.className = "feed-empty";
      empty.textContent = "no moments match that search yet. try another artist, city or venue.";
      elements.list.replaceChildren(empty);
      elements.status.textContent = "nothing on the map right now";
      return;
    }

    const counted = moments.length === 1 ? "1 moment" : `${formatCount(moments.length)} moments`;
    elements.status.textContent = `${counted}, ${sort.describe(moments.length)}`;
  }

  return { render };
}

/**
 * A card is a small poster: the photograph flattened to two tones, the artist
 * name set across the bottom of it, a strip of tape holding the top, and the
 * details printed underneath like a caption.
 *
 * @param {Moment} moment
 * @param {(moment: Moment) => void} onSelect
 * @returns {HTMLButtonElement}
 */
function card(moment, onSelect) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card";

  const poster = document.createElement("span");
  poster.className = "card-poster";

  const tape = document.createElement("span");
  tape.className = "card-tape";
  tape.setAttribute("aria-hidden", "true");

  const play = document.createElement("span");
  play.className = "card-play";
  play.setAttribute("aria-hidden", "true");
  play.textContent = "▶";

  // The name is the artwork, so it sits on the poster rather than under it.
  const artist = document.createElement("span");
  artist.className = "card-artist";
  artist.textContent = moment.artist;

  poster.append(createPoster(moment, "card-thumb"), tape, play, artist);

  const body = document.createElement("span");
  body.className = "card-body";

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
  body.append(meta, foot);
  button.append(poster, body);

  button.addEventListener("click", () => onSelect(moment));
  return button;
}
