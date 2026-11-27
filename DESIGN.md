---
name: Finder & Keeper
description: A pencil-drawn bookshop wider than the window; every control is a paper object drawn in the room's hand.
colors:
  ground: "#e5e3df"
  paper: "#f1f0e9"
  paper-2: "#e7e4db"
  ink: "#2b2a27"
  pencil: "#5a5751"
  graphite: "#8d8a82"
  faint: "#cfcbbf"
  dialog-pencil: "#4a4842"
typography:
  display:
    fontFamily: "Architects Daughter, Segoe Print, Bradley Hand, cursive"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1
  headline:
    fontFamily: "Architects Daughter, Segoe Print, Bradley Hand, cursive"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.1
  title:
    fontFamily: "Architects Daughter, Segoe Print, Bradley Hand, cursive"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.1
  script:
    fontFamily: "Architects Daughter, Segoe Print, Bradley Hand, cursive"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.35
  action:
    fontFamily: "Architects Daughter, Segoe Print, Bradley Hand, cursive"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.2
  card:
    fontFamily: "Special Elite, Courier New, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "Special Elite, Courier New, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Special Elite, Courier New, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
  badge:
    fontFamily: "Special Elite, Courier New, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.04em"
rounded:
  paper: "2px"
  paper-uneven: "2px 3px 2px 4px"
  sheet: "3px"
  round: "50%"
spacing:
  hair: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  shingle: "62px"
components:
  tag:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.paper-uneven}"
    padding: "7px 12px 8px"
  tag-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.paper}"
    padding: "14px 16px 15px"
  slip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.script}"
    rounded: "{rounded.paper}"
    padding: "10px 18px 8px"
  stamp:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.round}"
    size: "44px"
  stamp-disabled:
    textColor: "{colors.graphite}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.action}"
    rounded: "{rounded.paper}"
    padding: "8px 14px"
  button-paper:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.paper}"
    padding: "8px 14px"
  tool-button:
    backgroundColor: "transparent"
    textColor: "{colors.pencil}"
    typography: "{typography.label}"
    rounded: "{rounded.paper}"
    padding: "4px 7px"
  tool-button-hover:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
  edge-chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "0 3px 3px 0"
    padding: "9px 11px"
  note:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.pencil}"
    typography: "{typography.label}"
    padding: "9px 13px 10px"
  drawer:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.paper}"
    padding: "16px 20px 22px"
    width: "min(440px, 44cqw)"
  caption-ribbon:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    typography: "{typography.card}"
    padding: "7px 14px"
  format-badge:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.badge}"
    rounded: "{rounded.paper}"
    padding: "2px 6px"
  dialog:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.paper}"
---

# Design System: Finder & Keeper

## Overview

**Creative North Star: "The Shop Wider Than the Window"**

The whole interface is one continuous pencil drawing of a bookshop that runs past both edges of the viewport. Three stations sit along it (the desks at the left, the counter in the centre, the window at the right) and the camera pans between them; results land at the station that produced them. There is no header bar, no title block, no framed picture with a form beneath it. Everything a visitor touches is a paper object that could have been drawn by the same pencil: a hand-lettered tag hanging from a string, a request slip lying on the counter, shingled findings with a ribbon caption, a ledger that swings out of the cabinet, a counter note that names the state in words.

The world is monochrome graphite on worn paper, sampled from the drawing itself. There is no colour accent anywhere; emphasis is weight of line (1.5px pencil outlines against 1px dashed and dotted rules), paper laid over paper (two paper tones plus the ground), and ink density (an inverted ink-filled card is the loudest thing on screen). Every paper edge is wobbled by an SVG displacement filter so no outline is machine-straight, but text is never passed through the filter and stays crisp. Two faces only: a hand face for what a person wrote and a typewriter face for what the Keeper's catalogue typed.

Density is a shop counter, not a dashboard: a handful of paper objects at rest, piles that grow only when a job has run. Motion obeys one physical law, papers slide with weight; nothing floats, glows, or blurs. The sole softness in the whole system is the diffuse shadow a sheet of paper casts on the one beneath it.

**Key Characteristics:**
- One drawing, three stations, a camera that pans; no chrome above or beside it.
- Every control is paper: toothy fill, pencil-wobbled outline, soft cast shadow, a slight tilt.
- Monochrome graphite; emphasis by line weight, paper-on-paper, and ink inversion.
- Hand face for human writing and labels; typewriter face for catalogue data and status.
- States are always named in text on the counter note; animation never carries meaning alone.

## Colors

Seven greys lifted from the drawing's own paper and graphite, warm-neutral, with no hue accent.

### Primary
- **Ink** (`ink`): the pencil's darkest pressure. All primary text, the 1.5px outline on the active object, the inverted fill of a pressed tag or primary button, the live dot, the caret, the 2px dashed focus ring.

### Neutral
- **Ground** (`ground`): the room's wall tone behind the drawing and the `.shell` background; nothing is ever written directly on it.
- **Paper** (`paper`): the fill of every paper object (tags, slip, papers, drawer, note, dialog) and the text colour on an ink-filled object.
- **Paper-2** (`paper-2`): a second sheet laid on the first; hover fill for tool buttons, icon buttons and menu rows, the ribbon fill, the dialog's inset boxes, the skeleton shimmer's dark band.
- **Pencil** (`pencil`): the drawn outline on every paper object, catalogue-card metadata, secondary text, icon colour at rest, the slip option borders.
- **Graphite** (`graphite`): the faintest working line: the slip's ruled lines (at 25% alpha), dashed separators and underlines, the disabled stamp, inactive import stages, the thin scrollbar.
- **Faint** (`faint`): text selection, the dotted document rule inside a drawer, the ink-card's small text, the `mark` highlight in the reader.
- **Dialog pencil** (`dialog-pencil`): a slightly darker secondary text used only inside the reader and dialogs under `.shell`, where descriptions sit on larger paper and need one more step of contrast than `pencil`.

### Named Rules
**The No-Accent Rule.** There is no hue in this system. Emphasis is only ever line weight, paper over paper, or ink inversion. A coloured state (success green, error red, link blue) is a violation; errors are a dashed outline and words on the note.

**The Shadow-Is-Ink Rule.** Every shadow is `#25231d` at low alpha, never black and never a hue; it reads as the paper's own cast shadow on the drawing.

## Typography

**Display Font:** Architects Daughter (with Segoe Print, Bradley Hand, cursive)
**Body Font:** Special Elite (with Courier New, monospace)
**Reader Font:** ui-serif / Georgia (reader's readable-text view only)

**Character:** Pencil lettering by the tool that drew the room, paired with the typewritten catalogue card. The hand face is everything a person wrote: tags, the shop sign, the slip's job line and the visitor's own words, captions, button labels, headings. The typewriter face is everything the Keeper's catalogue typed: metadata, excerpts, status, hints, badges. Both ship at a single weight (400); hierarchy comes from size and face, never from bold.

### Hierarchy
- **Display** (400, 22px, 1): the shop sign only. Drops to 18px under 760px.
- **Headline** (400, 24px, 1.1): the drawer's ledger heading; dialog and reader headings run 26px/24px in the same face.
- **Title** (400, 16px, 1.1): hand-lettered tags and the results caption; 15px under 760px. One size for every tag, everywhere.
- **Script** (400, 21px, 1.35): the visitor's own writing in the slip input; 19px under 760px. The slip's job line is 17px in the same face.
- **Action** (400, 13px, 1.2): hand-face labels on buttons, menu rows, text links (dashed underline, offset 3-4px), collection names at 17px.
- **Card** (400, 14px, 1.3): ribbon captions and answer text (at 1.7 leading) in the typewriter face.
- **Body** (400, 13px, 1.55): result excerpts, clamped to 2 lines at rest and 6 when lifted (12 in plain list).
- **Label** (400, 11px, 1.3-1.5): typewriter metadata, status, hints, drawer counts, the sign's subtitle, in `pencil`.
- **Badge** (400, 10px, 0.04em): format badges and inline citation numerals; the "available" access label is the only uppercase text (10px, 0.06em, tilted -2deg, 1.5px ink outline).

### Named Rules
**The Two Hands Rule.** Hand face for what a person wrote; typewriter face for what the catalogue typed. Never mix them inside one line, and never introduce a third face on the shop surface. (The reader's long-form serif is a carried exception inside the dialog, not a licence.)

**The One Weight Rule.** Both faces ship at 400 only. Emphasis is size, face, ink inversion, or an underline; `font-weight` above 400 is not available.

## Layout

The shop is a fixed `100dvh` stage with the drawing scaled to `--art-h` and cropped by `--art-top`: 150dvh / -25dvh on desktop, 120dvh / -12dvh under 1024px, 100dvh / 0 under 760px. The scrollable strip is a horizontal `scroll-snap-type: x mandatory` camera over a stage `calc(var(--art-h) * 1.5)` wide; three frames, each `100cqw` wide, are placed at the station's `--x` percentage (desks 14, counter 54, window 87) and clamped to the stage edges. The camera rests on the counter at load. Panning is `scrollTo({behavior: 'smooth'})`, instant under reduced motion; the frame whose centre is nearest is the current station and the job follows it.

Objects are positioned by percentage of the frame, not by a grid: tags at `--l`/`--t` (with `--lm`/`--tm` phone overrides), piles at a station-specific corner (window: left 44% top 14%, width `min(480px, 34cqw)`; desks: left 3% top 30%, `min(540px, 46cqw)`; counter: left 62% top 6%). The drawer sits at left 41% top 13%, `min(440px, 44cqw)`. The slip is docked bottom-centre at `min(600px, calc(100% - 24px))`, 20px off the bottom; the note at bottom-left 16px; the sign at 14px/18px top-left with the tool strip beneath it at 76px. Piles reserve `calc(var(--slip-h) + 28px)` of bottom padding so the last paper clears the slip (`--slip-h` 128px, 150px on phone).

Under 760px every pile and the drawer span the viewport with 10px side margins (piles top 44%, max-height 56%; drawer top 12%); the note rises above the slip; the sign loses its subtitle. The spacing rhythm is small and irregular on purpose: object padding runs 7-16px with deliberately unequal sides (`7px 12px 8px`, `14px 16px 15px`, `16px 20px 22px`); gaps between inline items are 4-12px. Shingled papers overlap by 62px.

Plain-list mode (`data-plain`) collapses the whole stage into one 680px column: strip padding `128px 16px 40px`, stations stacked, papers spaced 12px apart with no rotation, the slip sticky at the bottom, the drawing and edge chips hidden.

## Elevation & Depth

Depth is physical: paper on paper on a drawing. Two shadow roles only, both `#25231d` at low alpha, both two-layer (a tight contact shadow plus a diffuse fall). Resting paper carries `--shadow`; a paper being touched, the slip, the drawer and menus carry `--lift`. Lift is a state response (hover, focus, `data-pulled`), never a decoration: the lifted paper also moves up 6px and straightens to 0deg. Nothing uses blur, glass, glow, or inset highlights; the global `.composer`, `.collection-row` and `.dropdown-menu` glass treatments are explicitly zeroed inside the shop.

### Shadow Vocabulary
- **Resting paper** (`box-shadow: 0 2px 5px #25231d2b, 0 10px 22px #25231d1c`): tags, sign, tools, edge chips, note, caption, every paper in a pile at rest.
- **Lifted paper** (`box-shadow: 0 5px 12px #25231d38, 0 22px 42px #25231d2a`): the slip, the drawer, menus, the toast and activity bar, and any pile paper on hover/focus/pulled.
- **Pressed ink** (`box-shadow: 0 2px 4px #25231d33`): the small ink-filled button inside a paper.
- **Dialog** (`box-shadow: 0 8px 18px #25231d44, 0 44px 90px #25231d4a`): the reader on the counter, over a `#25231d59` backdrop with no blur.

### Named Rules
**The Weight Rule.** A paper either rests (`--shadow`) or is lifted (`--lift`); there is no third level and no shadow on text, icons, or outlines.

**The Nothing Floats Rule.** No element hovers without a shadow that explains how it sits on the sheet below; no blur, no glass, no glow.

## Shapes

Paper, cut slightly off-square. Corners are 2px, often uneven per corner (`2px 3px 2px 4px` on tags, `2px 2px 3px 2px` on the slip) so no rectangle reads as a UI card; edge chips are square against the viewport edge and 3px on the free side. Round shapes are reserved for the pin (8px), the stamp (44px), icon buttons, the citation ring and the search pulse. Every paper object rests at a small tilt (sign -1.5deg, tools -1deg, tags -2deg by default, note and caption -1deg, slip -0.5deg) and pile papers alternate -0.5deg / +0.45deg; the touched one straightens.

The outline is the signature: a 1.5px `pencil` border drawn by a `::before` pseudo-element passed through the `#fk-wobble` SVG filter (fractalNoise at 0.025, two octaves, seed 4, displacement scale 2.4), so edges wander like a pencil line while the text layer above stays sharp. Line weight is the vocabulary: 1.5px solid for a paper's edge and anything active; 1px dashed in `graphite` for separators, underlines and select baselines; 1px dotted in `faint` for rows inside a ledger; dashed 1.5px for a secondary or disabled version of a thing (the "other matches" papers, the disabled stamp ring). The slip carries 30px ruled lines (`#8d8a8240`) under its tooth. Captions wear a drawn ribbon (`border-image`, 14px tails) rather than a bar.

## Components

### Buttons
Every button is either a paper object, ink pressed into paper, or a pencil mark. None has a hover fill except the second-sheet `paper-2` tone.
- **Shape:** paper corner (2px) or round (50%) for stamps and icon buttons.
- **Ink** (`button-ink`): `ink` fill, `paper` text, 1.5px `ink` border, hand face 13px, padding 8px 14px (small variant 6px 11px with the pressed-ink shadow). Used for save/confirm and the drawer's add button (32px round).
- **Paper** (`button-paper`): transparent, `ink` text, 1.5px border (`ink` in the drawer, `pencil` in dialogs), same type. Secondary actions.
- **Tool** (`tool-button`): bare typewriter label in `pencil`, min-height 30px, 2px corner; hover fills `paper-2` and darkens to `ink`; pressed state underlines (offset 3px). The strip of four under the sign (Rehearse, Pause, Plain list, Help).
- **Text link**: hand face 13px, dashed underline offset 3-4px, solid on hover.
- **Hover / Focus:** lift transform `.3s cubic-bezier(.16,.84,.24,1)`; focus is always `2px dashed ink`, offset 4px. Disabled keeps full opacity and changes line style instead.

### Chips (tags and edge chips)
- **Tag:** a string (14x24 drawn SVG) above a paper card with a pin (8px radial ink dot); hand face 16px, one size everywhere; tilt from `--tilt`; typewriter 11px subtitle in `pencil`. Hover straightens and raises 3px with `--lift`. Pressed/expanded inverts to `ink` on `paper` with `faint` subtitle. Disabled greys the text to `pencil` only.
- **Edge chip:** a paper tab flush to the viewport edge (`0 3px 3px 0` / mirrored), hand face 14px, padding 9px 11px, at 44% height (26% on phone); raises 2px on hover; hidden while the drawer is open.

### Cards / Containers (papers)
- **Corner Style:** 2px.
- **Background:** `paper` with the tooth; ribbon caption in `paper-2`.
- **Shadow Strategy:** resting; lifted on hover/focus/pulled (see Elevation).
- **Border:** the wobbled 1.5px `pencil` outline; dashed for "other matches".
- **Internal Padding:** 14px 16px 15px; the ribbon runs out past the padding by 14px on each side.
- **Pile behaviour:** consecutive papers overlap by 62px and alternate ±0.5deg; the touched paper rises 6px, straightens, and its excerpt expands from 2 to 6 lines.

### Inputs / Fields
- **Slip input:** no box; the visitor's words in the hand face at 21px on the slip's ruled lines; placeholder `#66635a`; caret `ink`; no outline on focus (the slip itself is the field).
- **Slip options:** a bare select with a dashed `graphite` baseline, 11px typewriter; option buttons 1px `pencil` border, 2px corner, 3px 7px padding.
- **Stamp (submit):** 44px round, transparent, two wobbled rings in `currentColor` (2px outer, 1px inner at 75%); hover raises 1px and rotates -10deg; disabled turns `graphite` with a dashed outer ring.
- **Dialog fields:** 1.5px `pencil` border, 2px corner, white fill; focus darkens the border to `ink`.

### Navigation
The camera is the navigation. Tags on the drawing choose a station and a job; edge chips ("← the desks", "the window →") pan one station; the counter note's import stages (queued, processing, searchable) are typewriter 11px in `graphite`, the current one underlined in `ink`, done ones struck through in `pencil`. On phone the strip is swiped with mandatory snap. Plain list replaces the camera with a stacked column.

### The Slip
The one thing you write on; it travels with the camera. A paper rectangle at -0.5deg carrying the lifted shadow, ruled every 30px, with three rows: the job line (hand 17px) beside the options, the input beside the stamp, and one foot line (typewriter 11px, dashed `graphite` rule above) for the hint or the "N found at the counter →" announce link. Nothing else is ever added to it.

### The Counter Note
Paper at bottom-left, -1deg, typewriter 12px in `pencil` under a hand-face 15px heading in `ink` with a 6px live dot that pulses (1.6s) while a request runs. It always names the state in words (idle, working, found, empty, error, cancelled) and lists import stages.

### The Drawer
The ledger panel: a lifted paper that swings in (`perspective(900px) rotateY(-55deg)` to flat, .45s) from the cabinet. Hand 24px heading, typewriter 11px description, a 1.5px `pencil` rule under the tools, collection rows separated by 1px dashed `graphite`, document rows by 1px dotted `faint`, open folders indented behind a 1.5px `pencil` left rule. No row backgrounds, no icons except the small white document card (26x32, 1px `pencil`).

### The Reader (under `.shell`)
Dialogs re-skinned as paper: `paper` fill, 1.5px `pencil` border, 2px corner, hand-face headings 26px, `dialog-pencil` descriptions, `paper-2` inset boxes, a `#dcd9d1` reading well, and a long-form serif at 16px/1.78 for readable text with `faint` marks. The toast is an ink-filled paper at top-right, rotated 1deg.

## Characters

The product has two characters and they are named after its two halves. They apply on every surface: the scholarly workspace at `/` draws them in its Stitch palette (`components/guides.tsx`), the shops draw them in their own world (`/clerk-room`, the ink shop).

- **Keeper** is an **old man**: the archivist. Bald crown with white side tufts, white eyebrows, round spectacles, a large white beard and moustache, a cardigan with a small bow tie, an open book held at the chest. Kind, unhurried, closed smiling eyes. He owns everything that happens *after* a document arrives: storing it, searching it, answering from it.
- **Finder** is a **nice spider**: the fetcher. A round body and head, big eyes with highlights, rosy cheeks, a small smile, a magnifying glass held up in one front leg, let down on a silk thread. Friendly, never creepy: no fangs, no hair, no red eyes. He owns everything that happens *before* a document arrives: searching public sources, fetching, checking, handing over. (Earlier code called him "Pip"; the name is Finder.)

### The Guide Rule
Both characters are **clickable educational guides**, not decoration. Clicking one opens a sheet in the character's own voice that explains how the system works, step by step, each step carrying the technical term it stands for so a curious reader learns the real vocabulary:

| Guide | Chapters | Terms taught |
| --- | --- | --- |
| **Finder** | Gathering | query parsing, federated search over public APIs (not crawling), retrieval & verification, access classification, import job |
| **Keeper** | Storing | text extraction, chunking, embedding / vectorizing, vector index |
| | Searching | query embedding, hybrid retrieval, scoring & re-ranking, excerpt pinpointing |
| | Answering | retrieval, retrieval-augmented generation (RAG), grounding check, extractive fallback |
| | The building | local mode, CDN + serverless web, authentication, API + job queue, object storage + vector database |

Steps are drawn as stations on one amber thread (Finder's silk). Each sheet ends with a hand-off to the other character, because the two jobs meet at the import queue. Numbers in the copy must match the code (`backend/app/extraction.py`, `retrieval.py`); change the guide when the pipeline changes.

### Named Rules
**The True-State Rule.** A character moves because real work is happening: Finder scurries only while an online search runs, Keeper leafs only while he files, searches or answers. Pause and `prefers-reduced-motion` stop both. Animation never delays a result.

**The Corner Rule.** On the workspace the guides stand in the bottom-right corner (above the section bar on phones), never in the content column and never as a third layout column. They carry a name tag ("Finder · how gathering works", "Keeper · how storing & search work"); on phones the tag is the name only.

## Do's and Don'ts

### Do:
- **Do** make every new control a paper object: `paper` fill with the tooth, a `::before` outline of 1.5px `pencil` through `#fk-wobble`, resting shadow, a small tilt, 2px corners.
- **Do** keep text outside the wobble filter; only the outline pseudo-element is displaced.
- **Do** write human-facing labels in the hand face and catalogue data in the typewriter face, both at 400.
- **Do** express state with words on the counter note and with line style (solid, dashed, dotted, inverted ink), never with hue.
- **Do** ease every movement with `cubic-bezier(.16,.84,.24,1)` (lift .3s, swing .45s, art zoom .7s) and let `[data-paused]` and `prefers-reduced-motion` stop all of it.
- **Do** land results at the station that made them and fade them in with the camera's arrival (.45s).

### Don't:
- **Don't** add a header bar, a page title, or a framed picture with a form beneath it; the drawing is the page.
- **Don't** introduce any hue, gradient fill, glass blur, glow, or inset highlight; the global glass treatments are zeroed on purpose.
- **Don't** use a bold weight, uppercase tracking (beyond the single 10px "available" stamp), or a third typeface on the shop surface.
- **Don't** give a paper a hover fill or a straight border; hover is lift and straightening, and borders are drawn.
- **Don't** let an element float without a shadow that explains what it rests on; no shadow on text, icons, or outlines.
- **Don't** put a fourth row on the slip; it carries the job line, the writing, the stamp, and one foot line only.
