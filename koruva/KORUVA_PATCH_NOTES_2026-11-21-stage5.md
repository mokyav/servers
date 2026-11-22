# Koruva Stage 5 – Vanilla model & GUI pass

## Implemented

- Parsed Java 26.3 blockstate `variants` and `multipart` definitions into append-only runtime state IDs, while reserving existing inventory-only item IDs.
- Generated a resolved block model registry with parent-model inheritance, texture-variable resolution, multi-element geometry, per-face UV rectangles and quarter-turn UV rotations, element rotation/rescale metadata, blockstate X/Y/Z rotations, and cullface metadata.
- Switched model-backed Minecraft blocks in the chunk mesher from the simplified cube/voxel fallback to generated model geometry.
- Added blockstate UV locking based on transformed face/tangent axes; arbitrary non-axis-aligned cases remain best-effort.
- Generated 4x4x4 collision masks from model elements, including inverse element/blockstate transforms and element rescale compensation.
- Applied Overworld biome-tinted grass/foliage colors using representative coordinates from vanilla grass and foliage colormaps for the five current Koruva biome labels.
- Added static multi-part custom models and 16x16 texture crops for normal/trapped/ender/copper chests; added 16 dye-tinted banner cloth textures derived from the official entity banner base UV. Model support for beds, banners, shulkers, decorated pots, conduit, and copper golem statues is also included.
- Updated title/pause/admin/loading backgrounds and buttons to use official menu, in-world menu, button, and text-field sprites. Inventory, crafting-table, hotbar, crosshair, and XP resources from Stage 4 remain in use.
- Kept official `.mcmeta` frame-order, per-frame duration, and interpolation support for animated texture sheets.
- Added `test/minecraft-vanilla-stage5.test.mjs` covering ID-space safety, representative model/state resolution, special model presence, all model texture paths, 4x4 collision masks, and GUI sprite references.

## Generated registry summary

- 2,580 resolved models
- 11,963 model-backed block states
- 1,354 referenced texture resources
- 423 generic blockstate catalogs / 4,552 generic state combinations
- 70 generated 16x16 chest face texture crops

## Validation performed

- Node test suite: 202 tests passed.
- `tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --strict --skipLibCheck src/client/mesher.ts`: passed.
- TypeScript syntax transpilation: 31 `.ts` source files, 0 diagnostics.
- All 1,354 model registry texture references point to packaged PNG assets.
- Full Vite build and browser screenshot / gameplay verification were not run because local project dependencies (`vite/client`, Vite and Three.js packages) are not installed in this workspace.

## Known limitations

- This is a vanilla-inspired renderer, not the Java game's complete rendering engine. Lighting propagation, exact ambient occlusion, transparency sorting, fluids, and all shader effects are not identical.
- `uvlock` is handled with an orthogonal-axis basis transform and is best-effort for unusual compound rotations.
- Collision uses 4x4x4 sampled occupancy, so sub-pixel/diagonal boundaries are quantized.
- Biome tint uses five current Koruva biome labels and their representative climate coordinates. It does not recreate Java's full biome climate fields/noise; water uses the default water tint rather than each biome's `water_color`.
- Chest models are static; lid animation, double chests, lock/loot state, and block-entity inventory are not implemented.
- Banner models include cloth and pole geometry but do not composite banner patterns or dye layers.
- Beds have head/foot states and paired local placement/breaking; online two-block placement is not one atomic server transaction.
- Inventory/crafting/HUD and main menu surfaces use vanilla resources, but specialized containers (anvil, smithing, cartography, trading, etc.) and every UI animation are not completely reproduced.
