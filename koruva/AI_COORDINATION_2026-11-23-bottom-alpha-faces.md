# AI coordination — transparent bottom-face texture fix

Date: 2026-11-23
Project: Koruva / Minecraft Java 26.3
Base branch: `main`
Base commit: `800a2b0aa1dbb311a214d12e27efc65d21e60353`
Base package version: `1.5.0`

## Scope

The supplied `client(3).zip` is the official Minecraft Java 26.3 asset archive, not a Koruva source archive. Its block PNG alpha channels were inspected. Several textures used by model undersides (including cactus, cake, cauldron, flower pot, scaffolding, and bed parts) contain both fully transparent and fully opaque pixels.

The chunk shader already supports three policies: opaque (ignores source alpha), cutout (discards alpha below 0.5), and blended (preserves alpha). The defect was that model faces on otherwise-opaque blocks were sent to the opaque mesh, so their PNG alpha was ignored. The old grass-side exception did not cover other face-specific textures.

## Change made

- Added `shared/minecraft-block-alpha-test-textures.js`, a curated registry of binary-alpha 26.3 underside texture families.
- Updated `src/client/mesher.ts` to route individual model faces and fallback cube/subcell faces to the cutout mesh when their texture is in that registry and the block's normal render mode is opaque.
- Kept existing cutout blocks, translucent blocks, liquid blocks, grass-overlay ordering, UV calculation, face culling, and chunk material policy unchanged.
- Added a cactus underside regression test plus checks for cake/cauldron bottom texture registration in `test/client-rendering.test.ts`.

## Coordination guidance for parallel AI work

- The existing X/bottom visibility and `DoubleSide`/frustum fixes are already present on the base. Do not reapply or revert those changes.
- Do not simplify this to a block-wide `cutout` classification: only the affected face should be alpha-tested, otherwise opaque faces may acquire unnecessary discard behavior.
- Do not route all PNGs with any transparency to cutout. Semi-transparent glass/water-style assets must remain on their existing blended paths.
- If editing `src/client/mesher.ts`, preserve the per-face `usesBinaryAlphaTexture` decision in model, cube, and partial-shape branches.
- Please append follow-up findings here rather than replacing this note.

## Validation

Source-level regression coverage was added. A local project checkout, dependency install, full Node test suite, production build, and browser/WebGL visual run were not available in this editing session; those checks remain required before release.

## Versioning

The repository workflow increments the Koruva minor version on a source push to `main`. The automatic change for this fix completed from `1.5.0` to `1.6.0`. Other parallel AI commits had already advanced the project to `1.5.0` before this change. Do not manually bump the manifests as well, or the automatic workflow may increment twice.
