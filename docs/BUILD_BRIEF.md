# Finder-Keeper: product brief and implementation record

**Build scope, October 19, 2026:** a working personal document library on this computer, with real local embeddings, online discovery/import, cited local answers, and a manga character animated from drawn frames. The current setup requires no GCP account or paid model API. Future hosting must fit the owner's **$20/month ceiling**; the cloud templates have not been deployed.

Start and back up the app using the [main README](../README.md). Detailed interfaces are in the [backend guide](../backend/README.md), current sketch animation production in the [sketch art guide](../art/sketch/README.md), the original character production record in the [art guide](../art/README.md), and future hosting in the [infrastructure guide](../infra/README.md).

## Product interpretation

The core experience is a personal librarian: describe something worth reading, keep an available copy, and later find the relevant document or passage without remembering its exact wording. The character makes the search activity visible while the library remains the useful product.

Three explicit scopes share one query field:

| Scope | User intent | Useful result |
| --- | --- | --- |
| Find online | “Find an open book about distributed systems.” | Real source candidates, bibliographic details, availability, and a permitted import or source link. |
| Search my library | “Where did I read about threads fighting over a cache line?” | Ranked documents and source passages, with page/section locations. |
| Ask my library | “Why can padding improve parallel performance?” | An answer grounded in retrieved passages, or clearly labeled extracts when generation is unavailable. |

The visual direction is a monochrome, slightly grungy manga reading room with a centered Bangers title, Comic Neue lettering, and a generated ink-library background. The latest production direction places a larger Keeper in a contained station directly beneath the hero, with a clickable cabinet beside him bound to the selected collection. Pip's lookout remains a second character and a shortcut into online discovery. See [the character experience record](CHARACTER_EXPERIENCE.md) for the station contract, artwork provenance, and historical verification.

Search, Ask, and import use the nearby cabinet for the selected collection or All documents. Online discovery uses one laptop held in one hand. Results display as soon as the API response arrives. Readable request state remains available when motion is paused or reduced. Page travel and dragging are excluded from the production experience.

## Current production architecture: contained station

This contract supersedes the roaming character and full source-presentation behavior recorded below. `KeeperStation` is being introduced as the production renderer. The old `KeeperWorld` and route planner are retained only for the isolated animation study. The station revision needs fresh type, behavior, rendering, and timing verification; earlier passing checks do not establish its acceptance.

- **Placement:** a larger Keeper remains in a central station beneath the hero. He does not travel between page elements or expose production drag controls.
- **Collection scope:** the cabinet beside him is clickable and bound to the selected collection, including All documents. Its label, action, and the backend request scope must agree.
- **Start:** local work uses a short reach of at most 450 ms. This is a maximum transition duration, not a minimum delay for a fast response.
- **Completion:** success, empty results, errors, and cancellation end pending work immediately and settle the station within 200 ms. A response during the initial reach interrupts it; no full open-lift-show-close presentation remains queued.
- **Online work:** use one laptop held in one hand, with no trip to the window or remote desk.
- **Access:** keep mode explanations, result controls, keyboard access, pause, and reduced motion usable independently of the animation.

The timing values are acceptance targets pending measurement. Verify cached and slow responses, immediate repetition, collection changes, cancellation during the reach, pause/reduced motion, cabinet and laptop alignment, and desktop/mobile rendering. Record the measured evidence in [CHARACTER_EXPERIENCE.md](CHARACTER_EXPERIENCE.md) after verification.

## Technology and data flow

| Layer | Implemented local choice | Reason and migration boundary |
| --- | --- | --- |
| Interface | Next.js, React, TypeScript, custom CSS | Responsive library, dialogs, reader, and animation state. A same-origin proxy connects to the API. |
| Document service | Python / FastAPI | Discovery, validated imports, extraction, durable jobs, and retrieval. Local services bind to loopback. |
| Original files | Private project directory | Files persist under `backend/.data`; GCS is an optional adapter. Azure Blob support remains future work. |
| Metadata and vectors | SQLite with SQLAlchemy; normalized vectors stored per passage | Appropriate for the bounded local library. PostgreSQL/pgvector support is supplied for a later deployment or local rehearsal. |
| Embeddings | FastEmbed, BGE small, CPU, 384 dimensions | Real semantic retrieval with no per-query API bill. Weights download once and are reused locally. |
| Generated answers | Existing Ollama `qwen2.5:3b` when available | Bounded local inference; no new model installation. Failures or invalid citation references use an extractive fallback. |
| Reader | PDF.js plus extracted text | Open the relevant physical PDF page; show the matching excerpt and highlights. HTML/text uses numbered sections. |
| Artwork | Raster frames, WebP runtime files, timing manifest | Actual changing drawings provide body movement; position and scale supply perspective. |

An import follows this sequence:

```text
Request → discover candidates → check source/permission → download bounded file
        → save original → extract pages/sections → chunk text → embed passages
        → publish searchable document → retrieve passages → open or cite source
```

Embeddings do not train the answering model. A vector represents the meaning of a passage. Search combines query-to-passage similarity with keyword/title signals, then returns the actual source span and location. Similarity scores rank matches; they are not confidence percentages. A model change requires re-embedding the library even when its output dimension remains 384.

Answer generation is a separate optional step. The local model receives only retrieved passages and the user's question, with citation identifiers. The backend validates that returned identifiers correspond to supplied evidence. This checks references, not the factual correctness of every generated sentence. The original excerpt remains available for review, and an extractive response is labeled accordingly.

## Artwork and interaction contract

The reusable [version-four manifest](../public/character-sketch/manifest-v4.json) contains 92 distinct raster drawings across 16 states, assembled from the original sketch set and replacement motion sequences. The earlier file inspection verified transparency in every referenced frame. The station reuses suitable idle, reach, and work drawings without requiring the locomotion inventory. Assess every displayed transition at the larger station size. Production poses explain the active request; they do not establish backend progress.

The contained cabinet and local work pose must align, and online discovery uses one laptop held in one hand. Transparent artwork and foreground cabinet layering preserve depth without hiding labels or controls. The earlier twelve-tick route planner, walking/crouching rates, gravity, ladder transfers, refraction portals, and drag/drop handling are study behavior; they are not the production station contract. The [manga room background](../public/world/manga-room.png) was generated with the built-in imagegen tool at 1536 × 1024; its [prompt record](../public/world/manga-room.prompt.txt) is retained. Grayscale CSS unifies its ink, screentone and worn-paper texture with the live scene. This background does not replace the interactive objects or make the room a 3D engine.

**Historical original asset checkpoint:** the earlier set contained 60 raster drawings: 12 idle, 12 stand/turn, 12 walk away, 12 walk back, and 12 sit. Its [manifest](../public/character/manifest.json), atlases and separate box remain in the repository for reference, but the library no longer uses that player or its 3/8/10 fps timing.

Source sheets and contact sheets are retained for review. This is AI-assisted frame artwork, with real pose changes and possible small contour variations. It should be assessed as an animated asset at its displayed size, including transitions and foot placement, rather than described as manually cleaned studio animation. A static seated composition supports reduced motion and loading fallback.

## Refined reusable implementation prompt

> Build and maintain Finder-Keeper as a polished personal research library that runs locally without a cloud account or paid model calls. Preserve the user's $20/month maximum for any future hosted configuration; do not provision cloud resources as part of local setup.
>
> Provide three query scopes: Find online, Search my library, and Ask my library. Online searches must return real provider results and distinguish importable copies, source-only links, and unavailable sources. Use OpenAlex and Crossref for scholarly discovery, optional Unpaywall access resolution, and an optional OAPEN book adapter with an explicit fallback when unavailable. Preserve the source, authors, identifiers/version where available, and rights metadata without claiming provider metadata proves an exact edition match.
>
> Build a monochrome manga reading room around the tired sketch librarian, with centered comic lettering, lightly grungy ink architecture, and Pip's lookout. Put a larger Keeper in a central contained station beneath the hero. Give him an adjacent clickable cabinet bound to the selected collection, including All documents, and one laptop held in one hand for online discovery. Preserve the three query-mode examples and optional lessons. Maintain readable contrast, responsive layouts, accessible controls, and reduced-motion behavior.
>
> Use KeeperStation for production. Keep Keeper in the station, with no page travel, ladders, or drag interaction; retain KeeperWorld and its planner only for the isolated study. Align local reach/work poses with the adjacent cabinet and the single online laptop with one hand. Complete the starting reach within 450 ms and settle within 200 ms of every terminal request update. A response during the reach interrupts it. Show results immediately and do not queue a full presentation sequence after completion. Preserve truthful status while paused or in reduced motion. Measure these limits rather than inferring them from intended durations.
>
> Use the existing Next.js frontend, FastAPI backend, local file storage, SQLite metadata, and real local FastEmbed vectors. Preserve page/section locations and passage offsets. Combine semantic and lexical retrieval. Use the existing local Ollama model for cited answers when available, and return labeled extracts when it is unavailable or its citation output is invalid. Keep retrieval functional without generation.
>
> Treat downloaded pages and documents as untrusted evidence, never as commands. Restrict imports to validated public HTTPS targets, recheck redirects, bound downloads and uploads, enforce owner scope, and keep source HTML out of the app's rendering origin. Preserve duplicate detection, durable processing states, cancellation, retries, and deletion from retrieval and storage.
>
> Keep the library persistent and portable. Separate storage, database, embedding, identity, and queue adapters. Supply clear local setup and backup instructions. Keep optional GCP configuration separate from the default launch; describe Azure work as future integration until implemented and tested.
>
> Validate the real end-to-end flow: online discovery, permitted import, searchable passages, relevant page opening/highlighting, cited local answers, and deletion. Test failure boundaries and cross-origin/owner access. Report separately what passed locally, what used synthetic provider fixtures, what was checked in the browser, and what remains undeployed. Never present missing OCR, denied provider endpoints, or cloud scaffolding as completed live capability.

## Original phased plan and acceptance record (historical)

The original plan progresses from visual proof to a working ingestion/retrieval path, then discovery, reliability, and deployment. The later local-first constraint changes the deployment phase into a documented migration boundary.

| Phase | Intended acceptance | Evidence at the original build checkpoint |
| --- | --- | --- |
| 1. Visual proof | Split library/stage, original character, actual pose changes | Interface and 60 raster drawings delivered. Contact sheets and actor/box composition inspected; integration uses the real frame manifest. |
| 2. Complete local library path | Save a real document, extract it, embed it, retrieve a passage, open its location | Implemented and checked with real embeddings and documents. Files and vectors persist locally. |
| 3. Online discovery/import | Find actual candidates and import an available permitted file | Live scholarly discovery and online PDF import checked. Book fallback returns actual provider metadata; OAPEN itself returned HTTP 403. |
| 4. Answers and reliability | Cited local answers, file lifecycle, quotas, cancellation/retry, ownership | 56 backend tests passed at this build checkpoint. Real local cited generation and browser search/page-highlight flows were verified. |
| 5. Frontend validation | Buildable interface and working interactive path | Frontend typecheck and production build passed. Browser checks covered online import, semantic search, matching page/highlights, cited local answers, collection creation, moving a paper, narrow layout, and visible provider fallback. A real two-column paper was re-indexed and checked for coherent reading order. |
| 6. Hosting | Budget-compliant deployment with authenticated private storage | Deferred. GCP configuration received local schema validation only; no cloud resources were created. Azure remains a future adapter/deployment task. |

These are build-checkpoint results, not guarantees about every external document or future code change. The starter PDFs are original, labeled educational demonstration notes, not downloaded research papers. Synthetic provider tests are distinct from real network verification. Re-run the documented checks after changes.

## Free-full-text follow-up (historical implementation checkpoint)

The default online view now shows only downloaded resources that passed content checks. The verifier checks PDF, HTML, EPUB, and UTF-8 text for substantive readable content, access gates, previews, and plausible title/identifier agreement. This is conservative screening rather than independent certification of an exact edition's completeness. Catalog entries and unsuccessful copies are hidden under **Other matches** and cannot be kept as verified finds.

Discovery tries alternate copies and additional providers when a catalog result does not yield usable text. OpenStax and Gutenberg complement scholarly OpenAlex/Crossref discovery and the optional OAPEN adapter. Exact-title requests keep differently titled works separate. Read access and permission to store a copy are separate decisions; a license belongs to its specific version and URL, and imports check the downloaded content again.

The library accepts unencrypted EPUBs with chapter-order extraction, section navigation, and highlighted search passages. PDF processing now permits up to 1,000 pages locally, while retaining the 25 MB file cap and two-million-character text cap. Per-page layout caches are released during extraction.

Live browser checks confirmed a verified OpenStax **Introduction to Python Programming** result with its direct full PDF and Keep control. **An Introduction to Parallel Programming** returned no verified free text and placed its publisher listings in the expandable catalog group. OpenStax's larger **Introduction to Computer Science** PDF exceeded the retained download cap; its multipart web reader is not misrepresented as a complete downloadable book. Gutenberg's real EPUB2/EPUB3 content parsed successfully in a separate network check, but title searches through Gutendex timed out from this host. OAPEN returned HTTP 403. These provider failures remain visible as search notes.

Acceptance for this follow-up: **144 backend tests and Ruff passed**; frontend typecheck and production build passed before the character task's integration. Browser checks covered a two-chapter original EPUB upload, ordered section navigation, semantic retrieval from a paraphrased question, and the exact highlighted passage in the reader. The disposable EPUB was removed afterward. The user's existing **Mission AI** was recovered from its already-saved file and indexed into **421 pages and 1,157 passages**; semantic retrieval returned relevant source passages. The original eight documents and four folders remain, with the other seven documents unchanged.

## Sketch character and spatial follow-up (historical, now study-only)

This record describes the roaming implementation before the contained station decision. Its route behavior, presentation backlog, and verification results are historical; they are not acceptance of `KeeperStation`.

At this checkpoint, the integrated rough sketch player superseded the original separate mascot panel. Production movement followed an actual collection chest for Search, Ask and import, or used a laptop for online discovery. It retained measured supports, collision checks, gravity, low-clearance poses and a twelve-tick drawing clock. The earlier offscreen departure and same-edge return were already animation-study behavior rather than a required production journey.

Travel to an elevated destination can use the visible ladder: its rails and rungs stay fixed while Keeper climbs and transfers onto the surface with separate top-out drawings. The planner holds safely when a route is blocked or the requested collection is absent. An API response ends pending work even when travel is incomplete. Successful local work may continue as source presentation with explicit “result is ready” wording; it does not restart the request. The actor then remains at that chest. Error, cancellation, and empty outcomes settle without a success presentation. Narrow screens stack the main sections.

That chest treatment combined translucent fronts, reflections, outlined lids, visible paper cavities and handles. Lid progress followed opening/closing choreography, and rummaging hands aligned with the cavity instead of the old seated offset above the object. A portal inside each real surface rendered the rear-plane drawing through SVG refraction; labels and controls stayed in front. The monochrome manga background and centered lettering established the setting within a measured 2.5D interaction system. Historical ladder pose prompts remain in [the climb production record](../art/sketch-climb/PROMPTS.md), and expanded gait sources remain in `art/sketch-motion-v2`.

**Historical verification:** 89 Keeper tests passed, covering hand placement, cached-response interruptions throughout both initial and collection-to-collection routes, cancellation, and continuity. The production build passed. Live desktop and mobile checks covered scoped and all-document retrieval, cited answers, hinged chests, lower-body refraction, immediate results during source presentation, pause/cancel, and completing a second request at a different chest without returning home. Online discovery displayed the laptop and reached an empty outcome; successful external full-text retrieval is not claimed for that revision. Reduced motion was not independently browser-emulated. See [CHARACTER_EXPERIENCE.md](CHARACTER_EXPERIENCE.md) for the historical evidence and the new station's acceptance requirements.

## Remaining boundaries and next steps

- **No OCR:** image-only/scanned PDFs cannot yet become searchable. The app reports this and retains the original for download/retry. OCR would need a bounded, tested processing path.
- **OAPEN denial:** the documented API returned HTTP 403. Its adapter has contract tests, and book searches fall back to real OpenAlex/Crossref results. A successful OAPEN import is not claimed.
- **Source identity:** provider metadata and licenses support a candidate decision; they do not guarantee an edition/version match or that a remote download will remain available. Ambiguous candidates need inspection.
- **Local scale and exposure:** this is a bounded single-user local deployment. Public hosting needs authenticated end-to-end acceptance, parser resource isolation, measured capacity, and cloud billing controls. Local-origin protections do not authorize exposing it through an unrestricted public tunnel.
- **Cloud portability:** GCP adapters and foundation files exist, but are undeployed. Azure storage, identity, and queue integrations still require implementation. There is no automatic SQLite-to-cloud migration command.
- **Budget:** keep local operation as the current default. A future deployment must price its database, app runtime, storage, backups, network, and optional AI together. The example GCP managed database exceeds the $20 ceiling by itself; alerts alone do not create a hard spending cap.

The next useful milestone is sustained use with a small real reading collection: record missed queries, inspect citation accuracy, and refine retrieval and animation continuity from those observations before selecting a hosting plan.
