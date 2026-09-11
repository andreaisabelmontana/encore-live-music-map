/**
 * Genre chips and the search box.
 *
 * The chips are a single selection group, so they carry `role="tablist"`
 * semantics in spirit: one pressed chip at a time, communicated with
 * `aria-pressed` rather than colour alone.
 *
 * @module ui/filters
 */

import { genresOf } from "../core/moments.js";
import { debounce } from "../core/state.js";

/**
 * @typedef {import("../core/types.js").Moment} Moment
 */

/**
 * @param {HTMLElement} container
 * @param {(genre: string) => void} onChange
 */
export function createGenreChips(container, onChange) {
  /**
   * @param {Moment[]} moments
   * @param {string} active
   */
  function render(moments, active) {
    const chips = genresOf(moments).map((genre) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (genre === active ? " active" : "");
      chip.textContent = genre;
      chip.setAttribute("aria-pressed", String(genre === active));
      chip.addEventListener("click", () => onChange(genre));
      return chip;
    });
    container.replaceChildren(...chips);
  }

  return { render };
}

/**
 * @param {HTMLInputElement} input
 * @param {(query: string) => void} onChange
 * @param {number} [waitMs]
 */
export function createSearch(input, onChange, waitMs = 160) {
  const run = debounce((/** @type {string} */ value) => onChange(value), waitMs);

  input.addEventListener("input", () => run(input.value.trim()));

  // Enter should commit immediately rather than wait out the debounce, and it
  // should not submit anything, there is no form here.
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onChange(input.value.trim());
    }
  });

  return {
    clear() {
      input.value = "";
      onChange("");
    }
  };
}
