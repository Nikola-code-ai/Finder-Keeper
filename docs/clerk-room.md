# Across the Keeper’s counter

The working UI at `/` and `/clerk-room` presents the friendly elderly shopkeeper
from a visitor’s perspective, facing his glasses, white hair and beard across the
counter. `/classic` preserves the previous bookseller design. The real backend,
collection scope, reader, citations, imports, and request cancellation all remain
owned by `LibraryApp`.

## Three animated styles

| Style | Direct route | Animation and source |
| --- | --- | --- |
| Ghibli-inspired ink illustration | `/clerk-room?style=illustrated` | Generated pencil room and character parts, articulated with sleeves, hands, legs, papers, book and spider in `components/clerk-illustrated-scene.tsx`; assets/provenance under `front-illustrated` |
| Native Blender | `/clerk-room?style=blender` | Native modeled elderly clerk, limbs, props and spider; editable `art/clerk-room/front-blender/shopkeeper.blend` and deterministic authoring script; rendered WebP animation atlases |
| Detailed pixel art | `/clerk-room?style=pixel` | Original 768×512 Canvas pixel drawing in `components/clerk-pixel-scene.tsx`, with articulated arms, legs, head, hands, pages and eight spider legs |

The illustrated look is a layered 2D puppet. The pixel scene is drawn directly as
pixel art. Blender is a rendered native 3D animation, not an interactive WebGL or
Unity renderer. None of the three uses the previous whole-room pose swaps or
floating page/paper icons. Earlier overhead assets remain available as source
history but are not displayed in the new room.

## Request choreography

`lib/clerk-animation.ts` owns the visual sequence; `KeeperActivity` remains the
source of truth for request status. The animation clock never finishes a backend
request or gates displaying its results.

- Discover: reach and release the spider, followed by a crawling web-search loop.
- Search/import: get up and walk left, lift/check papers, carry them back, present.
- Ask: look down, follow the text, reach across the book and turn its page, present.
- Success: return/presentation gesture; empty findings receive an open-handed
  response. Errors and cancellation immediately end the request; existing travel settles back to the chair without entering another work loop.
- Fast successful requests can finish a short physical gesture after the status
  and results are already ready. A new request immediately replaces that gesture.
- Pausing freezes the visual clock while requests continue. Reduced motion uses a
  meaningful static work pose and returns to idle on completion. Hidden tabs stop
  advancing the visual clock.

The isolated scene updates at 24 Hz; the pixel and Blender drawings use 12 poses
per second. The surrounding form/results tree does not redraw on every frame.
Only the selected style loads its visual assets. Blender keeps at most the current
atlas, idle atlas and next likely action in its decoded cache; its welcoming poster
remains visible during initial loading. Success and unsuccessful web requests have
separate spider-return clips, so cancellation does not offer a success paper.

**Watch his routine** opens optional movement previews. These have an explicit
preview label, use the same renderer, make no API requests, and yield immediately
to real work. They are disabled when reduced motion is enabled.

## Room interaction

- Spider/window: online discovery.
- Left document desks: saved-passage search.
- Open book: grounded answers using saved sources.
- Shelves/library pin: actual collections and documents, with scoped document count.
- Header library count: the whole library.
- Style selection: preserves query, collection, request, results and motion clock;
  stored locally with a direct `?style=` route for comparison.
- Escape: closes a side panel unless an open reader/edit/import dialog owns it.

## Validation, 20 October 2026

- Production build and TypeScript check passed.
- 36 targeted tests passed across `clerk-animation.test.mjs`, `clerk-room.test.mjs`,
  and `keeper-request.test.mjs`. Coverage includes phase ordering, fast responses,
  empty findings, cancellation/error, interrupted travel, replacement by a new
  request, and reduced-motion poses.
- Live illustrated search returned eight saved passages for “false sharing” while
  the character returned from the desk. A pixel-mode question returned a real
  answer with linked source passages.
- Pausing held exactly the same phase/time while a real request completed and
  findings appeared. Resuming advanced the physical sequence. Web cancellation
  immediately ended request activity.
- Inspected the illustrated document gesture, pixel document gesture and native
  Blender page turn in the browser. Native Blender motion is also audited against
  the saved scene’s animated object transforms.
- The 390 × 844 phone layout has no horizontal overflow. Style changes retain the
  current query and request. Fresh browser logs were clear after the illustrated
  SVG rounding fix for server/client floating-point differences.

Live import mutation, reduced-motion OS emulation, and cloud deployment were not
part of this browser verification; reduced-motion selection is covered by the
pure lifecycle tests.
