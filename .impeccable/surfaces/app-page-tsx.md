---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/clerk-room/page.tsx","components/shop.tsx"]
---

# Surface brief: the main room (`/`, `/clerk-room`) — Phase 2, The Herbarium Folio

Scope: the whole main route, replacing the ink "Three stations" world (kept at tag `starting-pad-shop`). Visitor mode: Experience; results and reading keep Operate discipline inside the scene. Product truth: PRODUCT.md (Phase 2 commitments: 3D Keeper and spider, coloured layered room, academic type, folders as desks, ask while reading). Direction chosen by the user on the decision page, 2026-10-31.

## Direction contract

THESIS: Finder-Keeper is a herbarium of documents. Every document you keep is a specimen mounted on a sheet with its collector's label; your collections are folios tied with linen tape on the Keeper's desks, and you lean in to see their sheets; the one red in the room is the type-specimen stamp that says the full text was checked. It refuses both the category default (a sidebar of folders, a search bar, a grid of cards) and the cozy-lamplight bookshop with cream paper and a serif on everything.

OWN-WORLD: Committed colour. Moss-green folio cloth (#35503a) carries the ground and the shelves of folios, 30–60% of every surface; folder brown (#7a6244) is wood: the desks, the counter, the window frame; sheet paper (#efe9da) appears only where a document, label or slip is, never as a page ground; graphite ink (#2a2a26) for all text; type-specimen red (#9c3b2c) for exactly one meaning, "full text checked", and nowhere else. Material: a layered watercolour room (back wall and folio shelves, mid-ground desks and counter, foreground objects) with real parallax between layers; mounting sheets with linen tape across the corners; hand-cut labels with two ruled lines; folio covers in cloth with tape ties. Type: one academic face in three voices, EB Garamond roman for reading, italic for titles and the visitor's own writing, and true small caps for labels and station names, because Garamond is the type of the early printed herbals and of university presses; tabular numerals for every count. No second display face. The Keeper and the spider are modelled in Blender and rendered as painterly atlases that sit in the watercolour, never as plastic; he has one continuous body.

STORY: You walk in and the Keeper looks up from the folio he is working on. You write on a collector's label and point him at a station. For a saved search he walks to the desks, unties a folio and leafs through its sheets; for a question he opens the register at the counter and runs a finger down the page; for the web the spider climbs out of the window. What he finds comes back as mounted sheets laid on the counter, each labelled with title, source and date, the checked ones stamped red. Open a sheet and the camera pushes in; the register stays beside it, so you can ask about the document you are reading. Lean into the desks and the folios fan their sheets so you see what a collection holds without opening anything. The note on the counter names every state in words; imports pass through queued, mounting, searchable, or failed.

FIRST VIEWPORT: Desktop 1440×900. The room fills the viewport in three watercolour layers; the Keeper, at the counter centre, is mid-task and looks up as the page settles (his one authored entrance). Left: the desks with your tied folios, each cover lettered with its collection name and sheet count in small caps; right: the window, the web and the spider; behind him the green folio shelves. Found sheets lie on the counter in front of him. The collector's label is docked bottom-centre: the job in small caps, the italic writing line, the red-ringed send stamp. The shop sign hangs top-left; the counter note sits bottom-left. Phone 390×844: one station per screen with scroll-snap; the label docked in the thumb zone; sheets restack above it; the room recomposes by whole layers.

FORM: The Herbarium Folio, index 4 of the ordered list, dealt as THE ROLL. seed:580fb8c44f417fa7. Raises carried from the declined challengers: the room recomposes by whole painted layers, never fractional crops (azulejo); the station or folio you are in is drawn solid, the others dashed (pattern tissue); every object named beside its picture at one size, nothing cropped on phone (lotería); the design system ships as a numbered plate book of reusable units (Breton plate book); red means one thing only (exposure sheets); counts change as visible physical events, a sheet slid into a folio (nixie). Pinned by the user: 3D Keeper and spider, layered colour room, academic type, folders as desks, ask while reading, nothing plastic.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Build plan and open decisions
- Asset track (Blender): remodel and rig the Keeper, author the job animations (look up, walk, untie and leaf, read, hand over), model the spider, render painterly atlases in the world's palette. Room layers painted in PhotoCraft/VectorCraft from the world's palette.
- UI track: the room as layered parallax with the stations; folios on the desks bound to real collections; sheets, labels, stamps, the register; ask-while-reading inside the reader; the plain-list fallback.
- Decision comps: none this round (no image generation; Canva out of credits). The chosen sketch `.impeccable/mocks/decision/world-herbarium.html` rides to the finish review as the critique reference.
- Open: what the user meant by "something else" that would feel wrong; the order of the asset and UI tracks.
