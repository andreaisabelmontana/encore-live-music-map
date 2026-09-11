# The look

ENCORE is about the shows that mattered to someone, so it should look like the
posters people keep from them, not like a dashboard. Four rules do the work, and
every choice in `style.css` traces back to one of them.

## 1. Ink and paper, two accents, no more

A near black ground, one hot pink, one acid green. The old build leaned on a
three stop pink to purple to blue gradient, which is what a design reaches for
when the type is not carrying its weight. Now the gradient is gone from the
interface and colour means something: acid is the current state, pink is the
action, green belongs to the listening panel and nowhere else.

## 2. Printed, not rendered

Screen printing has no soft shadows, no blur and no rounded corners. So:

- corners are four pixels, close enough to square to read as cut paper
- shadows are hard offsets in flat colour, never a soft grey haze
- the wordmark and every large heading are set twice, slightly out of register,
  the way a two colour print misaligns
- halftone dots sit over the artwork and film grain sits over the whole page

## 3. Type is the artwork

Three faces, each with one job.

| Face | Job |
|---|---|
| Anton | Poster type. Artist names, headings, counts. Huge, tight, uppercase. |
| Space Grotesk | The interface. Labels, fields, metadata. |
| Caveat | The margin. Stories, hints, notes, the things a person wrote. |

The last one matters more than it looks. A story about a night someone
remembers should not be set in the same face as a form label, and putting it in
handwriting says it came from a person without saying so.

## 4. Pinned up by hand

Nothing sits perfectly square. Cards hang at a degree or so, alternating, with a
strip of tape over the top. Genre chips tilt the other way. Hover straightens the
card and lifts it off the wall.

## Generated artwork

Most moments have no clip, so most cards have no photograph. Rather than repeat
one grey placeholder down the rail, every moment prints its own poster from its
own name: four compositions, five palettes, a halftone at an angle that never
lines up with the pixel grid. The same act always gets the same poster.

That code is in `src/core/poster.js` and it is pure, which is how a bug in it got
caught by a test rather than by eye. The first version derived the palette and
the composition from neighbouring bits of the same weak hash, so the two moved
together and twelve cards shared four designs. Adding an avalanche step fixed it,
and a test now asserts that each design takes between a fifth and a third of four
thousand names.

## Motion

Movement is the mood here, and for some people it is a reason to close the tab.
Every animation is behind `prefers-reduced-motion`, and none of them moves
anything a person is reading.

| Where | What | Why |
|---|---|---|
| Intro | A light sweeps the poster, the wordmark drifts out of register | Sets the room before the map |
| Feed | Cards pin up in a short stagger | The rail assembles rather than appears |
| Card | Straightens, lifts, poster scales under the crop | Answers the pointer without moving the text |
| Pin | A ring pulses out, the thumbnail pops on hover | Draws the eye to a place, not to itself |
| Moment | The panel lands slightly crooked, then settles | A poster slapped against a wall |
| Heart | One thump, restarted on every press | The only feedback that a count changed |
| Ticker | A continuous run of dates along the bottom | A tour list, and it pauses on hover |

## What the look is not allowed to cost

- **Contrast.** Acid on near black and paper on near black both clear the
  accessible contrast threshold at the sizes they are used.
- **Focus.** Every interactive element keeps a visible focus ring, in acid, at
  three pixels. Tilting a card never removes it.
- **Reading order.** Nothing is reordered visually away from its place in the
  document.
- **Attribution.** The ticker runs along the bottom of the window, so the map
  attribution is lifted above it rather than covered. Tile licences are a
  condition, not a detail.
- **High contrast mode.** Under `forced-colors`, the duotone and halftone layers
  are dropped and every surface takes a system border.
