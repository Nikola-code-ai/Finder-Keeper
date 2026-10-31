# Pip window portraits: prompts and provenance

Generated 2026-10-19 using the built-in imagegen tool. The user requested that Pip look through the window with only his face and arms visible. Both runtime files are 1254 × 1254 RGBA PNGs with actual alpha transparency. Existing full-body assets remain unchanged. No Python or other manual pixel editing, cropping, compositing, or alpha extraction was used; generated outputs were copied into this directory.

These are original AI-assisted raster pose illustrations, not a skeletal rig. The window frame, sill, clipping, and request-state behavior are supplied by the application.

## Idle: pip-window-idle.png

- Source: /home/nikola/.codex/generated_images/01a153a4-9ac2-76e3-99a4-a5e4adad4d07/exec-520ecc10-35a5-4c32-a750-140ab347d73b.png
- Identity reference: pip-manga-idle.png, inspected before editing.
- Generation wall time: 39.757 seconds.
- Visual inspection: head, ears, hair, two resting forearms and hands only; no torso, legs, satchel, or drawn window/sill. The integrating agent confirmed idle framing and sill contact in the browser.
- Alpha inspection: RGBA, range 0–255, all four corners fully transparent, 39.07% fully transparent pixels.

Full prompt:

Use case: identity-preserve.
Asset type: transparent close-up character overlay for an actual website window. The real window frame and sill are supplied separately in HTML; do not draw them.
Reference: preserve the supplied original Pip character's exact face identity, pointed ears, spiky black hair, large expressive eyes, impish small fang grin, black-and-white ink manga rendering, contour weight and subtle hatching. This is the same character, changing his composition and pose.
Requested change: Pip is PEEKING THROUGH A WINDOW into the room, with ONLY his large head/face and BOTH FOREARMS/HANDS visible. Close-up, not full body. His two forearms lie horizontally across an imaginary windowsill directly beneath his chin; relaxed hands overlap or gently clasp at the center, with fingers hanging just slightly over the imaginary sill's edge. His face looks curiously toward the viewer with a friendly mischievous smile. Hair and ears are fully visible. Shoulders, chest, vest, satchel, waist and legs are completely concealed and MUST NOT be visible. A tiny neck and sleeve cuffs are acceptable, but no visible torso. The head and resting arms form one compact peeking silhouette.
Composition: SQUARE 1:1 canvas, 1024 by 1024. Head plus arms fills approximately 85–90% of canvas. Centered face and balanced arms. Top hair margin about5%, forearms aligned horizontally around y=85–88% of the canvas; lowest fingertips around y=92%, leaving transparent bottom margin. Avoid excessive blank space. The face is much larger relative to canvas than in the reference so its expression is legible at110px displayed height.
Style: crisp hand-drawn monochrome manga ink, white skin highlights, black hair, sparse hatching. Strict neutral grayscale. Preserve opaque white inside face and arms; clean silhouette.
Output requirements: ACTUAL TRANSPARENT PNG alpha cutout, fully transparent outside head and arms. No window, no windowsill, no ledge, no furniture, no wall, no scenery, no background, no gradient, no glow, no shadow, no checkerboard, no text, no watermark. Do not include a standing body, torso, chest, satchel, hips, legs or boots. This must look like a charming face and arms leaning into a window, not a full-body figure with feet.

## Active search: pip-window-search.png

- Final source: /home/nikola/.codex/generated_images/01a153a4-9ac2-76e3-99a4-a5e4adad4d07/exec-d0ef8a28-0bbf-45e9-ae94-a47e226b4bff.png
- Identity and framing reference: pip-window-idle.png.
- First active draft: /home/nikola/.codex/generated_images/01a153a4-9ac2-76e3-99a4-a5e4adad4d07/exec-2c9611b2-c171-4387-b841-53da1eeb9347.png; rejected during visual inspection because it retained an extra dangling hand.
- Initial active generation wall time: 43.550 seconds.
- Targeted correction generation wall time: 41.265 seconds.
- Final visual inspection: same face/hair/ears and close-up framing, exactly two hands; one arm rests at the sill baseline, the other holds a spyglass to an eye. No torso, legs, satchel, or drawn window/sill.
- Alpha inspection: RGBA, range 0–255, all four corners fully transparent, 638,708 fully transparent pixels (40.62%).

Initial active prompt:

Use case: identity-preserve.
Asset type: second transparent CLOSE-UP peeking-through-window pose paired with the supplied idle sprite. The website supplies the real window frame and sill separately.
Reference invariants: preserve the supplied close-up Pip's exact head scale, face identity, pointed ears, spiky black hair silhouette, eye style, fang grin, white skin, ink contours and subtle manga hatching. Keep the same square canvas framing and approximately the same head placement. Keep the character equally large in frame. This must remain only a FACE + ARMS window-peeking portrait, not a standing figure.
Change ONLY the action: Pip looks eagerly through a short simple monochrome spyglass held up to his right-side eye (viewer-right). The uncovered eye and mischievous smile remain visible. One forearm still rests horizontally on the same imaginary windowsill at the exact same height as the reference, lower forearm edge around90–92% of canvas height, with relaxed fingers draping over the edge. The other arm bends up from the sill and its hand visibly grips the small spyglass at eye level. Angle the short spyglass slightly toward the upper right, compact enough to fit entirely within the square. He is scouting from inside the same window, not floating. No need for a large body lean or head displacement.
Visible anatomy: only head, ears, hair, forearms and hands, with minimal sleeve cuffs if needed. Shoulders and entire chest/torso remain concealed behind the imaginary sill. No vest, satchel, waist, legs, boots or full body. His resting forearm establishes the bottom baseline.
Output: matching SQUARE 1:1 transparent PNG, same canvas dimensions as supplied reference. Clean ACTUAL alpha transparency everywhere outside character and spyglass, preserve opaque white face and arms. Do not draw the window, window frame, sill, ledge, wall, background, gradient, halo, shadow, checkerboard, lettering, watermark or UI. Strict neutral grayscale black-and-white manga ink. Full face/hair/ears/spyglass visible with compact margins. Do not zoom out compared with reference.

Targeted correction prompt (input was the rejected active draft):

Use case: precise-object-edit.
Edit the supplied close-up Pip searching sprite to fix ONE anatomy mistake while preserving everything else exactly: it currently has THREE hands. There is a spyglass-gripping hand at upper right, a relaxed resting hand near the center above the forearms, AND an extra dangling hand at bottom center. REMOVE the EXTRA DANGLING HAND at bottom center, including all of its downward fingers, and remove any leftover forearm that belongs to that extra hand. Replace removed areas with actual transparent alpha, not white paint.
Final anatomy must be exactly TWO arms and TWO hands: (1) the viewer-left arm stretches horizontally along the imaginary sill and ends in the ONE relaxed resting hand near the lower center, with its natural short fingers. (2) the viewer-right arm bends naturally at the lower-right elbow and its forearm rises to the ONE hand holding the spyglass at eye level. Do not add a third arm, hand or sleeve. There must be NO separate dangling hand underneath the resting hand. Maintain a believable bent right elbow joining the raised forearm naturally to the shoulder without an extra horizontal forearm.
Preserve the exact same large face, head placement, expression, spiky hair, pointed ears, eye/spyglass alignment, spyglass size, clothing cuffs, black-and-white manga ink style, overall square dimensions, body-free composition, and resting arm baseline at90–92% canvas height. No torso, chest, legs or satchel. Do not move, scale or redesign the head.
Output a clean ACTUAL transparent PNG with no background, no window/sill/ledge, no glow, no halo, no checkerboard, no lettering, no border. Preserve opaque white inside face/arms and fully transparent surrounding space. The result is still only Pip's face and TWO arms peeking into a window.

## Earlier identity provenance

The original humanoid Pip design, inspiration-reference links, and full-body prompts are preserved in pip-manga-PROMPTS.md. These close-up revisions preserve that original generated identity while changing the pose and composition requested by the user. Browser integration acceptance for the active pose is separate from the asset inspection above.
