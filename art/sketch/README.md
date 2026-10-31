# Sketch Keeper animation assets

The original sketch set has 48 distinct AI-assisted raster drawings. The current player composes that base with replacement motion sequences and new ladder-climbing/top-out artwork. The expanded gait packaging and final composed count are still pending at this checkpoint. Original sketch sources and prompts remain here; climbing production is recorded in [../sketch-climb/PROMPTS.md](../sketch-climb/PROMPTS.md), and replacement gait sources are in `art/sketch-motion-v2`. The old `public/character/` assets have not been changed.

## Player contract

The player loads `/character-sketch/manifest-v3.json`, composed by `art/compose-keeper-manifest.mjs`. It exposes `width:256`, `height:320`, and `states`. The composer merges the base `/character-sketch/manifest.json`, the optional `/character-motion-v2/manifest-fragment.json`, and `/character-climb/manifest-fragment.json`. A state has `frames` (public-relative WebP URLs), `fps`, `loop`, `anchors` and `frameAnchors`. All landmarks are normalized to the shared canvas. Coordinates refer to the unmirrored drawing facing RIGHT. Mirroring changes an anchor x to `1-x`.

- `idle`: four available perched drawings. The current player holds only frame `00`, without cycling, breathing motion or jitter. Its measured seat landmark places the hip on a real collection edge; the journey converts that pose to a continuous feet anchor before movement.
- `stand`: leaning forward, pushing off knees, rising and standing. Replacement intermediate drawings are being packaged. Transition progress selects the rising pose; the player clamps a standing hold rather than looping it.
- `walk`: alternating slow shuffling poses, with replacement intermediate drawings being packaged. Ordinary horizontal travel is 46 pixels per second with planted pauses, on a twelve-tick movement clock.
- `away`: rear-view poses, also receiving replacement intermediate drawings. Later poses show the back of his head/jacket; playback uses the composed state's frame rate.
- `reach`: four reach/push poses retained for explicit contact. A `grip:` support holds the calibrated final drawing, frame `03`; if another drawing is used, its own palm landmark must also be used to recompute contact. The return ascent now uses a visible ladder and separate climb poses.
- `rummage`: eight drawings leaning/peering/shuffling imaginary contents; combines four drawings from each of two sheets. In the rear depth plane, the image is refracted through actual glass folders and occluded by opaque UI.
- `pull`: four leaning-back grips. Move the bubble and contact hand together to imply weight.
- `carry`: four walking poses hugging a small plain book. Only use when an actual result/import exists.
- `peek`: four crouch-to-emerge drawings. Frame `00` is held when crouching under a low control; the sequence is also available for looking out from behind glass. The current offscreen route returns through the same viewport edge it left.
- `shrug`: four failure/recovery reactions. Trigger on actual empty/error states.
- `search`: the last four rummage drawings separately addressable for storyboard variety; these are references to the same files counted by `rummage`, not extra unique drawings.
- `climb`: eight new drawings alternating hands and feet on visible ladder rungs. Pose progress follows the current rung cycle instead of a time-only loop.
- `clamber`: four new top-out drawings transferring weight from ladder to shelf and into the seated pose. The transition selects these drawings once in order.

Feet are around `[.5,.95]`; the exact location is retained per frame. Reach/pull/peek/search have measured hand landmarks. The state-level hand anchor is the final frame contact point; frame-level landmarks give closer contact through the whole sequence. Idle has per-frame hip seat landmarks.

The production player measures the current DOM surfaces and builds a 2.5D route in `lib/keeper-choreography.ts`. Folder tops support the character, opaque controls block horizontal movement, and unsupported movement falls to the next surface or floor under gravity. Low clearances use a fixed crouch drawing with travel at 34 pixels per second. Front/back changes are legal only around a clear outer edge. Completion and cancellation begin at the interrupted position, depth and falling velocity; an interruption during climbing keeps or deliberately releases the actual ladder support.

`KeeperLadder` draws the support separately from the raster poses. A return route checks the visible side alley and landing, extends the ladder from the floor, climbs with pauses at rungs, transfers onto the collection using `clamber`, and retracts the ladder once the character is supported on the shelf. New work during a climb can descend the existing ladder before starting another route. The folder list and toolbar are aligned to leave the alley clear; mobile layouts use vertically stacked folders. The rail geometry stays fixed during climbing rather than following the actor upward.

`KeeperGlass` portals a copy of the current drawing into each overlapping real folder, below its text and controls. The full folder rectangle determines the SVG's local coordinates; the visible clipped rectangle determines viewport masking. SVG displacement supplies the funhouse-glass effect. This distortion changes only the view through glass; it does not synthesize replacement body poses or change collision geometry.

Lossless WebP files retain generated alpha and white interior fills. The actor canvas and glass layer both apply `grayscale(1)` to neutralize tiny antialias pixel chroma from generation. Do not tint or add smooth interpolated body motion. The player supplies a small shadow at the actual support/floor height, rather than baking it into the sprite.

## Extraction and verification

Run `node art/sketch/package-frames.mjs` from the repository to rebuild the runtime sprites. Requires the project's Sharp dependency plus ImageMagick. Extraction isolates each alpha-connected figure, expands its mask three source pixels to preserve contours, crops and scales it. No body pose is created by programmatic deformation; every frame was drawn by the image generator.

The ladder packager is `art/sketch-climb/package-frames.mjs`; it writes `public/character-climb/manifest-fragment.json`. After packaging the motion and climbing fragments, run `node art/compose-keeper-manifest.mjs` to rebuild the player manifest. If the optional motion fragment is absent, the composer retains the older walk/away/stand sequences, so successful composition alone does not prove the expanded gait is installed. The manifest's `uniqueDrawings` is the composed count; final checks must confirm every referenced file and inspect the complete climb/top-out in the browser. Those final integration checks remain pending at this checkpoint.

Each sequence has a white-background contact sheet here for visual inspection. The source sheets retain unmodified generated pixels. Runtime frame colors have not been repainted or thresholded. The artist-like roughness and contours vary slightly between generated frames; the result is expressive low-frame-rate sketch animation rather than production animation cleanup.
