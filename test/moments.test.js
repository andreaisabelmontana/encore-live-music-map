import test from "node:test";
import assert from "node:assert/strict";

import {
  applyLikeBumps,
  distanceKm,
  filterMoments,
  genresOf,
  matchesQuery,
  normalize,
  sortByDistanceFrom,
  sortByLove,
  sortByRecency
} from "../src/core/moments.js";

/**
 * @param {Partial<import("../src/core/types.js").Moment>} overrides
 * @returns {import("../src/core/types.js").Moment}
 */
const moment = (overrides = {}) => ({
  id: 1,
  artist: "Rosalía",
  venue: "Foro Sol",
  city: "Mexico City",
  year: 2023,
  genre: "latin",
  lat: 19.4045,
  lng: -99.0907,
  videoId: null,
  story: "the roof came off",
  likes: 10,
  ...overrides
});

test("normalize strips accents and case so search works on plain keyboards", () => {
  assert.equal(normalize("Rosalía"), "rosalia");
  assert.equal(normalize("  BEYONCÉ "), "beyonce");
  assert.equal(normalize("Estadio Maracanã"), "estadio maracana");
});

test("matchesQuery looks across artist, city and venue", () => {
  const m = moment();
  assert.ok(matchesQuery(m, "rosalia"), "accent free artist name");
  assert.ok(matchesQuery(m, "mexico"), "city");
  assert.ok(matchesQuery(m, "foro"), "venue");
  assert.ok(matchesQuery(m, ""), "an empty query matches everything");
  assert.equal(matchesQuery(m, "glastonbury"), false);
});

test("matchesQuery ignores fields a visitor would not search by", () => {
  assert.equal(matchesQuery(moment(), "the roof came off"), false, "story text is not searched");
  assert.equal(matchesQuery(moment(), "latin"), false, "genre has its own filter");
});

test("filterMoments combines the genre chip and the search box", () => {
  const all = [
    moment({ id: 1, genre: "latin", artist: "Rosalía" }),
    moment({ id: 2, genre: "rock", artist: "Arctic Monkeys", city: "Sydney" }),
    moment({ id: 3, genre: "rock", artist: "Radiohead", city: "Pilton" })
  ];

  assert.equal(filterMoments(all).length, 3, "no filters means everything");
  assert.equal(filterMoments(all, { genre: "rock" }).length, 2);
  assert.equal(filterMoments(all, { genre: "rock", query: "sydney" }).length, 1);
  assert.equal(filterMoments(all, { genre: "latin", query: "sydney" }).length, 0);
});

test("sortByLove ranks by hearts, newest first on a tie", () => {
  const ranked = sortByLove([
    moment({ id: 1, likes: 5 }),
    moment({ id: 9, likes: 40 }),
    moment({ id: 7, likes: 40 })
  ]);
  assert.deepEqual(
    ranked.map((m) => m.id),
    [9, 7, 1]
  );
});

test("sortByLove does not mutate its input", () => {
  const input = [moment({ id: 1, likes: 1 }), moment({ id: 2, likes: 99 })];
  sortByLove(input);
  assert.deepEqual(
    input.map((m) => m.id),
    [1, 2]
  );
});

test("genresOf always offers a reset and never repeats a genre", () => {
  const genres = genresOf([
    moment({ genre: "rock" }),
    moment({ genre: "pop" }),
    moment({ genre: "rock" })
  ]);
  assert.deepEqual(genres, ["all", "rock", "pop"]);
});

test("applyLikeBumps folds stored hearts into seed moments", () => {
  const [seed] = applyLikeBumps([moment({ id: 4, likes: 100 })], { 4: 3 });
  assert.equal(seed.likes, 103);
});

test("applyLikeBumps leaves your own pins alone, their count is already saved", () => {
  const [mine] = applyLikeBumps([moment({ id: 4, likes: 100, mine: true })], { 4: 3 });
  assert.equal(mine.likes, 100);
});

test("applyLikeBumps returns new objects rather than editing the seed data", () => {
  const seeds = [moment({ id: 4, likes: 100 })];
  const result = applyLikeBumps(seeds, { 4: 3 });
  assert.equal(seeds[0].likes, 100);
  assert.notEqual(result[0], seeds[0]);
});

test("distanceKm measures a known pair within a kilometre", () => {
  const madrid = { lat: 40.4168, lng: -3.7038 };
  const barcelona = { lat: 41.3874, lng: 2.1686 };
  assert.ok(Math.abs(distanceKm(madrid, barcelona) - 505) < 5);
  assert.equal(distanceKm(madrid, madrid), 0);
});

test("sortByRecency puts the most recent night first", () => {
  const ranked = sortByRecency([
    moment({ id: 1, year: 2006 }),
    moment({ id: 2, year: 2023 }),
    moment({ id: 3, year: 2017 })
  ]);
  assert.deepEqual(ranked.map((m) => m.year), [2023, 2017, 2006]);
});

test("two moments from the same year break the tie on identity", () => {
  const ranked = sortByRecency([
    moment({ id: 1, year: 2023 }),
    moment({ id: 1735689600000, year: 2023, mine: true })
  ]);
  assert.equal(ranked[0].mine, true, "a moment you pinned sorts above a seed from the same year");
});

test("sortByDistanceFrom orders by how far away the night happened", () => {
  const madrid = { lat: 40.4168, lng: -3.7038 };
  const ranked = sortByDistanceFrom(
    [
      moment({ id: 1, lat: -34.6037, lng: -58.3816 }),
      moment({ id: 2, lat: 41.3874, lng: 2.1686 }),
      moment({ id: 3, lat: 51.5074, lng: -0.1278 })
    ],
    madrid
  );
  assert.deepEqual(ranked.map((m) => m.id), [2, 3, 1], "Barcelona, then London, then Buenos Aires");
});

test("neither ordering mutates what it was given", () => {
  const input = [moment({ id: 1, year: 2006 }), moment({ id: 2, year: 2023 })];
  sortByRecency(input);
  sortByDistanceFrom(input, { lat: 0, lng: 0 });
  assert.deepEqual(input.map((m) => m.id), [1, 2]);
});
