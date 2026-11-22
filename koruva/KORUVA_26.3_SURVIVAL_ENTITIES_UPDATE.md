# Koruva 26.3 — Survival / Entities update

This update references the supplied Minecraft Java 26.3 client data and the supplied Koruva source project. It is a partial gameplay expansion, not a claim of full vanilla parity.

## Implemented in this update

- World vertical range is now 128 blocks (`y=0..127` internally; editable placement is `1..127`). Chunk volume, mesh bounds, world validation, save normalization, worker edits and teleport checks use the shared height constant.
- Block targeting uses shape occupancy instead of selecting every solid block as a full cube. Ray sampling is 1/32 block; shape occupancy resolution is 4x4x4.
- Mining overlay uses the supplied 10 destroy-stage textures.
- Skeleton and stray attacks spawn physical arrows. The Durable Object simulates gravity, block impact, player and mob hits, dimension-scoped updates and persistence. The arrow trajectory compensates for gravity.
- Imports 1,234 crafting recipes and 479 processing recipes from the supplied 26.3 data. Crafting tag alternatives are expanded against the project's runtime item IDs. The multiplayer craft handler remains server-authoritative for recipe matching and item consumption.
- Adds processing recipe lookup, fuel duration lookup and deterministic furnace state stepping APIs.

## Automated checks

- `node --test test/*.test.mjs`: 192 passed, 0 failed.
- TypeScript syntax transpilation: 32 files, 0 syntax diagnostics.
- Full `tsc` typecheck / Vite production build: not run; dependencies `@cloudflare/workers-types` and `vite/client` were unavailable in this environment.

## Not completed

- Full NBT Jigsaw/template-pool placement of structures. Current generated structures remain simplified procedural structures.
- Unique non-simplified AI and authentic 3D models/animations for all 88 registered mob types. Physical arrow projectiles are currently implemented for skeleton and stray; arrow pickup, shield blocking and complete entity collision/loot behavior remain missing.
- Furnace/blast furnace/smoker/campfire/stonecutter/smithing-table station GUI, slot transfers, persistent per-block processing state and multiplayer synchronization. The 479 processing recipes and furnace transition API are present, but they are not yet connected to in-world stations.
- Full vanilla 3x3 crafting-table screen/station validation and all special recipe types such as trim recipes. Existing player crafting UI is based on 2x2 plus a recipe list.
- Exact Java collision and mining rules for every block state. Selection/collision still uses Koruva's approximate 4x4x4 shapes.

## Data counts

- Crafting recipes: 1,234 source-backed entries (runtime includes 1,247 after legacy/custom additions).
- Processing recipes: 479 (351 stonecutting, 73 smelting, 25 blasting, 9 smoking, 9 campfire cooking, 12 smithing transform).
- Registered mob type IDs: 88.
- Structure definitions and NBT templates are included in the project, but they are not all placed through the official Jigsaw algorithm.
