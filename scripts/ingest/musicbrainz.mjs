/**
 * MusicBrainz readers.
 *
 * Three passes, because of how the API is shaped rather than by preference:
 *
 *  1. **Places.** The place search returns coordinates. 83,164 places exist and
 *     roughly two in five carry a point, which is the join key for everything
 *     else.
 *  2. **Events.** The event search returns 82,685 concerts with a date, the
 *     performers and the place they were held at, but no coordinates, which is
 *     why pass one exists.
 *  3. **Artists by tag.** Events carry no genre. Enumerating artists per genre
 *     tag builds a lookup that covers the artists anyone searches for, at a cost
 *     of a few dozen requests rather than one per artist.
 *
 * Every pass pages at one hundred records per request through the shared client,
 * so the whole ingest is rate limited and cached as one.
 *
 * @module ingest/musicbrainz
 */

const API = "https://musicbrainz.org/ws/2";

/**
 * Where this app's genre names differ from the tag MusicBrainz files them under.
 * Tags are quoted in the query regardless, because an unquoted hyphen is a NOT
 * operator in the search syntax and an unquoted ampersand ends the term.
 *
 * @type {Record<string, string>}
 */
const MB_TAGS = {
  "hip-hop": "hip hop"
};

/** Collective credits that are not a performer anybody remembers seeing. */
const NOT_AN_ARTIST = new Set(["Various Artists", "[unknown]", "[no artist]"]);
const PAGE = 100;

/**
 * The slice of the HTTP client these readers need. Taking the narrow shape
 * rather than the concrete client is what lets a test hand them a fake.
 *
 * @typedef {{ getJson: (url: string) => Promise<any> }} Client
 */

/**
 * Walk a paged search endpoint, yielding one page at a time so the caller can
 * stream results instead of holding every page in memory.
 *
 * @param {Client} client
 * @param {string} path
 * @param {string} query
 * @param {string} collection Key the records live under in the response.
 * @param {number} maxPages
 * @param {(page: number, total: number) => void} [onPage]
 * @returns {AsyncGenerator<any[]>}
 */
async function* pages(client, path, query, collection, maxPages, onPage) {
  let offset = 0;
  let total = Infinity;
  let page = 0;

  while (offset < total && page < maxPages) {
    const url = `${API}/${path}?query=${encodeURIComponent(query)}&limit=${PAGE}&offset=${offset}&fmt=json`;
    const body = await client.getJson(url);
    total = Number(body.count) || 0;
    const records = body[collection] ?? [];
    if (records.length === 0) return;

    page += 1;
    onPage?.(page, Math.ceil(total / PAGE));
    yield records;
    offset += records.length;
  }
}

/**
 * Every place that has a point on the earth, as an id keyed lookup.
 *
 * @param {Client} client
 * @param {number} maxPages
 * @param {(page: number, total: number) => void} [onPage]
 * @returns {Promise<Map<string, {name: string, lat: number, lng: number, city: string}>>}
 */
export async function fetchPlaces(client, maxPages, onPage) {
  /** @type {Map<string, {name: string, lat: number, lng: number, city: string}>} */
  const places = new Map();

  for await (const batch of pages(client, "place", "*", "places", maxPages, onPage)) {
    for (const place of batch) {
      const lat = Number(place?.coordinates?.latitude);
      const lng = Number(place?.coordinates?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      places.set(place.id, {
        name: String(place.name ?? ""),
        lat,
        lng,
        city: String(place?.area?.name ?? "")
      });
    }
  }

  return places;
}

/**
 * Concerts, streamed a page at a time.
 *
 * @param {Client} client
 * @param {number} maxPages
 * @param {(page: number, total: number) => void} [onPage]
 * @returns {AsyncGenerator<any[]>}
 */
export function fetchConcerts(client, maxPages, onPage) {
  return pages(client, "event", "type:concert", "events", maxPages, onPage);
}

/**
 * Artist id to genre, built from the genres the interface offers.
 *
 * The first tag to claim an artist wins, and the genres are walked in the order
 * given, so a more specific genre listed first keeps its artists. Origin comes
 * along for free and feeds the sound map.
 *
 * @param {Client} client
 * @param {string[]} genres
 * @param {number} perGenre How many artists to take per genre.
 * @param {(genre: string, count: number) => void} [onGenre]
 * @returns {Promise<Map<string, {genre: string, origin: string}>>}
 */
export async function fetchArtistGenres(client, genres, perGenre, onGenre) {
  /** @type {Map<string, {genre: string, origin: string}>} */
  const byArtist = new Map();

  for (const genre of genres) {
    const maxPages = Math.ceil(perGenre / PAGE);
    let found = 0;

    const tag = MB_TAGS[genre] ?? genre;

    for await (const batch of pages(client, "artist", `tag:"${tag}"`, "artists", maxPages)) {
      for (const artist of batch) {
        if (byArtist.has(artist.id) || NOT_AN_ARTIST.has(artist.name)) continue;
        byArtist.set(artist.id, {
          genre,
          origin: String(artist?.["begin-area"]?.name ?? artist?.area?.name ?? "")
        });
        found += 1;
      }
    }

    onGenre?.(genre, found);
  }

  return byArtist;
}
