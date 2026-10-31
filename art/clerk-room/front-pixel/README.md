# Visitor-view pixel room

The renderer in `components/clerk-pixel-scene.tsx` draws original native pixel art at 768 × 512 pixels. It has no generated scene images, static pose swaps, motion video, or downloaded dependencies. Polygon contours, lines and ellipses are explicitly rasterized onto a two-pixel grid. The environment is cached once; the keeper and his work props are then drawn at twelve animation poses per second from the shared phase clock.

The face follows the existing elderly bookseller reference: bald crown, white side hair and beard, round spectacles, rolled shirt sleeves, dark vest and apron. The visitor sees his face from across the desk. The left document desk and right window stay in place.

The articulated body uses shoulders, elbows, wrists, hips, knees, ankles and independent hands. Walking phases move the keeper between desks with alternating steps and arm swings. Documents are physically lifted from a stack toward his face. Reading uses a hinged page, and the right hand follows the page as it turns. Dispatch extends his arm before the spider takes a thread toward the window. The spider has eight independently stepping legs. The presentation phase extends both hands and offers a page across the desk.

Phase progress comes only from the parent request lifecycle. Pausing freezes the supplied clock; reduced motion draws a single stable pose. Visual actions do not claim backend substeps or delay actual results.
