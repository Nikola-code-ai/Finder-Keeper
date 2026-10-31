# The herbarium shop, rendered in Blender

Everything the main room shows comes from one Blender 5.2 scene (`build_scene.py`), seen by one camera, so every render registers with every other:

- **Room layers** (`public/herbarium/room-back.webp`, `room-mid.webp`, `room-front.webp`): the back wall with its cases of green folios, the botanical print and the lamp; the desks, counter and window; the counter lip, desk face and plant in front. The page slides the back and front layers at different speeds for depth.
- **Drawer plates** (`drawer-RC.webp` + `.json` box): each of the six desk drawers rendered open, laid over the desk when its collection is pulled out.
- **The Keeper and the spider** (`keeper-<phase>.webp` atlases + `manifest.json`): a continuous-body Keeper (primitives fused with a voxel remesh, so the neck belongs to the body) on a real armature with IK hands and feet, head features bone-parented, and a 3D spider with an eight-legged gait. Phases: `greet` (he looks up from the register as you arrive), `idle`, `dispatch`, `web`, `walk`, `documents` (he leafs through a folio at the desk), `read` (a finger on the turning register page), `return`, `present`, `error`, `cancelled`, `web-return`, `web-settle`. Frames are transparent and cropped to one shared box, recorded in the manifest as fractions of the room frame, so the page places the canvas exactly over the room.
- **Landmarks** (`manifest.landmarks`): where the desks, counter, register, window, web and each drawer sit in the frame, so labels and controls are placed from the render rather than guessed.

The look is anime cel shading: Eevee with shader-to-RGB constant ramps (three tones per material) and Freestyle ink lines, in the herbarium palette (folio-cloth green, wood brown, sheet paper, one red reserved for "full text checked").

## Rebuild

```sh
blender -b --python art/herbarium/build_scene.py -- preview        # half-size composite, saves herbarium.blend
blender -b --python art/herbarium/build_scene.py -- room keeper    # layers, drawer plates, every character frame
python3 art/herbarium/pack.py                                      # WebP layers, alpha atlases, manifest
```

Existing frames in `frames/` are reused; delete them to re-render changed poses. `herbarium.blend` is saved with every phase keyed on the timeline (markers per phase) and is editable in Blender.
