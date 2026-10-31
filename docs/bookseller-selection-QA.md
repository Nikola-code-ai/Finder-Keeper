# Selected design: bookseller's ledge + spider

## Current direction: a stationary shopkeeper

The shopkeeper stays seated on the search counter, with the original calibrated hip contact and hanging legs. Opening, switching or closing a collection acts directly on the drawer; no character arrival, ladder route, reach or pull sequence controls it. The extra shelf space reserved for his visits is removed.

The existing manga shop artwork and spider companion remain. The spider keeps its independent crawl and online-discovery behavior. The five design studies remain available separately.

## Current verification

Production build and TypeScript check pass. The live Computer science drawer revealed its three documents immediately. The single bookseller stayed at the same position relative to the counter before and after the click; there were no travelling actors, and the opened drawer had no reserved top margin. Opened “When threads share a cache line” and read its actual readable text.

Browser checks at 1108px desktop and 390px phone widths showed one bookseller, complete image loading and no horizontal overflow. No library data was modified. The bookseller navigation component, journey planner and their obsolete motion tests were removed; the historical motion-test results below are not presented as validation of the new stationary implementation.

## Historical implementation and verification

The following entries record earlier implementations and the checks performed at the time. The shelf navigation, grandfatherly pace correction and shopkeeper-driven drawer gestures are superseded by the stationary direction above; their passing tests do not constitute acceptance of the current revision.

### Continuous shelf navigation

#### Grandfatherly pace correction

The initial journey had an inappropriate six-second deadline that accelerated long trips. It is removed. Walking now averages 64px/s (previously 220), climbing 48px/s (previously 240), with longer planted rung holds, a 350ms anticipation, 800ms get-up and 750ms sit. Reaching/pulling take 650/750ms. Foot drawings remain tied to distance, now changing at most four times per second. Mid-rise redirects retain the remaining rise time rather than rushing it. Longer journeys take longer; actual documents remain immediately available.

Production build and TypeScript pass. All 15 motion tests pass, including normal/long-route speed bounds and foot drawing cadence. The working browser showed the slower walk while the selected drawer's documents were already available.


The shopkeeper is now one persistent actor in the room. Drawer selections no longer unmount the counter character and create a new copy at the drawer. He anticipates, rises, walks along the counter, climbs a visible wooden ladder in 32px steps, walks onto the selected shelf, sits, reaches and pulls. Closing the drawer returns him along the same physical route. Selecting another drawer redirects him from his current position, height and step. He remains at a selected drawer until the selection changes.

Eight new transparent drawings retain the existing rough monochrome shopkeeper identity. Sources, exact prompts, packaging and measured foot/hand anchors are in `art/bookseller-walk/`; runtime assets are in `public/characters/bookseller-walk/`. Standing, walking, crouching and climbing use a foot anchor; the original seated/reach/pull drawings retain their calibrated hip anchor and handle contact. A departure shelf extension holds his footing when another drawer changes the vertical layout.

Documents appear immediately. Only the decorative handle pull waits for his arrival. Pause freezes his current position while drawer selection and document reading continue; resuming follows the latest selection. Reduced motion suppresses travel and opens the drawer immediately. Geometry is remeasured on layout and viewport changes, with a narrower route at the phone breakpoint.

Verification: production build and TypeScript pass; 15 route tests pass, covering continuous endpoints, direction changes, mid-rise retargeting, distance-driven poses, consistent travel speed, rung holds and pause sampling. Live browser checks at desktop and 390px phone width showed one actor, complete image loading, no horizontal overflow, walking/climbing/arrival, and continuous redirection during climbing and reaching. Paused position was identical before and after selecting another drawer. A starter document opened and its readable text loaded while the character was paused. Reduced-motion behavior was reviewed in source, not emulated in the browser. No library data was modified.

### Library service recovery fix

The drawer failure was a backend availability problem: Next was still serving the room while the library process had exited with SIGTERM (143). The prior process log showed a clean shutdown, with no crash traceback; the signal sender was not recorded. The saved library remained intact: four collections, ten ready documents, and 1,586 passages.

The backend now runs as a per-user service independent of the task's tool process, with restart on failure. The working page retries status and library loading every five seconds after an initialization/read failure; a successful health/status response alone no longer leaves the drawers stuck. Concurrent retries are guarded. The header says “Loading…” or “Reconnecting…” instead of falsely reporting zero saved documents, and add/search actions are disabled until the connection recovers.

Verification: temporary backend outage showed “Reconnecting…” with no zero count; restored service returned the saved folders and preserved typed search text. Opened Computer science, opened its starter PDF, switched to readable text and read page 2. TypeScript and production build pass. No library documents were created, removed or modified.

### Quiet shop revision

The user subsequently removed the visible brand/navigation header, hero title, slogan and welcome copy, and requested an old, cozy, slightly unkempt but charming manga shop. Those elements are removed from the working page. Request modes are three compact buttons on the counter; idle explanatory status and speech copy are removed. Active request feedback, help, motion controls and the actual library actions remain available.

The background is original black-and-white image-generated artwork with worn wood, leaning book piles, a cushioned chair, trailing plants and small corner cobwebs. Source and exact prompts: `art/shop-interior/`; current runtime artwork: `public/scenes/manga-bookshop-cozy.webp`. The image is encoded as WebP at quality 90 and displayed behind opaque, readable controls. An earlier background draft is retained separately.

The revised production build and typecheck pass. Browser checks at 1108px desktop and 390px phone widths confirmed the compact mode selector, an actual Computer science drawer with three documents and the correct scope control, one visible bookseller, no missing character images, and no horizontal overflow. The removed intro and design-studies link are absent from the page.

The downloaded `finder-keeper-my-choices.txt` selected Option 1, the warm bookseller, the search counter with hanging legs, pull-out collection drawers, and the lost-and-found window. Its note requested that drawers function as actual document folders. The subsequent request replaces Pip with the spider and corrects the bent-down clerk's wrist.

### Delivered behavior

- `/` uses the selected black-and-white bookseller layout. Only one bookseller appears: seated on the counter, or on the upper edge of the opened drawer.
- Collection drawers use the existing library data, filtering, counts, upload/import destinations and document reader. Contents become available immediately, independently of the decorative gesture.
- Reach/pull drawings share the calibrated hip anchor. The handle moves 14px horizontally and 12px down between the two held drawings, matching their measured grip positions. The cabinet lip stays fixed under the seated hip.
- The bent pose's supporting wrist and lowered grip were corrected through image generation, including the inward-facing thumb. Original source, exact prompts, crop/resize packaging script and contact measurements are under `art/bookseller-drawers/`.
- The spider's sign selects online discovery and focuses the real search field. Its crawl follows the sill, reacts to the real online request, and can also be tried using “Follow the thread.”
- Pause stops decorative progression without stopping requests. Reduced-motion preferences suppress the movement. Option 1 in `/ui-studies` also uses the spider while retaining previous saved favorite keys.

### Verification

- Production build and TypeScript check passed.
- Backend and frontend proxy returned 200; existing library: four folders and ten documents. No saved documents were changed during UI verification.
- Opened Computer science and Design & ideas drawers and checked their actual document counts/contents.
- Searched Computer science for “false sharing”: five passage results; opened the second-page result in the reader and confirmed Page 2 and its matching excerpt.
- Spider shortcut selected Find online and focused the input. A real online search completed and displayed its checked source. Motion pause remained independent of request completion.
- Browser checked at 1108px desktop and 390px phone widths. Phone document width stayed inside the viewport, all character images loaded, and one bookseller was present with a drawer open.
- Drawer and spider timer cleanup, request cancellation guards, folder scope and reduced-motion behavior were reviewed in source. The online request completed before the attempted cancellation; cancellation was not claimed as a separate browser check.
