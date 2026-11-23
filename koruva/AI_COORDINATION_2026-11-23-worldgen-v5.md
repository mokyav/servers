# Koruva Overworld worldgen v5 — 2026-11-23

## Scope
- New Overworld worlds/chunks use generator v5.
- Saved worldgen versions 1, 2, 3, and 4 remain explicitly selectable and keep their existing generation algorithms.
- Worker room loading now normalizes the stored version instead of treating every non-current version as v1.

## v5 cave feature additions (Minecraft Java 26.3 reference data)
- Deterministic amethyst geodes with smooth-basalt, calcite, amethyst/budding-amethyst shells and correctly oriented amethyst clusters.
- Lush-cave floor/ceiling details: moss, moss carpet, rooted dirt, hanging roots, spore blossoms, cave vines (including berry state), and wet clay patches.
- Dripstone cave stalactite/stalagmite chains with base/middle/tip and vertical-direction block states.
- Deep-dark sculk floor patches, catalysts/sensors/shriekers, and face-attached sculk veins.
- Sulfur-cave sulfur floor deposits and supported upward/downward sulfur-spike chains.
- General cave glow lichen with face-specific north/east/south/west/up/down states.
- Existing aquifer fluids and ore-vein generation remain in the pipeline.

## Determinism and compatibility
- Feature origins are seeded independently of target chunk load order.
- Geodes are evaluated from neighbouring origin cells so their shells can cross chunk boundaries without seams.
- New decorations replace only supported cave-air or rock positions; water/lava and bedrock are preserved.
- Do not copy Java 26.3 raw Y coordinates into Koruva. Its world height and sea level are scaled independently.
- This implementation uses Java 26.3 biome/feature/block-state reference data but remains an adapted procedural generator, not bit-for-bit vanilla noise generation.
