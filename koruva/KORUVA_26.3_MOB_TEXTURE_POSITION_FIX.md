# Koruva 26.3 — Mob texture and model-position fix

## What changed

- Rebuilt the core pig, cow, adult chicken, creeper, zombie and skeleton cuboids from the supplied 26.3 client model definitions.
- Corrected cuboid dimensions, UV offsets, world-space centres, body rotations and left/right mirrored UVs. Texture UVs are now mapped per cube face instead of assigning the same four corners to every face.
- Removed the old edge-clamping behavior from the atlas mapping path. Out-of-range atlas rectangles now fail the asset tests instead of silently sampling an unrelated strip of the texture.
- Added a dedicated folded-arm VillagerModel rig from the 26.3 client definition, including independent hat/robe geometry inflation and the correct 64×64 UV atlas.
- Composited the vanilla villager and zombie-villager biome, profession and profession-level layers. The renderer currently uses plains/nitwit/stone defaults because the network MobInfo does not yet carry the villager's actual biome/profession/level.
- Routed wandering traders through the villager-style model rather than the generic zombie humanoid rig.
- Added a dedicated PiglinModel-compatible rig for piglin, piglin brute and zombified piglin, using the 26.3 humanoid atlas offsets plus the wider head, snout and mirrored ears. These types no longer sample their textures through the generic zombie head UVs.
- Fixed an Ender Dragon hierarchy bug: both wings were being detached from their torso pivot and re-added to the root. They now remain children of the torso, so the wing hinge and flap animation stay aligned.
- Kept the dragon's 256x256 body/eyes atlases, the Wither's three-head 64x64 atlas rig, and the Warden's 128x128 body/glow atlases. The UV tests now check all statically declared dragon cuboids and the key Wither/Warden cuboids, plus all cuboids in the lightweight core rigs.
- Overlay layers copy the base mesh rotation and scale so overlay geometry does not drift away from the underlying body part.

## Checks

- `node --test test/*.test.mjs`: **220 passed, 0 failed**.
- TypeScript syntax transpilation: **23 files, 0 syntax diagnostics**.
- PNG resource and atlas-size checks: passed for every texture currently referenced by the renderer manifest, including dragon, dragon eyes, Wither, Warden, villager and wandering trader.

## Known limitations

- The project still uses shared lightweight base rigs for many less-common entities. Their individual textures/atlases, model geometry, accessories and animation are not all exact Java 26.3 reproductions yet. This update specifically corrects the core rigs and the dedicated Ender Dragon, Wither and Warden rigs; it does not claim that every one of the 80+ entity types now has a unique vanilla-accurate model.
- The TypeScript syntax pass is not a full type check. `tsc -p src/client` could not start because the local install lacks `vite/client` type definitions. The `npm test` script also cannot run its later TypeScript test stages because the local `tsx` executable is missing. The complete `.mjs` test suite did run successfully.
- A browser-rendered visual comparison was not available in this environment. The UV dimensions, source model references, geometry hierarchy and syntax were checked programmatically, but final in-game appearance should still be visually checked in the client.
