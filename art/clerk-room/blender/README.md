# Clerk room: native Blender study

This monochrome room is modelled with editable Blender geometry, materials, an
orthographic camera, and area lights. The render is a 3D miniature: floorboards,
two document desks on the left, the central reading desk and chair, shelves,
paper stacks, books, the clerk, and Pip's web station all have native geometry.

## Rebuild

Use Blender 4.5.2 LTS or a compatible Blender 4.5 release from the repository
root:

```sh
blender -b --python art/clerk-room/blender/build_room.py
blender -b art/clerk-room/blender/clerk-room.blend --python art/clerk-room/blender/inspect_scene.py
```

The build uses a fixed random seed, neutral grayscale materials, Cycles with 80
samples and denoising, and a 1536 × 1024 output. It uses an available OptiX device
and otherwise renders on the CPU. No texture downloads or external models are
required. Add `-- preview` to the first command for 900 × 600 previews.

## Deliverables

- `clerk-room.blend`: editable native scene; the timeline retains all three poses.
- `build_room.py`: the reproducible procedural scene and render instructions.
- `inspect_scene.py`: checks visible characters in each pose and projects room
  locations into image coordinates.
- `scene-manifest.json`: exported visibility checks and exact camera-projected
  hotspot positions, measured from the upper-left corner of the image.
- `../../../public/clerk-room/blender.png`: seated clerk reading at the main desk.
- `../../../public/clerk-room/blender-documents.png`: clerk standing at the upper
  left document desk; the central chair is empty.
- `../../../public/clerk-room/blender-web.png`: seated clerk with Pip absent from
  the round table, for an animated spider overlay during web search.

The three image plates correspond to timeline frames 1, 2, and 3. They are still
renders of real 3D geometry. The website handles interaction and spider travel;
the browser does not run a Blender renderer.

## Verified hotspots

Coordinates are percentages of the uncropped image, measured from its top-left
corner using the saved camera. Keep the full 3:2 frame when positioning the UI.

| Target | X | Y |
| --- | ---: | ---: |
| Open reading book | 53.95% | 44.63% |
| Seated clerk | 54.28% | 53.74% |
| Upper document desk | 21.38% | 33.58% |
| Lower document desk | 22.37% | 57.94% |
| Pip on the round table | 80.46% | 43.37% |
| Web gate | 81.58% | 21.65% |

All three final images were visually inspected at full resolution. Inspection
of the saved native scene confirms the intended clerk/spider visibility on each
frame and 1,220 editable objects. The grayscale material palette is rendered
through Blender's AgX display transform.
