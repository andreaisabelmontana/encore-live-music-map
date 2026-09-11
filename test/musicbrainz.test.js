/**
 * The paging and failure handling of the readers, with a fake client.
 *
 * The readers take the HTTP client as an argument rather than importing one,
 * which is what lets these run with no network, no mocking library and no
 * waiting: the fake can return pages, throw, or run out on demand.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { fetchArtistGenres, fetchPlaces, skipped } from "../scripts/ingest/musicbrainz.mjs";

/**
 * A client that serves canned pages and can be told to fail on some of them.
 *
 * @param {object} options
 * @param {number} options.total          How many records the endpoint claims to hold.
 * @param {(offset: number) => any[]} options.page
 * @param {Set<number>} [options.failAt]  Offsets that always throw.
 * @param {string} options.collection
 */
function fakeClient(options) {
  /** @type {number[]} */
  const calls = [];
  return {
    calls,
    /** @param {string} url */
    async getJson(url) {
      const offset = Number(new URL(url).searchParams.get("offset"));
      calls.push(offset);
      if (options.failAt?.has(offset)) throw new Error(`503 for ${url}`);
      return { count: options.total, [options.collection]: options.page(offset) };
    }
  };
}

/**
 * @param {number} offset
 * @param {number} size
 */
const placePage = (offset, size = 100) =>
  Array.from({ length: size }, (_, i) => ({
    id: `place-${offset + i}`,
    name: `Venue ${offset + i}`,
    coordinates: { latitude: 40 + i / 1000, longitude: -3 - i / 1000 },
    area: { name: "Madrid" }
  }));

test("paging walks the whole result set and stops when it runs out", async () => {
  const client = fakeClient({
    total: 250,
    collection: "places",
    page: (offset) => (offset >= 250 ? [] : placePage(offset, Math.min(100, 250 - offset)))
  });

  const places = await fetchPlaces(client, 50);

  assert.equal(places.size, 250);
  assert.deepEqual(client.calls, [0, 100, 200]);
});

test("paging respects the page cap, so a development run stays short", async () => {
  const client = fakeClient({ total: 10_000, collection: "places", page: (offset) => placePage(offset) });

  const places = await fetchPlaces(client, 3);

  assert.equal(places.size, 300);
  assert.equal(client.calls.length, 3);
});

test("a venue with no coordinates is left out, because it cannot go on a map", async () => {
  const client = fakeClient({
    total: 3,
    collection: "places",
    page: () => [
      { id: "a", name: "Has a point", coordinates: { latitude: "40.1", longitude: "-3.7" }, area: { name: "Madrid" } },
      { id: "b", name: "No point" },
      { id: "c", name: "Broken point", coordinates: { latitude: "north", longitude: "west" } }
    ]
  });

  const places = await fetchPlaces(client, 1);

  assert.equal(places.size, 1);
  assert.deepEqual(places.get("a"), { name: "Has a point", lat: 40.1, lng: -3.7, city: "Madrid" });
});

test("one page that will not load does not discard the pages behind it", async () => {
  const before = skipped.pages;
  const client = fakeClient({
    total: 400,
    collection: "places",
    page: (offset) => (offset >= 400 ? [] : placePage(offset)),
    failAt: new Set([100])
  });

  const places = await fetchPlaces(client, 10);

  assert.equal(places.size, 300, "three pages survive, one is lost");
  assert.equal(skipped.pages - before, 1, "and the loss is counted");
  assert.ok(client.calls.includes(200), "paging carried on past the failure");
});

test("an endpoint that is genuinely gone ends the pass instead of retrying forever", async () => {
  const client = fakeClient({
    total: 100_000,
    collection: "places",
    page: (offset) => placePage(offset),
    failAt: new Set(Array.from({ length: 200 }, (_, i) => i * 100))
  });

  const places = await fetchPlaces(client, 500);

  assert.equal(places.size, 0);
  assert.ok(client.calls.length <= 10, `gave up after ${client.calls.length} pages`);
});

test("the genre lookup keeps the first tag to claim an artist", async () => {
  const client = {
    /** @param {string} url */
    async getJson(url) {
      const tag = decodeURIComponent(url).match(/tag:"([^"]+)"/)?.[1];
      return {
        count: 2,
        artists: [
          { id: "shared", name: "Genre Crosser", "begin-area": { name: "Bogotá" } },
          { id: `${tag}-only`, name: `${tag} artist`, area: { name: "Lisbon" } }
        ]
      };
    }
  };

  const genres = await fetchArtistGenres(client, ["reggaeton", "pop"], 100);

  assert.equal(genres.get("shared")?.genre, "reggaeton", "the first genre asked for wins");
  assert.equal(genres.get("shared")?.origin, "Bogotá", "origin comes along for the sound map");
  assert.equal(genres.get("pop-only")?.genre, "pop");
});

test("collective credits are not treated as performers", async () => {
  const client = {
    async getJson() {
      return {
        count: 2,
        artists: [
          { id: "various", name: "Various Artists" },
          { id: "real", name: "A Real Band" }
        ]
      };
    }
  };

  const genres = await fetchArtistGenres(client, ["rock"], 100);

  assert.equal(genres.has("various"), false);
  assert.equal(genres.has("real"), true);
});
