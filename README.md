# Finder-Keeper

## The shop, wider than your window

The library at `/` (and `/clerk-room`) is one continuous pencil drawing of the Keeper's bookshop, drawn wider than the screen. Three stations sit along it: the **document desks** on the left (saved passages, the drawers of your collections, the tray for adding a document), the **counter** in the middle (the open book, for questions answered from your library), and the **window** on the right (the spider, sent out onto the web for free full text). Every object wears a hand-lettered tag that says what it does. You write on the slip docked at the bottom and point the Keeper at a station; the shop pans there, he walks or the spider climbs out, and what he finds appears at that station as papers you can pull forward from under one another. Opening a paper pushes in close on it; the reader keeps its original and readable-text views.

Phones frame one station at a time (swipe, or walk with the arrows at the edges); the slip stays in the thumb zone. The counter note names every state in words (idle, working, found, empty, error, cancelled, and imports as queued → processing → searchable or failed). **Pause** freezes the motion without touching the request, and **Plain list** lays every station and paper out as a stepped column for keyboard and screen-reader use; reduced motion gets static poses and no panning. Results never wait for the animation; cancellation and errors interrupt it.

The shop ships the ink illustration only (`public/clerk-room/front-illustrated/`, articulated in `components/clerk-illustrated-scene.tsx`). The Blender and pixel-art scenes are no longer part of the main route; their sources stay in `art/` and `public/clerk-room/` as history. Type is Architects Daughter for what is written by hand and Special Elite for what the Keeper types on his cards, both self-hosted through `next/font`. The surface's design record is in `docs/shape-main-room.md` and `.impeccable/`; the previous bookseller design remains at `/classic`.

## Previous selected design

The earlier library at `/classic` uses the bookseller’s ledge (Option 1), with the spider’s lost-and-found window, inside an old, cozy manga bookshop. The visible header and introductory copy are removed; the search modes sit directly on the counter. The bookseller stays seated on the counter as a still illustration. Collection drawers open directly when selected; document reading, folder scope, search, imports and management retain the existing backend behavior. The spider’s motion can be paused independently of requests. See [selection and QA notes](docs/bookseller-selection-QA.md).

## Five interactive design studies

Open [the drawing room](http://127.0.0.1:3000/ui-studies) to revisit the five alternatives: the happy bookseller's search-counter ledge, the curious wanderer's manga panels, a spider librarian's web archive, the kindly mage's rain window, and an inventor sharing a desk with Pip. Each has a separate spatial layout and playable controls; character contact points are tied to the counter, panel, drawer, sill, or desk. The spider also has a four-drawing crawl along a drawer edge.

Use the feature checkboxes and notes beneath each scene to combine ideas. Choices persist in that browser and can be downloaded from **My mix of ideas**. Searches and document pages in this room are explicitly scripted samples; they do not call the library backend or change saved documents. The existing library remains at `/`.

The five new leads each have two generated ink poses, with four additional spider crawl drawings. Source strips, exact prompts, reproducible packaging and measured contact anchors are under `art/ui-studies/`; runtime transparent WebP assets are in `public/characters/ui-studies/`. The drawings are generated artwork; the interactions are working layout prototypes, not complete production character rigs. Pause and operating-system reduced-motion preferences are supported.

## The library

A quiet research library with a warm manga bookseller and a curious spider. Find openly available documents, save them into folders, and retrieve relevant passages by describing what you remember.

**The default application runs on your own computer. It requires no GCP account and makes no paid model calls.** Files, document metadata, and real text embeddings remain in this project. The optional cloud templates have not been deployed.

The [build brief](docs/BUILD_BRIEF.md) records the product breakdown, updated implementation prompt, phased plan, verified acceptance, and remaining boundaries.

## Start locally

Prerequisites: Node.js 22 or newer, npm, Python 3.12, and [uv](https://docs.astral.sh/uv/getting-started/installation/).

```sh
./scripts/setup-local.sh
./scripts/dev.sh
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The API runs on loopback port 8010, preserving an existing service on port 8000. The first startup downloads the BGE small embedding model once; indexing can take longer while the model is warming. Later semantic searches use the downloaded model locally. Press Ctrl+C in the launching terminal to stop both services. If necessary, set `BACKEND_PORT` and the matching `API_INTERNAL_URL` in `.env`; the launcher checks both ports and never takes over another service.

`setup-local.sh` installs the website packages into `node_modules` and Python packages into `backend/.venv`. It creates `.env` only when none exists. It does not modify other projects or install system services. The launcher reads `.env` without executing it, and existing environment variables take precedence.

Use the supplied starter documents to try a paraphrased search, then upload your own PDF, EPUB, or text article. Starter material is labeled in the library. Online discovery still needs an internet connection; embedding and saved-library retrieval do not require a cloud service.

## What the local stack does

| Part | Local implementation | Later cloud counterpart |
| --- | --- | --- |
| Website | Next.js / React, same-origin API proxy | Container hosting |
| API and processing | Python / FastAPI | Cloud Run or Azure Container Apps |
| Original documents | `backend/.data/files` | Private GCS bucket or Azure Blob Storage |
| Library metadata | SQLite in `backend/.data/library.db` | PostgreSQL |
| Embeddings | BGE small through FastEmbed, 384 dimensions | Keep the same model, or deliberately re-embed |
| Similarity retrieval | Stored vectors and local similarity calculation | PostgreSQL with pgvector |
| Authentication | One local user, loopback access | Firebase or another verified identity provider |
| Background imports | Local worker and persistent job records | Authenticated task queue and worker |

This is real embedding retrieval. The local version does not claim to run a pgvector database: SQLite stores the vectors and the API computes similarity. The PostgreSQL adapter is available for a migration rehearsal.

The three scopes distinguish finding a document online, locating a document or passage already saved, and answering from the library. Online discovery defaults to checked free full text in PDF, HTML, EPUB, or text form. Catalog entries, previews, paywalls, and unverified copies remain in a separate optional list. The agent tries other copies and providers when a match is unusable. Readability and permission to save a copy are separate decisions; every remote import is checked again before indexing. Import status separates queued, processing, searchable, and failed work. Source pages and downloaded documents are data, never agent instructions.

Book requests have an optional OAPEN adapter based on its [documented search API](https://www.oapen.org/article/8185269-search-using-a-rest-api). That endpoint returned **HTTP 403** from this machine during the build on October 19, 2026. Its parser and error behavior have synthetic contract tests; successful live OAPEN discovery is unverified. Provider failures are shown explicitly, and a fallback must use actual results from another provider. Metadata availability does not establish that a listed file is downloadable or that its edition matches the request.

Book searches also use the live OpenStax catalog and Gutendex/Project Gutenberg metadata. Providers supply candidates; the application checks downloaded content, identity cues, access gates, and preview markers before showing a free result. Verification is bounded and conservative; it does not certify edition completeness. OpenStax catalog/detail requests were verified live. Gutendex ID lookup worked, but title/topic searches timed out on this machine during implementation and are reported explicitly. EPUB 2/3 uploads and imports preserve reading order and section citations; DRM-protected books are unsupported.

## Earlier character study

The separate `/keeper-study` prototype retains its earlier motion experiments. These do not run on the main library page.

The prototype room is deliberately minimal: glass folders on the left, one search bar on the right, and Keeper seated on its top edge. Folder contents and search results appear only when needed. Uploads, imports, search scope, help, and motion controls remain available.

Keeper uses original AI-generated rough black-and-white drawings assembled in `public/character-sketch/manifest-v4.json`. The walk and rear walk contain both opposite steps. Crawl drawings exchange hand and knee support; ladder drawings exchange the raised hand and knee. Journeys play at 2.4 times the original speed; direct mouse dragging and drop gravity remain responsive at their normal rate. Movement selects these drawings from distance travelled, with one full climbing cycle covering two rungs. Sitting holds one drawing still. Shelf repositioning now rises, walks or crawls, then sits; it does not translate a frozen seated image.

Drag Keeper by his body at rest or during a journey. Release him over a folder or the search bar to land on its upper edge, or elsewhere to fall toward the floor. A drop never snaps upward to a nearby surface. After a brief landing reaction he navigates from the new position; the search bar is his home. Keyboard users can focus Keeper, press Space or Enter to pick up, use arrow keys (Shift for larger moves), then press Space or Escape to drop. Manual movement remains available while autonomous motion is paused.

The world uses measured UI surfaces, gravity, explicit front/back depth, and a visible ladder in a clear alley. When Keeper passes behind a folder, the same drawing is refracted through its glass beneath readable text. This is a small 2.5D character controller, not a general-purpose 3D simulation. Drawings are AI-assisted and retain small line variations between poses.

Real search, answer, upload, and import lifecycles drive the character. Local library search opens a real storage bubble and rifles through pages; asking about documents adds a held reading pose. These local actions stay inside the library, while online discovery keeps its offscreen excursion. Pages follow measured hand anchors and are also refracted inside the folder glass. Results appear immediately without waiting for the animation. A quick local response allows one visible storage check to finish before Keeper returns; cancellation and errors interrupt promptly. A slow response keeps the page-checking loop active. Completion or cancellation resumes from his current position, including after a drag. The small pause control and system reduced-motion preference stop autonomous journeys. The [motion study](http://127.0.0.1:3000/keeper-study) exercises animation without changing library data.

Character checks: `node --experimental-strip-types --test tests/keeper-*.test.mjs`. Rebuild the runtime manifest with `node art/compose-keeper-manifest.mjs`. Source prompts and motion drawings are under `art/sketch-motion-v3`; the old `public/character` assets remain archived and are not used by the library.

## Persistent data and limits

The default data directory is `backend/.data`. Keep it when updating the app. Copying the source repository alone does not copy an ignored local library. Before making a filesystem backup, stop the app, then back up this directory. A backup contains your documents and extracted text, so keep it private.

From the repository root, after stopping the application:

```sh
backup_file="../finder-keeper-library-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$backup_file" -C backend .data
tar -tzf "$backup_file" >/dev/null
printf 'Library backup: %s\n' "$backup_file"
```

This preserves the SQLite database, original files, and model cache together. Keep `.env` separately if you want to preserve optional configuration; the backup command deliberately does not include credentials. A future restore should be extracted into a fresh folder and checked before replacing the active library.

The default limits in `.env.example` are 25 MB per file, 1,000 pages per PDF, 500 saved documents, and 30 import jobs per hour. These constrain this personal prototype; they are not a cloud billing cap. `SEED_LIBRARY=false` disables starter-library creation for a new database. Changing it does not remove existing documents.

Set optional discovery values in `.env` if you have them:

- `OPENALEX_API_KEY`: scholarly discovery provider key.
- `UNPAYWALL_EMAIL`: contact address required for Unpaywall DOI resolution.
- `CONTACT_EMAIL`: contact address for polite scholarly requests.

Leave `EMBEDDING_PROVIDER=fastembed` and `GEMINI_MODEL` empty to keep the default path local. `OLLAMA_ENABLED=true` allows use of the existing local `qwen2.5:3b` model at `http://127.0.0.1:11434`; it does not download or start Ollama. If that service/model is unavailable, retrieval and citation excerpts remain useful through the extractive fallback. Set `OLLAMA_ENABLED=false` to use that fallback deliberately. The answer response identifies its provider.

The single-user local mode should stay on loopback. The supplied launcher binds both ports to `127.0.0.1`. Public hosting requires verified authentication and tenant-scoped storage/retrieval; do not publish the local-auth service through a tunnel.

## Verify the application

```sh
npm run typecheck
npm run build
cd backend
uv run pytest
```

Some embedding integration checks require the model weights to have downloaded. Browser checks should include uploading a real PDF, finding a passage using different words, opening its location, deleting the document, and confirming that it no longer appears in search. A passing unit suite does not itself establish cloud readiness or frame continuity.

## Optional local PostgreSQL rehearsal

Docker is optional; normal local use does not need it. To exercise the pgvector adapter without paying for a database:

```sh
docker compose -f infra/compose.postgres.yaml up -d --wait
```

Set this value in `.env`, then restart the app:

```dotenv
DATABASE_URL=postgresql+psycopg://finder_keeper:local-development-only@127.0.0.1:54329/finder_keeper
```

This starts a separate empty database. It does not automatically migrate your SQLite library. The API's database initializer creates the vector extension and indexes. The Docker volume retains data when the container stops. To stop the rehearsal without deleting that volume:

```sh
docker compose -f infra/compose.postgres.yaml down
```

Remove the `DATABASE_URL` value to return to the original SQLite library. Do not run two databases against the same files while adding or deleting documents.

## Cloud migration and the $20 monthly budget

Stay local for the current build. It has **no application subscription or cloud-service charge**; normal computer power, storage, and internet costs still apply. No cloud resource, paid API key, project, or billing account was created.

See [the infrastructure guide](infra/README.md) for the optional GCP foundation and a provider-neutral migration sequence. Dockerfiles are included for both services. Azure Blob Storage and Azure identity/queue adapters are future work; an Azure deployment is not implemented by changing a single environment variable.

The original always-on managed PostgreSQL proposal needs to be priced before deployment. For example, Google's published Iowa `db-g1-small` compute rate is $0.035/hour: **$25.55 for 730 hours before storage, backups, or app usage**. That alone exceeds the $20 ceiling. A `db-f1-micro` has a lower published rate but much less memory and no shared-core SLA; it does not establish a reliable whole-application budget. [Cloud SQL pricing](https://cloud.google.com/sql/pricing?hl=en), checked October 19, 2026.

A future small hosting configuration should start with zero minimum app instances, one processing instance, strict file and daily AI limits, private access, and a measured workload. Cloud billing alerts are notifications, not guaranteed hard spending stops. Keep a reserve below $20 instead of assigning the entire amount to baseline infrastructure.
