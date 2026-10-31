# Finder-Keeper character assets

The character is an original adult librarian illustrated with black ink, white highlights, screen tone, and crosshatching. The supplied references inform posture and atmosphere rather than reproducing an existing character.

Production uses the built-in image generation tool, followed by deterministic sprite-sheet extraction with ImageMagick. Source illustrations are retained here; optimized runtime assets live in `public/character`.

The animation uses distinct raster drawings. The scene may change position and scale to put the character into perspective, while each sprite sequence changes body pose. The wooden box is a separate fixed prop. No image-generation API credentials are needed to use the finished assets.

Runtime integration contract is recorded in `public/character/manifest.json`. All character frames and the separate box share a 384 x 512 canvas. The feet baseline is y=492 (anchor x=0.5, y=0.9609375). Stack `box.webp` behind an actor frame using identical bounds; the box remains stationary while the actor departs. `seated.webp` is a correctly aligned static composite. `hero.webp` is the more detailed standalone illustration, with different framing, intended for artwork display rather than an interchangeable animation frame.

There are 60 distinct drawings: 12 idle, 12 stand/turn, 12 walk away, 12 walk back, and 12 sit. Manifest defaults are 3 fps idle, 8 fps stand/sit, and 10 fps walk cycles. The 60 individual runtime WebP images total 1,296,540 bytes. Optional 4-column, 3-row atlases total 1,270,036 bytes; each atlas is 1536 x 1536. PNG originals are retained for future packaging. The renderer can use either frames or atlases and should preload before playback. Use the static seated composition for reduced-motion preferences.

`node art/package-frames.mjs` recreates runtime assets using ImageMagick. It detects the 12 separate opaque subjects rather than blindly cutting equally sized cells, since generated source sheets have slightly unequal row spacing. It crops each drawing, normalizes pose height, anchors feet, packages transparent assets, and creates contact sheets. It does not synthesize intermediate drawings.

Validation: all five contact sheets and the actor/box composite were visually inspected; all 60 frame PNG hashes are unique; all frames are 384 x 512 with alpha. The application must still validate state transitions and perspective movement in its actual player. Prompts and source sheets are preserved alongside this file.

Animation production is AI-assisted. Final integration should inspect transitions, foot placement, and visual continuity at the displayed size; generated sequences can exhibit small contour changes and are not equivalent to a manually cleaned studio animation.
