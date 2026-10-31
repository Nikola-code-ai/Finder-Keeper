# Pip cat window portraits

Generated 2026-10-19 with the built-in imagegen tool. The user requested an animal matching Keeper's style; the selected direction is a scruffy monochrome cat peeking through the existing window. Existing humanoid assets remain unchanged. No Python or other pixel editing was applied; generated files were copied directly.

## Idle: pip-cat-idle.png

- Source: /home/nikola/.codex/generated_images/01a153a4-9ac2-76e3-99a4-a5e4adad4d07/exec-25233365-f972-40d4-9f81-c17d7c6413bb.png
- Style references, both inspected before generation: public/character-sketch/idle/00.webp and public/character-motion-v3/walk/00.webp (repository paths).
- Generation wall time: 36.925 seconds.
- Visual inspection: sleepy scruffy bicolor cat, animal muzzle/nose/whiskers, exactly two front paws at the sill baseline, no clothes, torso, hindlegs, tail, window or background.

Full idle prompt:

Use case: illustration-story.
Asset type: original transparent animal companion sprite that lives inside a small window of an interactive manga library.
INPUT IMAGES: the two supplied images of the human Keeper are STYLE REFERENCES ONLY. Do not draw or edit the human. Match their sparse, loose, angular hand-sketched black ink, uneven scratchy contours, slightly scruffy feel, flat opaque white shapes, sparse short hatch marks and low-energy wry expression. This cat must look as though the same artist who drew that Keeper also drew it. Do not use polished anime rendering, dense screentone, glossy eyes or smooth vector linework.
SUBJECT: an original scruffy bicolor CAT named Pip. Clearly an animal cat: triangular feline ears, small cat nose, short animal muzzle, whiskers, sleepy half-lidded droopy almond eyes with tiny simple pupils, and a small wry mouth. Mostly white face, uneven black crown tuft, black ear tips, a few angular stray tufts at cheeks. Slightly skinny lanky scruffy features, not round plush/toy proportions or a generic big-eyed kitten. The cat has no clothing, accessories or human features.
POSE: Pip peeks through a window with ONLY his head and exactly TWO FRONT PAWS visible. The head tilts slightly to one side, resting low and sleepily over the paws. Both forepaws are planted across the same imaginary horizontal windowsill, relaxed with short rounded feline toes, three small toe lines per paw, absolutely no human fingers or hands. Paws are separate and readable. No torso, hindlegs, tail or fullbody; the window and sill will be supplied by the website and must not be drawn. Idle expression is mildly amused, tired but curious, matching the Keeper's slouchy mood.
COMPOSITION: square1:1 canvas. Head and two forepaws occupy about90% of the canvas. Both ear tips and all whiskers fully fit with a little transparent margin. Paws' lower edges sit on a consistent horizontal baseline at about92% of image height. Face centered over paws. No dramatic perspective, keep a simple front/very slight three-quarter close-up suitable at110px tall. Use bold simple black/white reads with only a few deliberate scratchy interior marks.
OUTPUT: actual TRANSPARENT PNG alpha cutout. Fully transparent outside cat head and two paws. Preserve opaque white within the cat. No background, floor, shadow, halo, gradient, fakecheckerboard, window, sill, text, watermark or UI. Strict neutral grayscale blackandwhite. Do not draw a person, humanoid body, clothes, shiny eyes, a spyglass, extra paws, extra limbs or a tail. One cat face with exactlytwo animal forepaws only.

## Active scout: pip-cat-search.png

- Source: /home/nikola/.codex/generated_images/01a153a4-9ac2-76e3-99a4-a5e4adad4d07/exec-e0ca9af6-5887-45b9-b9b4-e7456f5e254e.png
- Identity/composition reference: pip-cat-idle.png; additional style reference: public/character-sketch/idle/00.webp.
- Generation wall time: 41.593 seconds.
- Visual inspection: same cat identity/markings, slight outward head turn and attentive gaze, same square framing and two planted feline forepaws; no tools, human hands, clothes, body, or background.

Full active prompt:

Use case: identity-preserve.
Asset type: matching active-looking pose of the cat companion peeking through a website window, only head and exactlytwo front paws.
INPUT1 is the idle CAT identity/composition reference and edit target. Preserve this cat's exact bicolor markings, scruffy black forelock and triangular ears, mostlywhite face, small feline nose/muzzle/whiskers, rough angular line weight, sparse scratchy hatching, white shapes, and small wry personality. INPUT2 is the human KEEPER drawing as an additional STYLE REFERENCE ONLY: retain the same loose unpolished sketchiness, droopy understated eyes and simple ink language. Do not draw a human.
ONLY CHANGE: the cat perks up a little to scout outside while keeping both paws planted. Lift/rotate the head just slightly toward the viewer's right, make both ears a little more attentive, and raise the eyelids modestly so the tiny simple pupils look outward to the right. Keep the same understated sleepy-to-curious expression rather than huge wide glossy anime eyes. Face must remain recognizably the identical cat; no new smile or redesign. No accessories or objects: no spyglass, binoculars, clothing, hands or tool.
IMPORTANT ANCHORS: retain EXACTLYthe same two front paws in the same locations, sizes, toe anatomy and baseline as INPUT1; they should be unchanged and firmly resting on the imaginary sill at about92% image height. Never lift or add a paw. Head stays centered above them, occupying approximately the same canvas area, with a slight rightward attentive turn only. No animation bob, pose scaling or framing change. This is not a fullbody image. No torso, hindlegs or tail.
OUTPUT: same square1:1 canvas and framing as INPUT1, actual transparent PNG alpha cutout. Only cat head/ears/whiskers and exactlytwo animal forepaws visible; fully transparent elsewhere and opaque white inside the cat. No window, sill, ledge, background, ground, halo, shadow, gradient, fakecheckerboard, text, watermark or UI. Pure neutral blackandwhite, sparse irregular hand-inked sketch; avoid polished screentone, smooth vector contours or photorealism.

## Alpha and inspection boundary

Both outputs are 1254 × 1254 RGBA PNGs with alpha range 0–255. Transparency was checked directly from the image channels; no background-removal or other pixel manipulation was applied. Idle has 858,780 fully transparent pixels (54.61%); three corner samples have alpha 0 and one corner has alpha 1. Active has 893,823 fully transparent pixels (56.84%), with all four corner samples alpha 0. These are transparent cutouts, not images of a checkerboard. The integrating agent confirmed the idle style beside Keeper and its paws at the sill in the browser. Active-state integration remains a separate browser check.

These are two original AI-assisted raster poses, not a skeletal rig or frame-by-frame animation cycle. The application controls switching and supplies the window, its clipping mask, frame and sill. Previous humanoid/full-body artwork remains preserved as historical iterations.
