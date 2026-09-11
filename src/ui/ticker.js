/**
 * The strip along the bottom of the page.
 *
 * A poster lists its dates in a run down the bottom, which is the look this
 * borrows. The danger in borrowing it is that a run of years reads as a tour
 * announcement, as though these were shows to buy tickets for. They are the
 * opposite: nights that already happened and are pinned on the map right now.
 *
 * Two things keep that clear. A fixed label at the left says what the run is,
 * and the run is in the same order as the rail, so the strip is visibly the list
 * the person is already looking at rather than a second, unexplained one.
 *
 * The track holds the same entries twice and translates by exactly half its own
 * width, so the loop closes with no gap and no measurement. Moving by a pixel
 * count read from the DOM breaks the moment a font loads late or the window
 * resizes.
 *
 * @module ui/ticker
 */

/**
 * @typedef {import("../core/types.js").Moment} Moment
 */

/** Enough to read as a run of dates, few enough to stay cheap to animate. */
const MAX_ENTRIES = 26;

/**
 * @param {HTMLElement} root
 */
export function createTicker(root) {
  const label = document.createElement("span");
  label.className = "ticker-label";
  label.textContent = "on the map";

  const window_ = document.createElement("div");
  window_.className = "ticker-window";

  root.replaceChildren(label, window_);

  /**
   * @param {Moment[]} moments In the order the rail is showing them.
   */
  function render(moments) {
    if (moments.length === 0) {
      window_.replaceChildren();
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

    window_.replaceChildren(track);
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

  const year = document.createElement("span");
  year.className = "year";
  year.textContent = String(moment.year);

  const name = document.createElement("span");
  name.textContent = `${moment.artist}, ${moment.city}`;

  // Year first, the way a listing reads, rather than trailing the name where it
  // looks like a date being advertised.
  item.append(year, name);
  return item;
}
