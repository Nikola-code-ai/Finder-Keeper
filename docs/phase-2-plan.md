# Phase 2: from the shop to a product

Starting pad: `main` at tag `starting-pad-shop` (the three-stations shop). Every Phase 2 experiment happens on a branch off it; anything that does not earn its place is reverted by not merging.

Decisions taken with the user on 2026-10-31:

- **The Keeper is rebuilt in 3D (Blender), rendered to atlases.** One continuous body, real posture, a neck that belongs to him. He acts out every job the way an attentive clerk would: looks up when you arrive, listens while you write, walks to the desks and actually leafs through the folder, climbs nothing (the spider does that), reads the book and runs a finger down the page, hands the answer across. The spider becomes a 3D character in the same render pipeline.
- **The room becomes a mock-3D layered scene, in colour.** Calming greens, browns and reds; a painted room in parallax layers so the camera has depth without WebGL. The desks are the folders: lean in and the drawers and papers fan out so you can see what is in a collection (and its sub-collections) without clicking through anything.
- **Type becomes academic.** The hand-lettered and typewriter faces go; the replacement is chosen in the direction round with a stated reason, from the world of university presses and reading rooms.
- **Ask while reading.** The book (ask) is available inside the open reader, so a question about the document you are in never makes you leave it.
- **World first, then product.** Track 1 (world) ships before Track 2 (product) starts in earnest.

## Track 1: the world

1. **Product truth update** (`/impeccable init`): record the commercial intent (public, cloud, accounts, sharing) and the new character/room commitments in PRODUCT.md. Short.
2. **Direction round** (`/impeccable craft the shop, in colour`): a replacement visual world, with the user's pinned constraints (colour family, academic type, 3D clerk, layered room, desks-as-folders) binding; the roll decides the composition. Comps come from the design tools the user named (FigCraft locally, Penpot self-hosted) and Canva's generator for painted plates.
3. **Character pipeline**: `art/clerk-room/front-blender/shopkeeper.blend` already has a scripted, deterministic authoring path and atlas renders. Phase 2 remodels the clerk (proportions, posture, face), rigs a proper skeleton, authors the job animations, and renders painterly atlases in the new palette. The spider gets the same treatment. Blender must be reachable from the shell (it is not on PATH today).
4. **The room**: painted layers (back wall, shelves, desks, counter, window, foreground) at two camera depths; the folder-desks as an object with drawers whose contents are real collections; results and the reader re-drawn in the new material.
5. **Ask-while-reading**: the reader gains the book as a side slip; citations scroll the open document.

## Track 2: the product

- Logo and name mark; marketing surface (landing page, Persuade mode).
- Sign-in (the backend already carries an optional Firebase/Google path; `status.auth_required`).
- Friends and shareable libraries: collections with viewer/editor sharing, invitation links, a shared-with-me shelf.
- Cloud deployment of the API, storage and vectors (the build brief's PostgreSQL + pgvector path; the infra templates exist but are undeployed) with a priced plan.
- Everything a serious product needs that the local build skipped: OCR for scanned PDFs, capacity measurement, billing controls, abuse limits, backups.

## Open from the Phase 1 finish review (carried, not blocking)

- Tags and result piles share pixels at stations with results; the note can sit over the last paper of a long pile; on phone the note can cover the end of the answer.
- The paper tooth, ribbon, string, pin and stamp are authored vectors standing in for drawn plates.
These are moot once the world is replaced; they are listed so nobody mistakes the pad for finished polish.
