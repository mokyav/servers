# Koruva Overworld worldgen v6 — 2026-11-24

## Scope
- New Overworld worlds/chunks use generator v6.
- Saved worldgen versions 1–5 remain explicitly selectable and keep their existing algorithms.
  Verified byte-for-byte: v1/v2/v3/v4/v5 chunk hashes are unchanged from the previous release
  (pinned in `test/worldgen.test.mjs`).

## v6 cave terrain
- The v4/v5 carve test only required 4 blocks between a cave cell and the column surface, which
  produced paper-thin ceilings and let caves read as sponges right under the grass line.
- v6 enforces a **minimum 6-block rock roof** per column (`surfaceY - y < 6` is never carved) and
  tightens the chamber thresholds slightly, so carved volume drops to a believable share of rock
  (8.5% → 5.5% of the underground in the measured area).
- Tunnel/chamber noise fields stay the same family as v4, so caves remain connected networks
  (adjacency ratio still > 0.45 of cave air) instead of isolated pockets.
- Roof guarantee is measured per column: measured minimum roof = 6, zero surface breaches.
- Determinism unchanged: carve decisions depend only on world position and column height, never on
  chunk load order.

## v6 ore generation
- v4/v5 ore was overwhelming: **20.4% of all underground solids** were ore (vanilla is ~1–2%).
- v6 uses a separate `ORE_PROFILES_V6` table instead of the v4 one. Vanilla Java ore placements
  live in a 384-block world (-64..319, sea level 63); Koruva is 128 blocks with sea level 22, so
  vanilla Y maps to `yKoruva = (yVanilla + 64) / 3` and every band is additionally clamped below
  the local surface.
- Result: ore is now **4.3–4.9% of solids**, still with vanilla rarity order
  (coal > iron > copper > redstone > lapis > gold > diamond > emerald).
- Diamond/redstone/lapis/gold veins are small (1–2 tries) and diamond is additionally
  exposure-discarded so it is not stapled to every cave wall.
- Ore origins are still evaluated from the 3×3 neighbouring source chunks, so vein seams do not
  appear at chunk borders and generation order cannot change the result.

## v6 deepslate boundary
- v4/v5 used one flat `deepLevel = H * 0.17`. Because Koruva's land averages y≈23 in a 128-block
  world, that put deepslate immediately under the topsoil and made deepslate ores the only ores.
- v6 uses a low, noisy per-column boundary (`deepslateLevelAt`, roughly y=5..15, clamped below the
  surface), so **stone is the normal underground rock** and deepslate appears only in the deep
  dark. Measured: no deepslate above `H * 0.115`.
- The ore generator's deep/normal variant choice uses the same per-column boundary
  (`options.deepLevelAt`), so a deepslate ore can never appear inside stone.

## Compatibility notes
- `generateOreVeinsV4` gained an options object (`profiles`, `badlandsBonus`, `deepLevel`,
  `deepLevelAt`). With no options it behaves exactly as before, which is what v4/v5 rooms use.
- `WORLDGEN_VERSION` is 6; `normalizeWorldgenVersion` maps 1–6 and falls back to 6.
- Update `WORLDGEN_VERSION`, `normalizeWorldgenVersion`, `worldgen-core.d.ts`, `worldgen.ts` and
  saved-world version loading together if this changes again.
- Koruva is 128 blocks high with sea level 22. Do not copy raw Minecraft 26.3 y-coordinates.
- This remains an adapted procedural generator built from 26.3 reference data; it is not
  bit-for-bit vanilla noise generation.
