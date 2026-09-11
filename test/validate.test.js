import test from "node:test";
import assert from "node:assert/strict";

import { GENRES, isValidMoment, validateMoment } from "../src/core/validate.js";

/** @type {import("../src/core/types.js").Moment} */
const good = {
  id: 1,
  artist: "Tame Impala",
  venue: "Red Rocks Amphitheatre",
  city: "Morrison",
  year: 2021,
  genre: "indie",
  lat: 39.6655,
  lng: -105.2056,
  videoId: null,
  story: "lasers on rock walls",
  likes: 1890
};

test("a well formed moment passes", () => {
  assert.deepEqual(validateMoment(good), { ok: true, errors: [] });
  assert.equal(isValidMoment(good), true);
});

test("things that are not moments at all are rejected without throwing", () => {
  for (const value of [null, undefined, 7, "moment", []]) {
    assert.equal(isValidMoment(value), false, `accepted: ${JSON.stringify(value)}`);
  }
});

test("coordinates have to be on the planet", () => {
  assert.equal(isValidMoment({ ...good, lat: 91 }), false);
  assert.equal(isValidMoment({ ...good, lat: -91 }), false);
  assert.equal(isValidMoment({ ...good, lng: 181 }), false);
  assert.equal(isValidMoment({ ...good, lat: Number.NaN }), false);
  assert.equal(isValidMoment({ ...good, lng: "2.1686" }), false, "a string is not a coordinate");
  assert.equal(isValidMoment({ ...good, lat: 90, lng: 180 }), true, "the edges are on the planet");
});

test("the year has to be plausible for a live recording", () => {
  assert.equal(isValidMoment({ ...good, year: 1899 }), false);
  assert.equal(isValidMoment({ ...good, year: 2400 }), false);
  assert.equal(isValidMoment({ ...good, year: 2021.5 }), false);
  assert.equal(isValidMoment({ ...good, year: new Date().getFullYear() + 1 }), true, "a show announced for next year");
});

test("empty text is not a name", () => {
  assert.equal(isValidMoment({ ...good, artist: "" }), false);
  assert.equal(isValidMoment({ ...good, artist: "   " }), false);
  assert.equal(isValidMoment({ ...good, venue: null }), false);
  assert.equal(isValidMoment({ ...good, city: 42 }), false);
});

test("the genre has to be one the interface can render", () => {
  for (const genre of GENRES) {
    assert.equal(isValidMoment({ ...good, genre }), true, `rejected a listed genre: ${genre}`);
  }
  assert.equal(isValidMoment({ ...good, genre: "sea shanty" }), false);
});

test("a clip id is either absent or exactly an id", () => {
  assert.equal(isValidMoment({ ...good, videoId: "dQw4w9WgXcQ" }), true);
  assert.equal(isValidMoment({ ...good, videoId: "https://youtu.be/dQw4w9WgXcQ" }), false, "a link, not an id");
  assert.equal(isValidMoment({ ...good, videoId: undefined }), false, "absent means null, explicitly");
});

test("a story has a ceiling, so one link cannot carry a novel", () => {
  assert.equal(isValidMoment({ ...good, story: "x".repeat(600) }), true);
  assert.equal(isValidMoment({ ...good, story: "x".repeat(601) }), false);
  assert.equal(isValidMoment({ ...good, story: "" }), true, "a moment can be pinned without words");
});

test("every problem is reported at once, not just the first", () => {
  const result = validateMoment({ ...good, artist: "", lat: 300, genre: "polka" });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 3);
});
