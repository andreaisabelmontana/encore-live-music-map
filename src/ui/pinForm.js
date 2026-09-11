/**
 * The pin form: drop a moment of your own onto the map.
 *
 * Input from this form is the first of two untrusted sources in the app, so it
 * is validated with the same rules as the checked in seed data before it becomes
 * a moment. Invalid fields are reported inline and announced, not swallowed.
 *
 * @module ui/pinForm
 */

import { createDialog } from "./dialog.js";
import { parseVideoId } from "../core/youtube.js";
import { validateMoment } from "../core/validate.js";

/**
 * @typedef {import("../core/types.js").Moment} Moment
 */

/**
 * @param {object} options
 * @param {(moment: Moment) => void} options.onPin
 * @param {() => {lat: number, lng: number}} options.fallbackLocation
 */
export function createPinForm(options) {
  const scrim = /** @type {HTMLElement} */ (document.getElementById("sheet"));
  const form = /** @type {HTMLFormElement} */ (document.getElementById("addForm"));
  const hint = /** @type {HTMLElement} */ (document.getElementById("sheetHint"));
  const openBtn = /** @type {HTMLButtonElement} */ (document.getElementById("addBtn"));
  const cancelBtn = /** @type {HTMLButtonElement} */ (document.getElementById("sheetCancel"));

  const DEFAULT_HINT = "tip: click anywhere on the map first to set the location 📍";

  /** @type {{lat: number, lng: number}|null} */
  let pendingLocation = null;

  const dialog = createDialog(scrim, { labelledBy: "sheetTitle" });

  openBtn.addEventListener("click", () => dialog.open());
  cancelBtn.addEventListener("click", () => dialog.close());

  /**
   * Remember where on the map the visitor clicked, so the next pin lands there.
   * @param {{lat: number, lng: number}} latlng
   */
  function setLocation(latlng) {
    pendingLocation = latlng;
    hint.textContent = `📍 location set: ${latlng.lat.toFixed(2)}, ${latlng.lng.toFixed(2)}. now fill in the details.`;
    hint.classList.add("set");
  }

  function resetHint() {
    hint.textContent = DEFAULT_HINT;
    hint.classList.remove("set", "error");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const location = pendingLocation ?? options.fallbackLocation();

    /** @type {Moment} */
    const moment = {
      id: Date.now(),
      artist: String(data.get("artist") ?? "").trim(),
      venue: String(data.get("venue") ?? "").trim(),
      city: String(data.get("city") ?? "").trim(),
      year: Number.parseInt(String(data.get("year") ?? ""), 10) || new Date().getFullYear(),
      genre: String(data.get("genre") ?? "other"),
      lat: location.lat,
      lng: location.lng,
      videoId: parseVideoId(String(data.get("yt") ?? "")),
      story: String(data.get("story") ?? "").trim() || "a moment that mattered.",
      likes: 1,
      mine: true
    };

    const result = validateMoment(moment);
    if (!result.ok) {
      hint.textContent = `check the form: ${result.errors[0]}`;
      hint.classList.add("error");
      hint.classList.remove("set");
      return;
    }

    options.onPin(moment);
    form.reset();
    pendingLocation = null;
    resetHint();
    dialog.close();
  });

  return { setLocation, close: () => dialog.close(), isOpen: dialog.isOpen };
}
