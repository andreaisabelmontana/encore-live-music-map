/**
 * The pipeline reads other people's data, which is where the surprises are.
 * These cases are all shapes that MusicBrainz actually returns.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { mainPerformer, normalizeBatch, placeIdOf, shortId, toMoment, yearOf } from "../scripts/ingest/normalize.mjs";
import { backoff, isTransient } from "../scripts/ingest/http.mjs";

const PLACE_ID = "c87467e7-92ab-436a-b40a-6f75a5ee473b";

const context = {
  places: new Map([
    [PLACE_ID, { name: "Coliseo de Puerto Rico", lat: 18.427717, lng: -66.061392, city: "San Juan" }]
  ]),
  artistGenres: new Map([["afbdfac9-2955-4404-ae22-c08bf1c1b51e", { genre: "reggaeton", origin: "San Juan" }]])
};

/**
 * @param {object} [overrides]
 */
const event = (overrides = {}) => ({
  id: "fcb08f2d-a336-423f-acae-350a40181e0e",
  type: "Concert",
  "life-span": { begin: "2022-12-10", end: "2022-12-10" },
  relations: [
    { type: "main performer", artist: { id: "afbdfac9-2955-4404-ae22-c08bf1c1b51e", name: "Don Omar" } },
    { type: "held at", place: { id: PLACE_ID, name: "Coliseo de Puerto Rico" } }
  ],
  ...overrides
});

test("a complete event becomes a moment", () => {
  const result = toMoment(event(), context);
  assert.ok(result.ok);
  assert.deepEqual(result.moment, {
    id: "mb-fcb08f2d",
    artist: "Don Omar",
    venue: "Coliseo de Puerto Rico",
    city: "San Juan",
    year: 2022,
    genre: "reggaeton",
    lat: 18.4277,
    lng: -66.0614,
    videoId: null,
    story: "",
    likes: 0
  });
});

test("coordinates are rounded to venue precision, not stored to fourteen places", () => {
  const result = toMoment(event(), context);
  assert.ok(result.ok);
  assert.equal(String(result.moment.lat).split(".")[1].length, 4);
});

test("the year comes from the start of the run, however the date is written", () => {
  assert.equal(yearOf({ "life-span": { begin: "2022-12-10" } }), 2022);
  assert.equal(yearOf({ "life-span": { begin: "1999" } }), 1999);
  assert.equal(yearOf({ "life-span": { begin: "2005-07" } }), 2005);
  assert.equal(yearOf({ "life-span": {} }), null);
  assert.equal(yearOf({}), null);
  assert.equal(yearOf({ "life-span": { begin: "not a date" } }), null);
});

test("a bill with several acts is filed under the headliner", () => {
  const threeActs = event({
    relations: [
      { type: "support act", artist: { id: "x", name: "Opener" } },
      { type: "main performer", artist: { id: "y", name: "Headliner" } },
      { type: "held at", place: { id: PLACE_ID, name: "Coliseo" } }
    ]
  });
  assert.equal(mainPerformer(threeActs)?.name, "Headliner");
});

test("an event with only a support act still names someone", () => {
  const noHeadliner = event({
    relations: [{ type: "support act", artist: { id: "x", name: "Opener" } }]
  });
  assert.equal(mainPerformer(noHeadliner)?.name, "Opener");
});

test("an event with no performer at all is reported, not guessed at", () => {
  assert.equal(mainPerformer(event({ relations: [] })), null);
  const result = toMoment(event({ relations: [] }), context);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no performer");
});

test("an event held nowhere, or at a venue with no coordinates, is dropped with a reason", () => {
  const noVenue = toMoment(
    event({ relations: [{ type: "main performer", artist: { id: "a", name: "Someone" } }] }),
    context
  );
  assert.equal(noVenue.ok, false);
  assert.equal(noVenue.reason, "no venue");

  const unknownVenue = toMoment(
    event({
      relations: [
        { type: "main performer", artist: { id: "a", name: "Someone" } },
        { type: "held at", place: { id: "not-in-the-table", name: "Somewhere" } }
      ]
    }),
    context
  );
  assert.equal(unknownVenue.ok, false);
  assert.equal(unknownVenue.reason, "venue has no coordinates");
});

test("an artist outside the genre table is filed as other, not dropped", () => {
  const unknownArtist = event({
    relations: [
      { type: "main performer", artist: { id: "unmapped", name: "Someone Else" } },
      { type: "held at", place: { id: PLACE_ID, name: "Coliseo" } }
    ]
  });
  const result = toMoment(unknownArtist, context);
  assert.ok(result.ok);
  assert.equal(result.moment.genre, "other");
});

test("a record that would fail the app's own validator never reaches the dataset", () => {
  const ancient = toMoment(event({ "life-span": { begin: "1650-01-01" } }), context);
  assert.equal(ancient.ok, false);

  const nameless = toMoment(
    event({
      relations: [
        { type: "main performer", artist: { id: "a", name: "x".repeat(200) } },
        { type: "held at", place: { id: PLACE_ID, name: "Coliseo" } }
      ]
    }),
    context
  );
  assert.equal(nameless.ok, false);
});

test("a venue with no city falls back to its own name rather than an empty line", () => {
  const places = new Map([[PLACE_ID, { name: "Red Rocks", lat: 39.6655, lng: -105.2056, city: "" }]]);
  const result = toMoment(event(), { ...context, places });
  assert.ok(result.ok);
  assert.equal(result.moment.city, "Red Rocks");
});

test("placeIdOf reads the held at relation and ignores the rest", () => {
  assert.equal(placeIdOf(event()), PLACE_ID);
  assert.equal(placeIdOf({ relations: [] }), null);
  assert.equal(placeIdOf({}), null);
});

test("short ids are stable, hex, and eight characters", () => {
  assert.equal(shortId("fcb08f2d-a336-423f-acae-350a40181e0e"), "fcb08f2d");
  assert.equal(shortId("fcb08f2d-a336-423f-acae-350a40181e0e"), shortId("fcb08f2d-a336-423f-acae-350a40181e0e"));
  assert.match(shortId("00000000-0000-0000-0000-000000000000"), /^[0-9a-f]{8}$/);
});

test("a batch keeps what it can and counts what it lost", () => {
  const { moments, tally } = normalizeBatch(
    [event(), event({ relations: [] }), event({ "life-span": {} })],
    context
  );
  assert.equal(moments.length, 1);
  assert.deepEqual(tally, { "no performer": 1, "no date": 1 });
});

test("backoff stays flat while a refusal is just congestion", () => {
  for (const attempt of [0, 1, 2, 3]) {
    const wait = backoff(attempt, null);
    assert.ok(wait >= 1200 && wait < 1600, `attempt ${attempt} waited ${wait}`);
  }
});

test("backoff escalates once an endpoint is genuinely stuck, and is capped", () => {
  assert.ok(backoff(4, null) >= 2000 && backoff(4, null) < 2400);
  assert.ok(backoff(6, null) >= 8000 && backoff(6, null) < 8400);
  assert.ok(backoff(20, null) <= 30_400, "capped rather than unbounded");
});

test("a Retry-After header wins, because then it is not a guess", () => {
  assert.equal(backoff(0, "5"), 5000);
  assert.equal(backoff(9, "2"), 2000, "even when it is shorter than the backoff would be");
  assert.equal(backoff(0, "99999"), 30_000, "but not without limit");
});

test("a busy server is worth retrying and a rejected query is not", () => {
  assert.equal(isTransient("The MusicBrainz web server is currently busy. Please try again later."), true);
  assert.equal(isTransient("rate limit exceeded"), true);
  assert.equal(isTransient("Invalid mbid."), false);
  assert.equal(isTransient("invalid query syntax"), false);
});
