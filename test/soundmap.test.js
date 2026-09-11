import test from "node:test";
import assert from "node:assert/strict";

import { glowSize, leaderOf, minutesBy, rankByMinutes, summarize } from "../src/core/soundmap.js";

/** @type {import("../src/core/types.js").ListeningArtist[]} */
const profile = [
  { artist: "Bad Bunny", origin: "San Juan, PR", country: "Puerto Rico", genre: "reggaeton", lat: 18.46, lng: -66.1, minutes: 4000 },
  { artist: "Karol G", origin: "Medellin, CO", country: "Colombia", genre: "reggaeton", lat: 6.24, lng: -75.58, minutes: 2000 },
  { artist: "SZA", origin: "St. Louis, US", country: "USA", genre: "r&b", lat: 38.62, lng: -90.19, minutes: 1800 },
  { artist: "Frank Ocean", origin: "New Orleans, US", country: "USA", genre: "r&b", lat: 29.95, lng: -90.07, minutes: 1200 }
];

test("minutes add up per country and per genre", () => {
  assert.deepEqual(minutesBy(profile, "country"), {
    "Puerto Rico": 4000,
    Colombia: 2000,
    USA: 3000
  });
  assert.deepEqual(minutesBy(profile, "genre"), { reggaeton: 6000, "r&b": 3000 });
});

test("the leader is the largest total, not the most entries", () => {
  assert.equal(leaderOf(minutesBy(profile, "country")), "Puerto Rico", "two USA artists still lose on minutes");
  assert.equal(leaderOf({}), "", "an empty profile has no leader");
});

test("ties break alphabetically so the panel never flickers between renders", () => {
  assert.equal(leaderOf({ Spain: 100, Chile: 100 }), "Chile");
});

test("summarize produces every number the panel shows", () => {
  assert.deepEqual(summarize(profile), {
    artists: 4,
    countries: 3,
    hours: 150,
    totalMinutes: 9000,
    topCountry: "Puerto Rico",
    topGenre: "reggaeton"
  });
});

test("summarize survives an empty profile instead of dividing by zero", () => {
  const summary = summarize([]);
  assert.equal(summary.artists, 0);
  assert.equal(summary.hours, 0);
  assert.equal(summary.topCountry, "");
});

test("glow size scales with minutes and stays inside its bounds", () => {
  assert.equal(glowSize(4000, 4000), 76, "the heaviest listened artist gets the largest pin");
  assert.equal(glowSize(0, 4000), 30, "and the lightest is still clickable");
  assert.ok(glowSize(2000, 4000) > 30 && glowSize(2000, 4000) < 76);
  assert.equal(glowSize(9999, 4000), 76, "an outlier cannot swallow the map");
  assert.equal(glowSize(100, 0), 30, "an empty profile does not divide by zero");
});

test("rankByMinutes orders the list heaviest first without touching the input", () => {
  const ranked = rankByMinutes(profile);
  assert.deepEqual(
    ranked.map((a) => a.artist),
    ["Bad Bunny", "Karol G", "SZA", "Frank Ocean"]
  );
  assert.equal(profile[0].artist, "Bad Bunny");
});
