# Shape brief: the main room at `/`

Status: **confirmed by the user, 2026-10-30.** No code and no direction contract have been written yet; the build is a separate go-ahead. Produced by `/impeccable shape the main library scene` on 2026-10-30. Product truth lives in [PRODUCT.md](../PRODUCT.md); this brief covers one surface.

## 1. Job and audience

- **Visitor:** the general public, arriving with a half-remembered idea, a title or a topic. Phone and desktop equally.
- **Mode:** Experience. The shop and its two characters lead from the first viewport; the interface is the shop. Results and reading borrow Operate discipline (scanability, native expectations) without leaving the scene.
- **Three jobs, one room:** find something new online (the spider, the window), find what you already saved (the desks), ask and read with citations (the book). All three equally reachable; switching is a walk, not a mode change.

## 2. Outcome and proof

- **Primary action:** write on the slip on the counter and point him at a station. Success is a real result arriving where he found it, visibly handed over, and readable without leaving the shop.
- **Proof that only this product can show:** the request is literally performed. The spider climbs out of the window when the web is being searched; he walks to the desks when your saved pages are being checked; he turns a page of the book when answering. Every gesture reflects true request state (`KeeperActivity` stays the source of truth) and never delays the result.
- **Real content on hand:** starter documents (labelled as such), real provider results with honest verification status, real import states, real collection counts. Nothing invented.

## 3. Selected direction — *Three stations* (THE ROLL, locked by the user)

Visual authority: the user-pinned black-and-white ink illustration world (`public/clerk-room/front-illustrated/`, the articulated puppet in `components/clerk-illustrated-scene.tsx`). Blender and pixel are no longer part of the main surface.

**Structural thesis.** The shop is drawn wider than any screen. Three stations sit along it: the **window** at the right (the spider, the wider web), the **counter** in the middle (the slip, the open book), the **document desks** at the left (saved passages, the drawer cabinet of collections, the uploads tray). Choosing a job pans the camera to its station; the result appears at the station that produced it, in the room's own hand: web findings pinned by the window, saved passages laid out on the desks, the answer written in the open book. There is no page around the room: no header bar, no title above a framed picture, no form card beneath it.

**First viewport (desktop).** The counter station fills the viewport edge to edge; the window's arch is visible at the right edge, the desks' corner at the left, so the width of the shop is legible at a glance. The Keeper sits behind the counter. In front of him, on the wood, lies the slip: the one text field, already focused, with a drawn hand-pointer to each of the three stations. A small in-scene status line ("Keeper is at his desk") sits on the counter edge. Collections count and the pause control are objects on the counter, not chrome.

**Phone.** One station per screen, swiped or walked between (the Keeper visibly walks when the camera moves). The slip stays docked in the thumb zone on every station, so a request can be written anywhere. The counter station is the home screen.

**Signature interaction.** The walk. Choosing a station pans the shop and the Keeper walks there with you; the spider leaves through the window; the result lands at the station. A pan is 400–600 ms, interruptible, and a result that arrives mid-pan is placed at its station and announced on the slip ("3 found at the window →"). Reduced motion: a cut, no pan, static work pose.

**Raises carried from the declined challengers (binding):**
- *From the Miura sheet:* every station and every result is also reachable as a plain stepped list (keyboard, screen reader, reduced motion); the stations deploy without a pan.
- *From the cyclorama:* idle, working, found, empty, error and cancelled are each named in text inside the scene; motion and tone are never the only signal.
- *From the darkroom:* imports are shown as ordered stations — queued, processing, searchable, failed — with the honest point past which a copy is kept.
- *From the suminagashi basin:* one physical law for everything that moves: papers slide with weight, the spider climbs a real thread, nothing floats or fades in from nowhere.

**Implementation consequence.** The room art must be extended: today's `room.png` is one 1536×1024 frame of the counter alone. The three-station shop needs the window and desks drawn as continuations of the same room, at the same pencil hand, as plates the user approves. The illustrated puppet, the spider rig and the Blender/pixel atlases are not thrown away; only the illustrated puppet ships on `/`.

## 4. Scope and boundaries

- **Target:** the main route `/` (and `/clerk-room`, which becomes the same screen). Production-ready, full breadth: search in all three scopes, results, open-and-read, collections, uploads and import status, errors, cancellation, pause, empty first run.
- **Reader:** keeps its working internals (pdf.js, EPUB sections, citations, highlight-on-open); opening a found paper pushes the camera in close on that paper on the counter; a plain full-width reader is one tap away for long sessions and returns to the shop afterwards.
- **Kept as hidden routes, untouched:** `/classic`, `/keeper-study`, `/ui-studies`; `/clerk-room?style=blender|pixel` stay reachable by URL only. No style picker on the main surface.
- **Untouched:** backend, API contracts, `lib/clerk-animation.ts` request-truth model, the three-scope semantics, provider honesty rules, copy that states facts.
- **Anti-goals:** a header bar; a page title above the scene; a framed picture of the room inside a page; a form card below it; numbered hotspots; a style picker; a panel laid over the room; a cream "bookish" default ground; any animation that gates a result.

## 5. States and ranges

| State | Range / detail |
|---|---|
| Library size | 0 (first run) → hundreds of documents; collections 0 → ~30 |
| Web discovery | 0–20 verified free full-text candidates, plus a separate list of catalogue / preview / paywalled entries; provider failures shown by name (OAPEN 403 is real) |
| Saved search | 0–N passages with document, section and page |
| Ask | an answer with 0–N cited passages; "nothing in your library answers this" is a real state |
| Import | queued → processing → searchable, or failed (no OCR for scanned PDFs is an honest failure) |
| Request | idle, working, found, empty, error, cancelled; a fast success may finish a short gesture after results are shown |
| Motion | running, paused, reduced-motion (static poses), hidden tab |
| First run | empty shelves, starter documents offered as such, the slip explaining the three stations once |

## 6. Interaction and layout

- **Hierarchy:** the slip first, the Keeper second, the station objects third; results outrank everything once they exist.
- **Topology:** one horizontal shop, three stations, camera follows the chosen job; collections and uploads live at the desks station; the reader is a close-up inside the counter station.
- **Responsiveness:** desktop shows one full station with both neighbours' edges; tablet shows one station; phone shows one station per screen with a docked slip. Nothing is shrunk; each width is a re-composition of the same shop.
- **Affordances:** every station object is a drawn thing you can point him at, with its purpose written on it in the shop's own hand (see open decision A); results are papers you can pick up; collections are drawers you can open.
- **Feedback:** the in-scene status line names the state; the Keeper's gesture matches it; results appear immediately, never after the gesture.
- **Transitions:** pans 400–600 ms and interruptible; a new request replaces any gesture; cancel and error settle him back to the chair at once.

## 7. Constraints and open decisions

**Binding constraints**
- Next.js 16 / React 19 front end, FastAPI backend, local-first; same-origin API proxy. Keep `KeeperActivity` as request truth.
- Black-and-white ink world. The page ground is sampled from the drawing's own paper tone, not a default cream.
- Keyboard reach to every station and result; `prefers-reduced-motion`; pause control; readable text over illustration.
- Art the user must approve: the window and desks extensions of the room, and any new puppet poses (walk to the window, pin a paper).
- Type is not decided here. New-work bans the reflex faces; the face is chosen at build with a stated reason from the shop's own signage and ledger tradition.

**Decisions resolved by the user (binding on the builder)**
- **A. Labels on objects — adopted.** Every station object carries one hand-lettered label at a constant size, in the shop's own signage hand; numbered hotspots are gone.
- **B. Results grammar — adopted.** Found documents at the window and desks stations shingle like a spread; the touched paper pulls forward; a drawn ribbon carries title, source and verification status.
- **C. Blender and pixel — removed from the build.** The main surface ships the ink illustration only; the `?style=` switch, its picker and the Blender/pixel scene components leave the main route. Their source art stays in the repository as history.
- **D. Starter documents — pre-loaded silently as today,** labelled as starter material in the library (the visible-stack option was declined).

This supersedes the earlier line in section 4 that kept `?style=blender|pixel` reachable by URL.

**Direction reference for the build:** `seed:3c49260373fb951f`; chosen sketch `.impeccable/mocks/decision/assigned.html`; build path: code-led (no image generation in this session).
