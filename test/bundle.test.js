import test from "node:test";
import assert from "node:assert/strict";

import { BUNDLE_VERSION, isBundle, pack, unpack } from "../src/core/bundle.js";

/**
 * @param {Partial<import("../src/core/types.js").Moment>} overrides
 * @returns {import("../src/core/types.js").Moment}
 */
const performance = (overrides = {}) => ({
  id: "mb-a1b2c3d4",
  artist: "Bad Bunny",
  venue: "Estadio River Plate",
  city: "Buenos Aires",
  year: 2022,
  genre: "reggaeton",
  lat: -34.5453,
  lng: -58.4498,
  videoId: null,
  story: "",
  likes: 0,
  ...overrides
});

test("a packed dataset unpacks to what went into it", () => {
  const input = [
    performance(),
    performance({ id: "mb-11111111", artist: "Rosalía", genre: "latin", venue: "Foro Sol", city: "Mexico City", lat: 19.4045, lng: -99.0907, year: 2023 })
  ];

  const restored = unpack(pack(input));

  assert.equal(restored.length, 2);
  assert.deepEqual(restored[0], input[0]);
  assert.deepEqual(restored[1], input[1]);
});

test("repeated names are stored once, which is the whole point of the format", () => {
  const many = Array.from({ length: 50 }, (_, i) =>
    performance({ id: `mb-${String(i).padStart(8, "0")}`, year: 2000 + (i % 20) })
  );

  const bundle = pack(many);

  assert.equal(bundle.artists.length, 1, "one artist name for fifty rows");
  assert.equal(bundle.venues.length, 1);
  assert.equal(bundle.genres.length, 1);
  assert.equal(bundle.rows.length, 50 * 4);
});

test("packing is much smaller than the obvious representation", () => {
  const many = Array.from({ length: 500 }, (_, i) =>
    performance({ id: `mb-${String(i).padStart(8, "0")}`, year: 1990 + (i % 30) })
  );

  const packed = JSON.stringify(pack(many)).length;
  const plain = JSON.stringify(many).length;

  assert.ok(packed < plain / 4, `packed ${packed} should be far under plain ${plain}`);
});

test("two venues sharing a name but not a location stay separate", () => {
  const bundle = pack([
    performance({ venue: "The Forum", city: "Los Angeles", lat: 33.9583, lng: -118.3417 }),
    performance({ id: "mb-22222222", venue: "The Forum", city: "London", lat: 51.5674, lng: -0.1394 })
  ]);

  assert.equal(bundle.venues.length, 2);
  const restored = unpack(bundle);
  assert.equal(restored[0].city, "Los Angeles");
  assert.equal(restored[1].city, "London");
});

test("ids survive the round trip, because share links are built from them", () => {
  const restored = unpack(pack([performance({ id: "mb-deadbeef" })]));
  assert.equal(restored[0].id, "mb-deadbeef");
});

test("an empty dataset packs and unpacks without special cases", () => {
  const bundle = pack([]);
  assert.deepEqual(bundle.rows, []);
  assert.deepEqual(unpack(bundle), []);
});

test("a bundle from a future version is refused rather than misread", () => {
  const bundle = pack([performance()]);
  assert.deepEqual(unpack({ ...bundle, v: BUNDLE_VERSION + 1 }), []);
  assert.equal(isBundle({ ...bundle, v: BUNDLE_VERSION + 1 }), false);
});

test("a truncated or malformed bundle yields nothing instead of throwing", () => {
  const bundle = pack([performance(), performance({ id: "mb-33333333" })]);

  assert.deepEqual(unpack({ ...bundle, rows: bundle.rows.slice(0, 5) }), [], "rows not a multiple of the stride");
  assert.deepEqual(unpack(null), []);
  assert.deepEqual(unpack("performances"), []);
  assert.deepEqual(unpack({}), []);
  assert.deepEqual(unpack({ ...bundle, artists: "Bad Bunny" }), []);
});

test("a row pointing outside the dictionaries is skipped, not rendered as undefined", () => {
  const bundle = pack([performance(), performance({ id: "mb-44444444" })]);
  bundle.rows[0] = 99;

  const restored = unpack(bundle);
  assert.equal(restored.length, 1, "the good row survives");
  assert.equal(restored[0].artist, "Bad Bunny");
});

test("the bundle records where and when it came from", () => {
  const bundle = pack([performance()], { generated: "2026-09-11", source: "MusicBrainz" });
  assert.equal(bundle.generated, "2026-09-11");
  assert.equal(bundle.source, "MusicBrainz");
});
