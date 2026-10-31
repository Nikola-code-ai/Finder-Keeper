# Keeper motion v3

48 original raster drawings for the weary sketch clerk. Generated with the built-in image-generation tool, then extracted, uniformly resized, and placed on transparent 256×320 canvases. No painted in-betweens, mirrored substitutes for the other leg, or pose crossfades.

| State | Drawings | Cycle | Intended use |
| --- | ---: | --- | --- |
| walk | 12 | Two opposite steps | Sideward travel |
| away | 8 | Two opposite steps | Travel away from the viewer |
| crawl | 8 | Two diagonal support changes | Actual hands-and-knees travel |
| climb | 12 | Two alternating hand/foot transfers | Ladder ascent/descent |
| picked | 4 | Small asymmetric dangling poses | Mouse pickup |
| landing | 4 | Impact, compression, recovery | Release onto a surface |

The manifest is `public/character-motion-v3/manifest-fragment.json`. The existing manifest and all previous assets are untouched by this package. Each state supplies `frames`, `fps`, `loop`, `anchors`, `frameAnchors`, and `frameContacts`. Locomotion states have `cycleSteps: 2` so the player can derive the complete gait phase from distance instead of restarting the same half-cycle at every step/rung.

`feet` is the common floor/support reference at `[0.5, 0.95]`. In crawl it is the plane below the supporting palms/knees, not an assertion that the shoe tips are the lowest pixels. `nearFoot`/`farFoot` and `nearHand`/`farHand` are the actual inspected shoe/palm landmarks. White limbs are near and pen-hatched limbs are far. `hand` follows the active support hand. `collar` is the pickup attachment. `seat` is a hip guide for these states, not a seated contact. All coordinates are normalized to the whole canvas.

Crawl uses a fixed 0.52 source scale and stays approximately 150–165 pixels tall; it is not enlarged to standing height. Landing also keeps one fixed scale from compressed impact through standing. Walk and climb retain slightly varying drawn heights and the same baseline, preserving body bob rather than normalizing it away.

## Visual audit

The first rear-walk and crawl sheets were rejected. Their successors are the selected `away-source.png` and `crawl-source.png`; the rejected sources remain named `*-rejected-source.png` for provenance. The rear-walk extraction order is `[0, 1, 2, 3, 5, 6, 7, 4]`: the artist's second-row first contact belongs at the end of the foreground-leg return, not the start of the other step.

All six final contact sheets were visually inspected. The clean foreground leg and hatched background leg exchange lead in walk and away. Climb exchanges the high white and high hatched arm and their raised foot support. Crawl has a visibly horizontal body and swaps the leading white and hatched palm with distinct bent-knee positions. Picked poses have genuinely different hanging knees and loose arms; landing compresses before recovering.

The PNGs preserve generated colors and alpha during extraction. Small channel differences remain in source antialiasing (maximum 14/255 in opaque pixels), so the existing renderer's grayscale filter remains required for strictly neutral black-and-white display. There is no added hue, background, painted shadow, or opaque rectangular matte.

## Ladder contact guidance

Across climb frames, the near hand is at x 0.641–0.740, y 0.120–0.434; the far hand is at x 0.606–0.752, y 0.137–0.429. The high grip alternates between those hands. These are well above the previous generic y≈0.53 hand point. Use frame landmarks for rung/rail positioning; pinning only the feet does not by itself make both hands meet a static ladder.

## Reproduce and check

```sh
node art/sketch-motion-v3/package-frames.mjs
node art/sketch-motion-v3/validate-assets.mjs
```

Validation passes for 48 unique decoded drawings, every frame at 256×320, transparent outer edges, substantial opaque/transparent pixels, common support baseline, normalized landmarks, low crawl height, and opposite lead-foot/high-hand landmark phases. `validation.json` records each frame's bounds and color/alpha measurements. These integrity checks complement the contact-sheet review; they do not claim browser physics or interaction validation.

`PROMPTS.md` contains the exact generation prompts and revisions. `packaging.json` contains each source component, crop, scale, offset, support label, and transformed landmarks. Production delivery uses lossless WebP siblings; PNGs are retained for audit and reuse.
