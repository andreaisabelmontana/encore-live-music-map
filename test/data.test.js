/**
 * The seed data is content, not code, and it is the easiest thing in the repo to
 * break with a careless edit. These tests treat `data/` as an interface: they
 * run in CI on every change, and `npm run validate:data` runs the same checks
 * from the command line with a readable report.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { validateMoment } from "../src/core/validate.js";

/**
 * @param {string} name
 * @returns {unknown}
 */
const load = (name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../data/${name}`, import.meta.url)), "utf8"));

const moments = /** @type {import("../src/core/types.js").Moment[]} */ (load("moments.json"));
const profile = /** @type {import("../src/core/types.js").ListeningArtist[]} */ (
  load("listening-sample.json")
);

test("every seed moment satisfies the same rules a shared link has to", () => {
  for (const moment of moments) {
    const result = validateMoment(moment);
    assert.ok(result.ok, `${moment.artist}: ${result.errors.join("; ")}`);
  }
});

test("moment ids are unique, they are the key share links travel on", () => {
  const ids = moments.map((moment) => moment.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("the map is not empty and not accidentally truncated", () => {
  assert.ok(moments.length >= 10, `only ${moments.length} moments`);
});

test("no seed moment claims a clip id, a guessed id shows the wrong night", () => {
  for (const moment of moments) {
    assert.equal(moment.videoId, null, `${moment.artist} has a hard coded clip id`);
  }
});

test("no two moments sit on the exact same point", () => {
  const points = moments.map((moment) => `${moment.lat},${moment.lng}`);
  const duplicates = points.filter((point, index) => points.indexOf(point) !== index);
  const allowed = ["33.6797,-116.2375"]; // Coachella hosts more than one moment
  assert.deepEqual(
    duplicates.filter((point) => !allowed.includes(point)),
    []
  );
});

test("the listening sample has the fields the sound map reads", () => {
  assert.ok(profile.length > 0);
  for (const artist of profile) {
    assert.equal(typeof artist.artist, "string");
    assert.equal(typeof artist.origin, "string");
    assert.equal(typeof artist.country, "string");
    assert.equal(typeof artist.genre, "string");
    assert.ok(Number.isFinite(artist.lat) && artist.lat >= -90 && artist.lat <= 90, artist.artist);
    assert.ok(Number.isFinite(artist.lng) && artist.lng >= -180 && artist.lng <= 180, artist.artist);
    assert.ok(artist.minutes > 0, artist.artist);
  }
});
