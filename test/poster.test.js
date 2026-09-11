import test from "node:test";
import assert from "node:assert/strict";

import { generatePoster, hashString } from "../src/core/poster.js";

/**
 * @param {string} artist
 * @param {string} [venue]
 */
const moment = (artist, venue = "Some Venue") => ({ artist, venue });

test("the same act always prints the same poster", () => {
  assert.equal(generatePoster(moment("Rosalía")), generatePoster(moment("Rosalía")));
});

test("a different act at the same venue prints a different poster", () => {
  assert.notEqual(generatePoster(moment("Rosalía")), generatePoster(moment("Bad Bunny")));
});

test("the same act at a different venue prints a different poster", () => {
  assert.notEqual(
    generatePoster(moment("Rosalía", "Foro Sol")),
    generatePoster(moment("Rosalía", "Palau Sant Jordi"))
  );
});

test("a wall of cards is not a wall of one design", () => {
  const artists = [
    "Bad Bunny", "Beyoncé", "Radiohead", "Kendrick Lamar", "Tame Impala",
    "Daft Punk", "Rosalía", "Arctic Monkeys", "SZA", "Coldplay",
    "Fred again..", "Travis Scott"
  ];
  const posters = new Set(artists.map((artist) => generatePoster(moment(artist))));

  // Twenty combinations over twelve draws will collide sometimes, which is fine.
  // What matters is that the rail does not collapse to two or three designs.
  assert.ok(posters.size >= 9, `only ${posters.size} distinct posters from twelve acts`);
});

test("a poster is a usable inline image, not markup that needs escaping", () => {
  const poster = generatePoster(moment("Bad Bunny"));
  assert.ok(poster.startsWith("data:image/svg+xml;utf8,"));
  assert.ok(!poster.includes("<"), "angle brackets are encoded");
  assert.ok(!poster.includes('"'), "quotes are encoded");
  assert.ok(decodeURIComponent(poster).includes("<svg"));
});

test("a name that would break an attribute cannot break the image", () => {
  const poster = generatePoster(moment('"><script>alert(1)</script>'));
  assert.ok(!poster.includes("<script"));
  assert.ok(poster.startsWith("data:image/svg+xml;utf8,"));
});

test("posters stay small enough to inline on every card", () => {
  assert.ok(generatePoster(moment("Bad Bunny")).length < 2000);
});

test("independent slices of the hash are actually independent", () => {
  // The regression this guards against: without a final avalanche step, the low
  // bits picked the palette and the middle bits picked the composition, but the
  // two moved together, so a rail of twelve cards showed four designs.
  const counts = [0, 0, 0, 0];
  const names = 4000;
  for (let i = 0; i < names; i += 1) {
    counts[(hashString(`Artist ${i}|Venue ${i % 97}`) >>> 11) % 4] += 1;
  }

  for (const [index, count] of counts.entries()) {
    const share = count / names;
    assert.ok(share > 0.2 && share < 0.3, `composition ${index} took ${(share * 100).toFixed(1)}% of names`);
  }
});

test("the hash is stable, non negative, and spreads names out", () => {
  assert.equal(hashString("Bad Bunny"), hashString("Bad Bunny"));
  assert.notEqual(hashString("Bad Bunny"), hashString("Bad Bunnz"));
  assert.ok(hashString("") >= 0);

  const names = Array.from({ length: 200 }, (_, i) => `Artist ${i}`);
  const buckets = new Set(names.map((name) => hashString(name) % 20));
  assert.ok(buckets.size >= 15, `names landed in only ${buckets.size} of twenty buckets`);
});
