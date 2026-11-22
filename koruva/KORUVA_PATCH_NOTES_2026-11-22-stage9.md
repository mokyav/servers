# Koruva Stage 9 — Rendering pipeline corrections (2026-11-22)

## Fixed

- Corrected chunk mesh coordinate space. Cube and model-backed geometry now stores vertices relative to the owning chunk, while the chunk mesh transform applies the world-space chunk offset exactly once. This prevents chunks away from the origin from being displaced by a second chunk offset.
- Split translucent blocks into a dedicated render layer instead of placing glass and ice into the opaque/cutout mesh.
- Added transparent blending with depth writes disabled for translucent geometry, while keeping opaque/cutout geometry on the normal depth-writing path.
- Classified legacy glass plus vanilla glass/ice/slime/honey fallback blocks as translucent.
- Set the renderer output to sRGB and marked chunk/drop atlases, item textures, generated player skins, name sprites, and mining-break overlays as sRGB so texture colors are decoded and displayed through the expected color pipeline.
- Made chunk triangle/mesh statistics refresh after mesh replacement and unload, without recounting the entire entry map for every individual chunk rebuild.

## Regression coverage

- Non-origin chunk coordinates are checked against chunk-local vertex bounds.
- Legacy and vanilla glass are checked for translucent render-layer routing.
- Existing tests cover chunk borders, shared-face culling, neighbour invalidation on unload, camera ray targeting, mesh-budget limits, and initial visible-ring readiness.


## Follow-up rendering corrections

- Model-backed blocks now count themselves as rendered only after at least one face has actually been emitted. If a model/state reference is missing or empty, the mesher falls back to the block's voxel shape instead of silently omitting the block.
- Unknown/corrupt block runtime IDs now use a visible stone placeholder rather than throwing during chunk mesh generation and potentially leaving the entire chunk unrendered.
- Chunk frustum bounds are computed from the actual generated vertices. This handles vanilla models that extend beyond a nominal full-cube box and avoids false frustum culling.
- Urgent remeshing is restricted to already-meshed chunks inside the visible ring. New or offscreen chunks no longer consume urgent budget ahead of visible near-to-far meshing.
- Fog end distance now extends beyond the edge of the generated chunk ring, so outer chunks are not fully blended into the sky before reaching the configured render distance.
- Added regression checks for unknown block IDs, model fallback behavior, computed frustum bounds, fog distance, and visible-only urgent remeshing.

## Validation status

- Changes are committed to `fix/koruva-camera-chunk-loading-2026-11-22` and included in PR #9.
- A previous Cloudflare Workers build check reported `failure`. Newer branch revisions have not yet produced a completed check result, so build status remains unverified.
- The Node test suite, TypeScript typecheck, Vite build, deployed Worker, and live browser/WebGL rendering have not been run from this environment.
- PR #9 remains open and unmerged; `main` has not been changed.
