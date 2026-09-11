import test from "node:test";
import assert from "node:assert/strict";

import { decodeMoment, encodeMoment, parseHash, shareUrlFor } from "../src/core/share.js";

/** @type {import("../src/core/types.js").Moment} */
const pinned = {
  id: 1735689600000,
  artist: "Rosalía",
  venue: "Palau Sant Jordi",
  city: "Barcelona",
  year: 2022,
  genre: "latin",
  lat: 41.3639,
  lng: 2.1526,
  videoId: null,
  story: "MOTOMAMI at home. 17,000 people doing the choreography.",
  likes: 1,
  mine: true
};

test("a pinned moment survives a round trip through a link", () => {
  const decoded = decodeMoment(encodeMoment(pinned));
  assert.ok(decoded);
  assert.equal(decoded.artist, pinned.artist);
  assert.equal(decoded.venue, pinned.venue);
  assert.equal(decoded.city, pinned.city);
  assert.equal(decoded.year, pinned.year);
  assert.equal(decoded.genre, pinned.genre);
  assert.equal(decoded.story, pinned.story);
  assert.equal(decoded.lat, pinned.lat);
  assert.equal(decoded.lng, pinned.lng);
});

test("non ASCII text survives, which plain btoa would have mangled", () => {
  const decoded = decodeMoment(
    encodeMoment({ ...pinned, artist: "坂本龍一", story: "ピアノ, 東京, 雨 — ✦" })
  );
  assert.ok(decoded);
  assert.equal(decoded.artist, "坂本龍一");
  assert.equal(decoded.story, "ピアノ, 東京, 雨 — ✦");
});

test("payloads are base64url, safe to paste into a chat window", () => {
  const payload = encodeMoment({ ...pinned, story: "?".repeat(40) });
  assert.match(payload, /^[A-Za-z0-9_-]+$/);
});

test("a clip id rides along only when there is one", () => {
  assert.equal(decodeMoment(encodeMoment(pinned))?.videoId, null);
  assert.equal(decodeMoment(encodeMoment({ ...pinned, videoId: "dQw4w9WgXcQ" }))?.videoId, "dQw4w9WgXcQ");
});

test("a decoded moment is never trusted as the pinner left it", () => {
  const decoded = decodeMoment(encodeMoment(pinned));
  assert.equal(decoded?.id, "shared", "identity is assigned locally, not taken from the link");
  assert.equal(decoded?.likes, 1, "a link cannot inflate a heart count");
  assert.equal(decoded?.mine, undefined, "a link cannot claim to be your own pin");
});

test("garbage in the address bar decodes to nothing, never to a broken moment", () => {
  for (const payload of ["", "not-base64!!", "eyJhIjoi", "%%%", "a".repeat(5000)]) {
    assert.equal(decodeMoment(payload), null, `rejected: ${payload.slice(0, 20)}`);
  }
});

test("a payload that decodes but breaks the rules is rejected", () => {
  const offMap = encodeMoment({ ...pinned, lat: 91, lng: 0 });
  assert.equal(decodeMoment(offMap), null, "latitude past the pole");

  const noArtist = encodeMoment({ ...pinned, artist: "" });
  assert.equal(decodeMoment(noArtist), null, "a moment with no performer");

  const unknownGenre = encodeMoment({ ...pinned, genre: "sea shanty" });
  assert.equal(decodeMoment(unknownGenre), null, "a genre the UI cannot render");
});

test("a script tag in a story stays inert text, it does not become markup", () => {
  const decoded = decodeMoment(encodeMoment({ ...pinned, story: "<img src=x onerror=alert(1)>" }));
  assert.equal(decoded?.story, "<img src=x onerror=alert(1)>");
});

test("seed moments share by id, your own pins carry themselves", () => {
  const context = {
    origin: "https://andreaisabelmontana.github.io",
    pathname: "/encore-live-music-map/",
    seedIds: new Set([1, 2, 3])
  };

  assert.equal(
    shareUrlFor({ ...pinned, id: 2 }, context),
    "https://andreaisabelmontana.github.io/encore-live-music-map/#m=2"
  );
  assert.match(
    shareUrlFor(pinned, context),
    /^https:\/\/andreaisabelmontana\.github\.io\/encore-live-music-map\/#p=[A-Za-z0-9_-]+$/
  );
});

test("parseHash reads the two link shapes and refuses the rest", () => {
  assert.deepEqual(parseHash("#m=7"), { kind: "seed", id: "7" });
  assert.deepEqual(parseHash("#p=abc-DEF_123"), { kind: "packed", payload: "abc-DEF_123" });
  for (const hash of ["", "#", "#m=", "#m=abc", "#p=", "#other", "#p=has spaces"]) {
    assert.equal(parseHash(hash), null, `rejected: ${hash}`);
  }
});
