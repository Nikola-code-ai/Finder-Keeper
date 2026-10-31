# Visitor-view Blender shopkeeper

This folder contains the editable native Blender source for the 3D room in Finder & Keeper. The camera faces the elderly shopkeeper across his counter, with two physical document desks to the visitor's left and a spider and window to the right. The modeled face has balding white hair, a white beard, round spectacles, and a smile, based on the existing bookseller character reference.

`shopkeeper.blend` contains actual articulated geometry and keyed object transforms. It is not a set of generated images or pose crossfades. Phase markers on its timeline identify:

- `idle`: breathing, gaze movement, and a blink.
- `dispatch`: the keeper reaches out as the eight-legged spider leaves along its silk bridge.
- `web`: the spider crawls while the keeper waits and watches.
- `web-return`: the spider physically crawls back from the window as the keeper offers the result sheet.
- `web-settle`: the spider returns after an empty, failed, or cancelled search while the keeper lowers his hand; no success sheet is presented.
- `walk`: the keeper steps from the chair to the left document desk, with alternating leg and arm motion.
- `documents`: the keeper lifts and examines a physical sheet above the document stack.
- `read`: a hinged modeled page turns as the keeper's hand follows and his head tracks across the book.
- `return`: the keeper walks back to his chair.
- `present`: the keeper offers a sheet toward the visitor.
- `error`: an open-handed, gentle shrug.
- `cancelled`: the keeper lowers his hand and settles.

These are request-driven illustration sequences. They convey the requested operation, not internal tool-by-tool backend telemetry. The application decides when to start and stop them from the actual request lifecycle.

## Rebuild

Use Blender 4.5 LTS (the original build used the portable official 4.5.2 release):

```sh
blender -b --python art/clerk-room/front-blender/build_room.py -- preview
blender -b --python art/clerk-room/front-blender/build_room.py -- render
blender -b --python art/clerk-room/front-blender/add_web_return.py
python3 art/clerk-room/front-blender/pack_atlases.py
blender -b art/clerk-room/front-blender/shopkeeper.blend --python art/clerk-room/front-blender/inspect_animation.py
python3 art/clerk-room/front-blender/verify_assets.py
```

The deterministic scene builder reuses primitive geometry helpers from `../blender/build_room.py`; it does not execute or change the old overhead scene. Cycles uses OptiX when available, with a CPU fallback. Rendering uses 16 samples with denoising at 768 × 512 pixels and 12 frames per second. Existing PNG frames are reused; remove only this folder's `frames/` contents before rebuilding changed poses.

`public/clerk-room/front-blender/manifest.json` describes full-frame WebP sprite atlases (6 columns). The player crops one frame per animation tick, which preserves natural occlusion behind the desk. The manifest's `startFrame` identifies the corresponding source timeline range. `preview.png` is a convenient static preview; `poster.webp` is the delivery poster.

The individually modeled gray materials, shelves, bound books, counter, chair, archive desks, physical page, held paper, lights, camera, and articulated keeper/spider are editable in the source. No external textures or purchased model assets are used. Render caches and logs stay local.

Validation writes `native-animation-audit.json` (physical transform movement in the editable source) and `asset-audit.json` (all delivered paths, atlas dimensions, frame counts, and distinct frames).
