# Phase 2: from the shop to a product

Starting pad: `main` at tag `starting-pad-shop` (the three-stations ink shop). Phase 2 lives on `phase-2/herbarium`.

Decisions taken with the user on 2026-10-31:

- **The Keeper is rebuilt in 3D (Blender), rendered to atlases.** One continuous body on a real armature; he looks up when you arrive, walks to the desk and leafs through a folio, runs a finger down the register page, hands the answer across. The spider is 3D in the same scene.
- **The room is an anime-shaded library, rendered in layers, in colour** (folio-cloth green, wood brown, sheet paper, one red for "full text checked"). The desks' drawers are the collections.
- **Type is academic**: EB Garamond in roman, italic and small caps.
- **Ask while reading**: the register sits beside every open document.
- **World first, then product.** After the user interrupted the Impeccable finish review, the rest of Phase 2 is built directly with Blender, Penpot and the ArtCraft tools.

## Done (2026-10-31)

- Blender pipeline (`art/herbarium/`): room layers, drawer plates, Keeper and spider atlases, landmarks; the page places everything from the render.
- Nested collections (dividers inside a drawer), with search and ask scoped across them.
- Lending: a collection lent to a friend by email (viewer), or opened to anyone by link at `/shared/<token>`; revocation; isolation tests.
- The register inside the reader.
- `/sign-in`: the shop door, Google through the existing Firebase path when configured.
- Brand: the mark and wordmark in `art/brand/` (a mounted specimen sheet with the spider's thread, the red stamp), exported through VectorCraft.

## Done (2026-11-07): reading flows and the commons

- **Reading flows** (`backend/app/flows.py`, `components/flows-view.tsx`, `components/flow-map.tsx`, `lib/flow-layout.ts`). The Keeper plans a path through the library for a goal: it recalls the passages that speak to it, lays the best documents out as a main path, and for each step follows the passage's own distinctive words to find a detour (a document off the main path) behind a fork ("Carry on" / "Go deeper"); the path ends in a Synthesize step that asks the library the goal. The planner is deterministic and offline; a local Ollama model, when present, only writes the step notes and titles (`embellish`), never chooses documents. Flows are drawn as a map (layered DAG, main path on the top lane, detours below) and as a checklist; steps are ticked per reader (`flow_progress`), a step opens once any path into it is done, so an untaken detour never blocks the finish. Flows can be renamed, hand-edited (`PATCH /api/flows/{id}` with a validated graph), published and deleted.
- **The commons** (`backend/app/community.py`, `components/community-view.tsx`, public pages `/u/<handle>`, `/flows/<id>`, `/shelves/<id>`): reader profiles (handle, name, bio; made on first sight), open shelves (a published collection lists its catalogue; full text opens only under an open licence or for the starter notes), published flows that anyone can walk with their own ticks, reviews of books you keep (one per reader per work; reviews of the same work meet by title and first author), notes (comments) under shelves, flows and reviews, follows, and a feed (everyone, or the readers you follow). Public reads need no sign-in; every write is the signed-in reader's own.

## Next

- Deploy to GCP Cloud Run + Cloud SQL (pgvector) from `infra/terraform` with `AUTH_MODE=firebase`; set Firebase env for `/config`; price the plan and set the budget ceiling (undecided in PRODUCT.md).
- Freemium limits (undecided) and an editor role for lent drawers (uploads into a friend's drawer).
- Marketing surface (landing page) in the shop's world; app icon from the mark.
- Keeper polish: more expressive face and hands, idle fidgets, cloth; the pipeline makes re-rendering a one-command job.
- Sub-collection depth beyond one level, if wanted.
