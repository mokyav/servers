
# AI Coordination — Overworld worldgen v4 (2026-11-23)

## Scope
This change updates new Overworld chunk generation only. Worldgen v1-v3 remain available for existing saved worlds.

## v4 additions
- Connected spaghetti/noodle tunnels and larger cavern density fields.
- Local water/lava aquifer pockets.
- Cave-biome tags and decoration: lush caves, dripstone caves, deep dark and sulfur caves.
- Coal, iron, copper, gold, redstone, diamond, lapis and emerald distributions with deepslate variants.
- Tuff, granite, diorite and andesite geological patches.
- Ore origins are evaluated from neighbouring source chunks to avoid vein seams.

## Parallel-edit guidance
- Do not overwrite the v4 helpers in src/client/worldgen-core.js or the v4 cases in test/worldgen.test.mjs without coordinating.
- Keep WORLDGEN_VERSION, normalizeWorldgenVersion, worldgen-core.d.ts, worldgen.ts and saved-world version loading in sync.
- Koruva is 128 blocks high with sea level 22. Do not copy raw Minecraft 26.3 y-coordinates (-64..319) into the generator.
- Preserve deterministic seed calculations and neighbouring source-chunk padding for veins.
- The generator is adapted from 26.3 reference data; do not describe it as bit-for-bit vanilla generation.
