---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/clerk-room/page.tsx","components/shop.tsx"]
---

# Surface brief: the main room (`/`, `/clerk-room`)

Scope: the whole main route. Visitor mode: Experience; results and reading carry Operate discipline inside the scene.
Audience and job: the general public, phone and desktop equally; three jobs (find online, recall saved, ask with citations) performed by the Keeper and his spider in an ink-drawn bookshop. Confirmed shape brief: docs/shape-main-room.md (user-confirmed 2026-10-30; decisions A, B adopted; C Blender/pixel removed; D starter documents silent).

## Direction contract

THESIS: The shop is wider than the screen. Three stations sit along one continuous pencil drawing (desks left, counter centre, window right); choosing a job pans the camera there and the result lands at the station that made it. It refuses the category default this app shipped until now: a header bar, a title, a framed picture of the room, and a form card beneath it.

OWN-WORLD: Grey-toned graphite on worn paper, sampled from the drawing itself: ground #e5e3df, paper #f1f0e9, ink #2b2a27, graphite #8d8a82, soft shadow #25231d at low alpha. Every control is a paper object drawn in the room's hand: the request slip, hand-lettered shop tags on a string, shingled result papers with a drawn ribbon caption, cabinet drawers, a counter note for status. Two faces, each from the shop's own paper: Architects Daughter for everything written by hand (tags, the slip, the ribbon labels) because it is pencil lettering by the tool that drew the room; Special Elite for everything the Keeper types (catalogue-card metadata, excerpts, status) because a library's cards are typewritten. No colour accent: emphasis is weight of line, paper over paper, and ink density.

STORY: You stand across the counter from the Keeper in a shop that continues past both edges of your window. You write on the slip and point him at the window, the desks, or the book. The shop pans; he walks or the spider climbs out; papers appear at that station, each wearing a ribbon that says what it is and whether its full text was checked. Pulling a paper forward opens it close on the counter. Nothing waits on the performance: the status note on the counter names idle, working, found, empty, error, cancelled, and imports as queued, processing, searchable, failed.

FIRST VIEWPORT: Desktop 1440×900. The drawing fills the viewport at 150% height, cropped to show the Keeper's head near the top and the counter front at the bottom; the camera rests on the counter station with the desks' corner visible at the left edge and the window's arch at the right. The Keeper sits behind the counter, centre. Three hand-lettered tags hang on their objects at one constant size: "The desks" (left), "The book" (on the counter), "The window" (right), plus "The drawers" on the cabinet and "The tray" at the desk end. The slip lies docked at the bottom centre over the counter: a paper rectangle, slightly rotated, with a handwritten placeholder, the job name on its header line, and a pencil-stamp send button; it is the primary action and already focused. A small counter note at bottom-left reads "Keeper is at his desk." The shop's name hangs top-left as a small drawn sign. Phone 390×844: the drawing at 100% height; one station per screen, swiped or walked between with scroll-snap; the slip stays docked in the thumb zone; results restack vertically above it.

FORM: Three stations, index 4 of the ordered list, dealt as THE ROLL. seed:3c49260373fb951f. Raises carried: plain stepped list for every station and result (Miura); every state named in text (cyclorama); imports as ordered stations (darkroom); one physical law for all motion, papers slide with weight, the spider climbs a thread, nothing floats (suminagashi). Adopted grammars: hand-lettered labels on every object (Busytown), shingled papers with ribbon captions where the touched paper pulls forward (mook).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved for later rounds
- The reader keeps its working internals; a full-width plain reader stays one tap away via its existing "Readable text" view.
- Starter documents stay silently pre-loaded.
