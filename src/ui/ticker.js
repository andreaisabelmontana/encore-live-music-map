/**
 * The strip of dates along the bottom of the page.
 *
 * A tour poster lists its dates in a run down the bottom, and that is what this
 * is: the moments currently on the map, moving past. It is decoration with a
 * source, so it always shows real rows rather than filler.
 *
 * Two details make it behave.
 *
 * The track holds the same list twice and translates by exactly half its width,
 * so the loop closes with no gap and no measurement. The alternative, moving by
 * a pixel count read from the DOM, breaks the moment a font loads late or the
 * window resizes.
 *
 * It never animates in isolation: `prefers-reduced-motion` stops the marquee in
 * the stylesheet, and this module caps how many entries it renders, because the
 * strip is scenery and should never cost the map a frame.
 *
 * @module ui/ticker
 */

/**
 * @typedef {import("../core/types.js").Moment} Moment
 */

/** Enough to read as a tour list, few enough to stay cheap to animate. */
const MAX_ENTRIES = 26;

/**
 * @param {HTMLElement} root
 */
export function createTicker(root) {
  /**
   * @param {Moment[]} moments
   */
  function render(moments) {
    if (moments.length === 0) {
      root.replaceChildren();
      return;
    }

    const entries = moments.slice(0, MAX_ENTRIES);
    const track = document.createElement("div");
    track.className = "ticker-track";

    // Twice, so translating the track by half its own width lands exactly where
    // it started and the run reads as continuous.
    for (let pass = 0; pass < 2; pass += 1) {
      for (const moment of entries) track.append(entry(moment));
    }

    root.replaceChildren(track);
  }

  return { render };
}

/**
 * @param {Moment} moment
 * @returns {HTMLElement}
 */
function entry(moment) {
  const item = document.createElement("span");
  item.className = "ticker-item";

  const name = document.createElement("span");
  name.textContent = `${moment.artist} · ${moment.city}`;

  const year = document.createElement("span");
  year.className = "year";
  year.textContent = String(moment.year);

  item.append(name, year);
  return item;
}
