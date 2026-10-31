# Front-facing illustrated keeper

The room, head, and torso are new image-generation assets, saved as sibling assets to preserve the earlier overhead version. Generated with the built-in image tool; the identity reference was `public/characters/ui-studies/bookseller-idle.webp`.

The room is a first-person, eye-level pencil-and-ink bookshop with an empty central chair, a visitor counter, document desks at the left, and a webbed arched window at the right. All artwork is shown in neutral grayscale.

The head prompt preserved the original elderly bookseller's bald crown, fluffy white hair, round spectacles, beard, kind eyes, and closed smile, front-facing, isolated with transparent alpha. The torso prompt preserved the white shirt, dark waistcoat, watch chain, and apron as a separate transparent puppet part.

`components/clerk-illustrated-scene.tsx` articulates the puppet deterministically from phase time: shoulder/elbow/wrist chains, separate trouser legs and shoes, head tilt and tracking, a genuinely folding page, lifted and checked document sheets, a spider with eight independent leg strokes, and an answer offered forward over the counter. The generated room is reused as a foreground occlusion layer so the character stands behind actual desks. This is a live layered 2D rig, not a prerecorded video or a set of still-image phase swaps.

Animation phases consume the request lifecycle supplied by the parent. Motion time freezes as a unit when paused; reduced motion displays a stable phase pose. No backend status or API request is owned here.
