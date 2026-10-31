# Five little worlds — review notes

Local review: October 19, 2026. Entry point: `/ui-studies`. The existing library is still at `/` with a link to these studies.

## Scope

- Five distinct playable scenes with five new lead-character designs and the existing Pip cat.
- Fourteen generated drawings: two poses each for bookseller, wanderer, spider, mage and inventor, plus four spider crawl frames.
- Search runs a clearly labeled scripted example. Reading, drawers, page turns, rain, latch and character interactions use local scene state only.
- Character choices are concept art and limited pose demonstrations, not complete production animation rigs. Combining the selected features with real library operations is a later implementation.

## Verified

- Production build and TypeScript checks pass.
- Browser visual review of all five scenes at desktop and phone widths. Actual inspected CSS viewport widths were 1108 and 390; an additional narrow 300px view was checked for the desk.
- Runtime images load. Transparent source drawings were visually reviewed and packaged using calibrated support anchors; seat contact remains fixed across idle/reading changes.
- Ledge: search sequence, result, collection drawer, seated overlap.
- Panels: page change, Pip close-up, unfolding note; extra mobile clearance avoids character overlap over Pip's control.
- Archive: four-frame crawl, pause/resume with position and frame unchanged while paused, drawer opening and closing after the sample result.
- Window: opening latch reveals page; rain toggles; sill seating and foreground mullion checked.
- Desk: Pip passes the note, note unfolds, sample reader opens/closes, bookmark drawer opens/closes.
- A feature choice survives reload; the temporary QA choice was then removed. No user preferences were selected on their behalf.
- No browser warnings/errors recorded in the final review.

## Implementation safeguards

- Timers and animation frames are cleaned up on unmount, reset and scene change.
- CSS motion and spider travel honor the system reduced-motion setting. The gallery pause freezes ambient animation and crawl motion; sample results still arrive.
- Browser storage failures leave selections usable for the session, with a message to download them before leaving.
- Native dialog supports keyboard focus and Escape. Scene controls and feature choices use native buttons, inputs and checkboxes.

See `art/ui-studies/PROMPTS.md` for exact built-in image-generation prompts and `art/ui-studies/manifest.json` for extraction, scaling, and support measurements. Final sprites live in `public/characters/ui-studies/`.
