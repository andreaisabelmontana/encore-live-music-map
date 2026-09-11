/**
 * Generated posters.
 *
 * Most moments have no clip attached, so most cards have no photograph. Filling
 * that space with one grey placeholder twelve times over makes the rail look
 * broken. Instead every moment gets its own poster, printed from its own name:
 * the same artist and venue always produce the same artwork, and two different
 * acts almost never collide.
 *
 * The output is an inline SVG data URI, so it costs no request, no library and
 * no canvas. Four compositions and five palettes give twenty combinations, which
 * is enough that a screen full of cards reads as a wall of different posters.
 *
 * This is pure: same input, same string, no DOM. That is what makes it testable.
 *
 * @module core/poster
 */

/**
 * Flat pairs, because a screen print has two inks and the paper.
 * @type {Array<{ ink: string, accent: string }>}
 */
const PALETTES = [
  { ink: "#ff2d78", accent: "#d4ff3f" },
  { ink: "#d4ff3f", accent: "#08080c" },
  { ink: "#2ec5ff", accent: "#ff2d78" },
  { ink: "#f7f4ec", accent: "#ff2d78" },
  { ink: "#8a4bff", accent: "#d4ff3f" }
];

const WIDTH = 320;
const HEIGHT = 220;
const GROUND = "#08080c";

/**
 * A small, stable string hash. Not cryptographic, and it does not need to be:
 * it only has to spread names evenly across twenty designs and give the same
 * answer every time the page loads.
 *
 * The final mixing step is not optional, and leaving it out is exactly the bug
 * this function was written with. Plain FNV leaves its low bits well spread and
 * its middle bits correlated, so pulling one index from `hash % 5` and another
 * from `hash >>> 8` produced twelve cards that shared four designs between them.
 * The avalanche below is murmur3's finaliser: every input bit now affects every
 * output bit, which is what makes independent slices of the result independent.
 *
 * @param {string} value
 * @returns {number} a non negative 32 bit integer
 */
export function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  return hash >>> 0;
}

/**
 * @param {{ ink: string, accent: string }} palette
 * @returns {string[]}
 */
const compositions = (palette) => [
  // A band cut across the poster on the diagonal.
  `<path d="M0 96 L320 24 L320 124 L0 196 Z" fill="${palette.ink}"/>
   <circle cx="252" cy="52" r="26" fill="${palette.accent}"/>`,

  // A sun, or a spotlight, depending on how you read it.
  `<circle cx="160" cy="112" r="82" fill="${palette.ink}"/>
   <rect x="0" y="164" width="320" height="12" fill="${palette.accent}"/>
   <rect x="0" y="184" width="320" height="6" fill="${palette.accent}" opacity="0.6"/>`,

  // Stacked bars, the way a poster stacks the bill.
  `<rect x="0" y="34" width="320" height="26" fill="${palette.ink}"/>
   <rect x="0" y="74" width="248" height="26" fill="${palette.ink}" opacity="0.72"/>
   <rect x="0" y="114" width="176" height="26" fill="${palette.accent}"/>
   <rect x="0" y="154" width="104" height="26" fill="${palette.ink}" opacity="0.45"/>`,

  // A wedge from the corner with a ring cut out of it.
  `<path d="M0 0 L320 0 L320 220 Z" fill="${palette.ink}"/>
   <circle cx="96" cy="150" r="46" fill="none" stroke="${palette.accent}" stroke-width="10"/>`
];

/**
 * Build a poster for a moment.
 *
 * @param {{ artist: string, venue?: string, id?: string|number }} moment
 * @returns {string} an `image/svg+xml` data URI
 */
export function generatePoster(moment) {
  const seed = hashString(`${moment.artist}|${moment.venue ?? ""}`);

  // Three independent choices need three independent parts of the hash. Deriving
  // them from the same low bits correlates the palette with the composition, and
  // a rail of cards then repeats itself visibly.
  const palette = PALETTES[seed % PALETTES.length];
  const shapes = compositions(palette)[(seed >>> 11) % 4];
  // Between eight and twenty three degrees, so the halftone never lines up with
  // the pixel grid and moires.
  const angle = 8 + ((seed >>> 20) % 16);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <defs>
        <pattern id="d" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">
          <circle cx="3" cy="3" r="1.4" fill="#08080c" opacity="0.55"/>
        </pattern>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="${GROUND}"/>
      ${shapes}
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#d)"/>
    </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, " "))}`;
}
