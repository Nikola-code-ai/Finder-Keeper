# Character experience: a contained request station

Implementation direction, October 19, 2026. The contained station below is the current production contract and is being implemented. Its timing, rendering, and integration require fresh acceptance checks. Earlier verification records describe earlier revisions; they do not certify the station. See [BUILD_BRIEF.md](BUILD_BRIEF.md) for the product and historical checkpoints.

## What needed to change

The character had many poses, but his excursion did not explain the user's request. Returning to an initial seat erased continuity. Glass folder cards looked like ordinary interface rows, their transparency had little narrative purpose, and the three query modes lacked an explanation of their different inputs and outputs. More animations alone would not resolve those problems.

The monochrome, slightly grungy manga panel and centered title remain the visual direction. The latest interaction correction makes Keeper larger and places his work in a contained station immediately beneath the hero. Long journeys, dragging, and a full presentation sequence obscure quick requests. A nearby cabinet and one handheld laptop can explain the operation without moving the character around the page. Local work still needs visible contact with the cabinet rather than a pose in empty space.

The intended relationship is simple: **the user gives a job, the cabinet identifies the collection, and Keeper makes the request state visible.** The result is usable as soon as the response arrives.

## Current production architecture: KeeperStation

These are implementation requirements for the new station, not measured results. `KeeperStation` replaces the production roaming renderer; the prior `KeeperWorld` and route planner are retained for the isolated animation study.

| Concern | Current station contract | Relevant component or boundary |
| --- | --- | --- |
| Purpose | A persistent request panel names the real operation, submitted question, outcome, and available status. | [library-scene.tsx](../components/library-scene.tsx), [library-app.tsx](../components/library-app.tsx) |
| Placement | A larger Keeper stays in a central contained station beneath the hero. Production has no page travel, ladders, roaming, or drag controls. | `KeeperStation` and the page layout |
| Start and completion | A local request begins with a reach of at most 450 ms. Every terminal response settles the station within 200 ms, without waiting for a full presentation sequence. These are upper limits, not minimum delays imposed on a fast response. | `KeeperStation`; timing acceptance pending |
| Collection binding | A clickable cabinet beside Keeper represents the selected collection, or All documents. Its label and action must agree with the actual local query scope. Changing collection does not move Keeper across the page. | `KeeperStation`, [library-app.tsx](../components/library-app.tsx) |
| Physical work | Local poses align with the nearby cabinet. Online discovery uses one laptop held in one hand. Neither operation requires a journey or a second prop. | `KeeperStation`; rendered hand, prop, and cabinet alignment to verify |
| Transparency | Transparent character artwork and cabinet layering give the contained work depth while keeping labels and controls readable. | Station rendering and styles; acceptance pending |
| Another character | Pip is an original scruffy cat peeking through the discovery window, drawn from actual Keeper artwork as the style reference. Only his head and two front paws are visible, resting on the actual sill behind the foreground frame. Matching sleepy and attentive drawings follow real online-request activity; the window selects online discovery and focuses the input. Pause and reduced motion disable the pose crossfade. The paws remain anchored, with no whole-body sway. Pip is not a downloaded 3D rig or an independent search agent. | [library-scene.tsx](../components/library-scene.tsx) |
| Educational role | Three job cards explain scope, provide examples, and reveal a short “How it works” lesson. | [request-guide.tsx](../components/request-guide.tsx) |
| Room and lettering | A centered Bangers title and Comic Neue lettering sit above a black-and-white manga panel. The larger station, generated ink-library background, screentone, outlined cabinet, and Pip's lookout share the same monochrome treatment. This remains a layered interface, not a true 3D world. | [layout.tsx](../app/layout.tsx), [reading-room.module.css](../components/reading-room.module.css) |

The old `planRequestPending`, `planRequestSettled`, travel, drag/drop, and full source-presentation paths belong to the study implementation. They must not determine the production station's response time or schedule work after the request has ended.

## Request truth versus visual interpretation

`library-app.tsx` starts an activity with the real operation and collection scope. Request identifiers prevent an older response from finishing a newer activity. Search, discovery, and answer completion come from their actual API responses; failures and cancellation have separate outcomes. Import activity follows the job's reported stage and terminal status.

Search, discovery, and answer endpoints currently provide a response rather than a stream of detailed progress events. Their pending wording therefore describes the operation broadly. A pose that looks like reading is a visual interpretation, not proof that the backend has reached a particular internal step. Do not add timed percentages or claim a completed retrieval, source check, or generation step without corresponding evidence. Import stages can be more specific because the job reports them.

Results render on response arrival. Success, empty results, errors, and cancellation interrupt pending work immediately; the station must settle within 200 ms of that terminal update. A cached response arriving during the initial reach must interrupt that reach. There is no queued open-lift-show-close sequence and no minimum work duration to complete before settling. The same rule applies to local retrieval and online discovery.

Motion pause affects animation only. Reduced motion retains the request panel and functional controls. Completion must remain visibly distinct from pending work while motion is paused or reduced. Subsequent requests use the same station and updated collection binding; there is no production pickup/drop interaction or return-home movement.

The educational explanations preserve these distinctions:

- **Find online:** discovers candidates and checks usable full text; availability does not establish scholarly quality or automatically authorize keeping every copy.
- **Search my library:** combines passage meaning with words and titles; similarity ranks matches and is not a confidence percentage.
- **Ask my library:** retrieves evidence before generating an answer; citations need checking, and unavailable or invalid generation produces labeled extracts.

## Current artwork and asset options

The active [version-four manifest](../public/character-sketch/manifest-v4.json) references **92 distinct raster frames across 16 states**. A file inspection verified that all 92 images are RGBA and contain transparent pixels. The states include walking, reaching, searching, rummaging, carrying, climbing, crawling, pickup, and landing. These are discrete drawings with anchors, not a skeletal character rig. The coverage is sufficient to improve request causality without replacing the character first.

The room artwork is [manga-room.png](../public/world/manga-room.png), generated with the built-in imagegen tool on October 19, 2026 at 1536 × 1024. Its [saved prompt and provenance](../public/world/manga-room.prompt.txt) specify ink library architecture, lightly worn paper, empty foreground, and no characters, text, chests, laptops, or fake interface. CSS applies grayscale and contrast; interactive chests, laptop, characters, and controls remain separate live elements. The background is generated artwork, not a photographed room or a 3D scene.

The preceding standing-Pip revision used two original humanoid manga drawings: [idle](../public/characters/pip-manga-idle.png) and [searching with a spyglass](../public/characters/pip-manga-search.png), generated with the built-in imagegen tool. Both are 1024 × 1536 RGBA with verified transparent backgrounds. The user selected a little humanoid companion inspired by Puck from Berserk and Kiba from Naruto. The [complete prompt set and reference provenance](../public/characters/pip-manga-PROMPTS.md) records both generations. Those full-body drawings are retained as source artwork but are no longer used in the window. Pip is a mode shortcut and status companion, not a separate search service.

The preceding humanoid window poses are [peeking idle](../public/characters/pip-window-idle.png) and [peeking search](../public/characters/pip-window-search.png). They were redrawn with the built-in imagegen tool using Pip as an identity reference. Only face, hair, ears, and forearms appear. The CSS window aperture clips the artwork; a foreground frame and sill establish contact and conceal the body. The [window-pose prompts](../public/characters/pip-window-PROMPTS.md) record the production details. These humanoid poses are retained as source artwork after the user requested an animal replacement.

The current Pip is a scruffy black-and-white cat: [sleepy idle](../public/characters/pip-cat-idle.png) and [attentive search](../public/characters/pip-cat-search.png). The built-in imagegen tool used Keeper’s actual idle and walking drawings as style references for the irregular ink contours, sparse hatching, and sleepy expression. Both poses show only an animal head and two forepaws on the sill, with no human hands, clothes, or full body. The [cat-pose prompt record](../public/characters/pip-cat-PROMPTS.md) preserves generation provenance.

External options were checked against creator documentation on October 19, 2026. None has been downloaded, retargeted, or integrated into this implementation.

| Option | Verified offering | Integration boundary |
| --- | --- | --- |
| [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) with [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) | Six humanoid base models, 20 hairstyles, and glTF/FBX support. The animation family advertises 120+ clips, including directional locomotion, sitting, pushing, and crawling; root-motion and stationary variants are listed. CC0. | Strong candidate for a consistent cast. Standard, Pro, and Source editions differ; the advertised total must not be treated as the free archive's verified inventory. Retargeting and browser rendering still need a prototype. |
| [Quaternius Universal Animation Library 2](https://quaternius.itch.io/universal-animation-library-2) | Advertises 130+ humanoid animations, additional movement and activity types, and root-motion variants. CC0; a paid Source edition includes Blender rig and animation files. | A supplementary motion library, not a complete cast or interaction system. Actual free-archive clip coverage has not been inspected. |
| [Kenney Mini Characters](https://kenney.nl/assets/mini-characters) and [Animated Characters Protagonists](https://kenney.nl/assets/animated-characters-protagonists) | Creator pages identify animated 3D assets and CC0 licensing. | Exact skeletons, required poses, and animation inventory remain unverified. Useful stylized alternatives, not a demonstrated complete replacement. |
| [Adobe Mixamo](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) | Adobe documents free access with an Adobe ID, royalty-free creative use, and humanoid-biped auto-rigging. | No specific character/clip set was inspected. Account access, export, conversion, and compatible retargeting remain integration work. |

Prefer one coherent character family and shared action vocabulary over unrelated downloaded mascots. The current two-character division is Keeper for library work and Pip for external discovery. Any future companion should explain an additional role rather than duplicate the same decorative behavior.

## Station acceptance gates — not yet recorded

Verify fast and slow requests, empty results, errors, cancellation, and repeated actions. Measure that the starting reach is at most 450 ms and terminal settlement is at most 200 ms, including a response during the reach, cancellation while paused, and a new request immediately after completion. Confirm that no old presentation or travel sequence continues after the request ends. These timing limits are acceptance targets, not measurements established by this document.

Check that the adjacent cabinet is clickable and represents the selected collection, including All documents; its action, displayed label, and backend query scope must agree. Inspect local hand/cabinet contact, the single laptop held in one hand, transparent layering, the larger central character, monochrome contrast, keyboard access, narrow layouts, scrolling, pause, and reduced motion. Confirm there are no production drag controls or page-travel behavior. Distinguish fixture-based state checks from real backend and external-source requests. Record new browser and timing evidence separately.

A separately approved future true-3D experiment could use the following vertical slice. It is not the current station scope or a reason to restore production roaming:

1. One rigged character walks to a cabinet, turns, reaches a handle, opens it, handles a document, and remains at the destination. Feet, hands, props, and collisions remain aligned through transitions.
2. At least two distinct characters share the required locomotion and work clips with no missing-pose fallbacks; their roles remain understandable without animation.
3. Glass, foreground objects, lighting, and shadows preserve depth and text readability from supported camera positions.
4. Real request state remains independent of animation duration, including interruption, cancellation, rapid completion, and consecutive jobs.
5. Loading size, frame rate, memory use, and failure behavior are measured on desktop and mobile; keyboard controls, reduced motion, and a usable non-WebGL fallback remain available.
6. The shipped archive's license, edition, attribution requirements, clip inventory, and conversion steps are recorded. Browser acceptance covers the actual converted assets, not only the creator's preview.

## Historical verification: preceding room revision

The following record predates the monochrome room, hinged chests, laptop, and explicit presenting state. It is historical evidence. It and the subsequent revision records do not establish acceptance of the new contained station.

- Production build and TypeScript checks passed. All 77 Keeper tests passed, including fast responses, outcome handling, target selection, current-position continuity, glass transitions, and viewport-floor recovery.
- Browser checks used the real local backend: semantic search returned eight passages, opening a result selected the matching second page, and Ask returned correctly labeled source extracts. An online lookup completed with no verified full-text results; this verifies the empty-result presentation, not provider success.
- Desktop and 390px layouts were inspected. The narrow layout had no horizontal overflow, and the primary input remains usable. Mode explanations and their native disclosures were exercised.
- The isolated motion harness verified actual glass refraction at the selected drawer, completion preserving the same coordinates, and keyboard pickup/movement/drop without restarting completed work. These are simulated request events in a real rendered browser, separate from live backend checks.
- Motion pause was exercised while online discovery was pending; the request continued. Reduced-motion handling is implemented but was not independently browser-emulated in this pass. No external rig was integrated, no cloud deployment was performed, and the 3D acceptance gates above remain future work.


## Historical verification: monochrome chest revision

- The final Keeper suite has 89 passing tests, including measured hand placement, real desktop/mobile bounds, cached-response interruptions at all 496 frames of the home-to-collection journey and all 748 frames of a collection-to-collection journey, cancellation, and selected-collection continuity.
- Live browser checks at 1280 × 900 and 390 × 844 used the local backend. All-document searches returned eight passages; a Computer science search returned six scoped passages. Fresh journeys from the initial seat reached their actual collection and finished seated at that collection. A subsequent live request moved from Computer science to All documents and finished at the new chest without returning home.
- Open lids, hand/cavity contact, and lower-body glass refraction were inspected in the rendered page. Clicking a chest opens its actual document list. Chests now retain a consistent width, with a shared desktop aisle and a reserved mobile aisle; closing a list does not shrink the supporting object.
- Ask returned a locally generated, cited answer. Online discovery displayed the laptop and completed with no verified full text. This checks the animation and empty outcome, not successful external full-text retrieval.
- Pausing animation left the real request running; cancellation while paused produced the cancelled state, and resuming settled at the current support. The mobile layout had no horizontal page overflow. Mobile keyboard order follows the visible search-then-library order.
- Reduced motion was not independently browser-emulated in this revision. No external skeletal rig or true-3D renderer was integrated. Pip remains an online-mode shortcut and request-state indicator, not an independent search agent.

## Historical verification: humanoid Pip standing poses

- Browser inspection confirmed both transparent images load and composite correctly in the manga room. Clicking Pip from library mode selects Find online and focuses the query field.
- A real online request switched to the spyglass pose; completion returned to idle. A separate pending request showed animation-play-state paused while the request remained active. Cancellation restored the idle pose immediately, including while motion was paused.
- Desktop (1280 × 900) and phone (390 × 844) rendering were visually checked; the phone layout had no horizontal overflow. Typecheck and the production build passed after integration. The unchanged Keeper choreography retains its 89-test result.

## Historical verification: cat-at-window revision

- Both cat drawings use actual Keeper frames as style references. They were inspected as transparent head-and-paw artwork and in the real window: face and two front paws, concealed body, frame layered in front, and paws touching the sill.
- Desktop (1280 × 900) and phone (390 × 844) rendering were visually checked; mobile has no horizontal overflow. The retained window dimensions leave the collection layout unchanged.
- A real online request selected the attentive pose, with both images loaded successfully. Completion and cancellation restored the sleepy pose. No whole-character movement displaces the paws from the sill.
- Production build and TypeScript passed. Keeper choreography was not changed; its preceding 89-test result was not rerun for this artwork change.
