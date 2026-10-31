# Keeper station laptop pose

Generated on 2026-10-19 with the built-in image generation tool (identity-preserve edit from two local Keeper references). No CLI generation or manual pixel editing was used. The original generated output is preserved.

## Files and provenance

- Runtime asset: `keeper-station-laptop.png`.
- Source output: `/home/nikola/.codex/generated_images/01a153a4-9ac2-76e3-99a4-a5e4adad4d07/exec-e339e7b9-b55c-4adc-aa8b-86b506173e8b.png`.
- Reference 1: [Keeper seated idle](../character-sketch/idle/00.webp), used for character identity and drawing style.
- Reference 2: [Keeper walking](../character-motion-v3/walk/00.webp), used for full-body identity, clothing, proportions, and drawing style.
- Generation elapsed time: 31.244 seconds.

## Asset inspection

The generated preview was visually inspected: the Keeper faces left, supports the open laptop from underneath with one hand, and types with the other; both arms are connected and both feet are visible. This is one still illustration, not a rigged animation. Browser integration and verification are owned by the main implementation task.

Read-only alpha inspection: 1024 × 1536 PNG, RGBA, 1,253,787 bytes; alpha range 0–254, 73.16% of pixels fully transparent, all four corner pixels fully transparent. Bounding box at alpha ≥128 is x=129–790 and y=21–1517 (right/bottom exclusive bounds: 791/1518). The character's feet reach approximately 98.8% of the canvas height. Extremely faint alpha fringes produce broader nonzero-alpha bounds, so use the visible alpha bounds when aligning with the existing sprites.

## Full prompt

```text
Use case: identity-preserve.
Asset type: one transparent full-body character pose for the Finder Keeper manga library website, rendered around 300px tall.
Input images: Image 1 is the original Keeper seated idle pose; Image 2 is his walking pose. Both are identity AND drawing-style references. Repose this SAME Keeper; do not create a different man or redesign him.
Primary request: draw the Keeper standing still, relaxed and slightly slouchy, full body in a three-quarter view facing LEFT. His bent LEFT elbow stays close to his body, his left forearm is almost horizontal, and ONE left hand is visibly palm-up underneath the base of a small OPEN LAPTOP supporting its weight at upper-waist height. His other arm is visibly connected to the other shoulder and bends naturally so his right hand rests over the keyboard typing. Exactly two arms and exactly two hands total. The laptop and both hands are a single physically coherent interaction, not floating objects.
Identity invariants: keep his exact tired angular face, sleepy half-lidded drooping eyes, small wry mouth, tousled short black hair, prominent ears, skinny elongated limbs and narrow slouching shoulders. Same rumpled light suit jacket, light collared shirt, loose narrow dark necktie, light trousers and dark simple shoes. Same proportions as the references.
Drawing style: preserve the references' loose irregular thin black-ink contours, small scratchy hatching accents, flat white interior shapes, understated ink drawing. Sparse shading. Do not polish into glossy generic anime, no large glittery eyes, no dense screentone, no realistic rendering. Pure black, white, and restrained grayscale only.
Laptop: small thin notebook computer, lid open around 105 degrees. Supporting palm clearly touches the underside of the base. Keyboard is visible enough to understand the typing hand. Screen is angled partly toward the viewer with a few grayscale hatch and small interface-like strokes, no readable text and no bright glow. No brand/logo. Laptop placed left of the torso without covering the face.
Composition: portrait canvas approximately 2:3 or 4:5. Entire head, both arms, laptop, and both shoes visible. Character occupies about 85-90% of image height, feet baseline at about 95% height, calm standing stance with both feet planted. Sufficient transparent margins around every contour. Crisp original linework legible at small size.
Background: genuinely transparent PNG alpha. No backdrop, no scenery, no floor, no shadow, no panel, no written labels, no painted checkerboard. Opaque white character/clothing interior shapes with transparent negative space outside.
Avoid: additional people, additional hands or arms, disconnected limbs, extra laptop, a table or laptop stand, returning to an idle pose without laptop, a large muscular build, changed clothes.
```

