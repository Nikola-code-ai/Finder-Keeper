# Spider departure room edits

Generated with the built-in `image_gen` tool on 2026-10-19. Both source images were inspected before editing; both final images were visually inspected after editing and saved at 1536×1024.

These images remove the baked-in spider for the live web-search departure animation. Original input files remain unchanged. As these are generative edits, tiny incidental texture/detail differences may exist outside the removed spider; use a small clipped overlay around the spider position when pixel-exact scene stability is required.

## Illustrated

Input: `public/clerk-room/illustrated.png`

Output: `public/clerk-room/illustrated-web.png`

Generated source: `/home/nikola/.codex/generated_images/01a1568e-9440-76b2-aa63-d68121d12262/exec-2d4307c8-784f-4a4f-9ab1-e1acd8fbe441.png`

Prompt:

> Use case: precise-object-edit. Edit target is the supplied room image. Remove ONLY the tiny black spider centered at x91.8%, y29.3%, at the right arched window. Reconstruct the tiny area behind its body and legs to match the existing background. Keep its fine hanging thread and cobweb. Everything else must remain exactly identical: seated clerk, pose, chair, book, furniture, lighting, textures, grayscale style, perspective and framing. Preserve 1536x1024 dimensions. This is a precise removal edit for animation; do not redesign or change any other pixels.

## Pixel

Input: `public/clerk-room/pixel.png`

Output: `public/clerk-room/pixel-web.png`

Generated source: `/home/nikola/.codex/generated_images/01a1568e-9440-76b2-aa63-d68121d12262/exec-7ced9f03-4751-4eb3-9bc3-46d1b67bd24b.png`

Prompt:

> Use case: precise-object-edit. Edit target is the supplied room image. Remove ONLY the tiny black spider centered at x84.5%, y32.5%, on the right. Reconstruct the tiny area behind its body and legs to match the existing background. Keep its fine hanging thread and cobweb. Everything else must remain exactly identical: seated clerk, pose, chair, book, furniture, lighting, textures, grayscale style, perspective and framing. Preserve 1536x1024 dimensions. This is a precise removal edit for animation; do not redesign or change any other pixels.
