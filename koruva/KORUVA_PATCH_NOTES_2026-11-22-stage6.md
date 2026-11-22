# Koruva Minecraft 26.3 — Stage 6 Vanilla Block Interaction

Date: 2026-11-22
Base: Stage 5 Vanilla Edition

## Implemented

- Shared block placement/support/replaceability rules used by solo and authoritative Room server paths.
- Placement support checks for floor-, wall-, ceiling-, direction-attached, and selected plant/crop blocks.
- Vine placement chooses the support face from the ray-hit face.
- Door and bed pair placement/removal; companion cleanup after support loss; duplicate paired drops avoided.
- Door/bed placement checks replaceable cells, support floor, reach, and player overlap. Second-cell persistence failure rolls back the first edit.
- Neighbor state recomputation for stair inner/outer corners, pane/fence connections, and fence-gate wall attachment state.
- Immediate settling for sand, red sand, gravel, concrete powder, anvils, pointed dripstone, and dragon egg in the same vertical column.
- Main block loot rules for stone, ores, deepslate, glass/ice, leaves, gravel, clay, and glowstone, with tool tiers and supported Silk Touch/Fortune handling.
- Solo pickup and Room drop snapshots preserve item IDs and stack counts. Fixed join and dimension-change snapshots that previously omitted count and could restore a multi-item drop as a single item.
- Dimension-aware Room mining target lookup.
- README updated with implementation scope, test command, and limitations.

## Validation

- Run: `node --test test/*.test.mjs`
- Stage 6 coverage: `test/block-behavior-stage6.test.mjs`, `test/block-drop-sync-stage6.test.mjs`.
- Full Node test suite: **220 passed / 0 failed**.
- TypeScript parser: **65 files / 0 syntax diagnostics**.
- Vite production build and real-browser end-to-end checks were not run because the environment did not have the project dependency tree available. Do not treat parser/tests as proof of a complete runtime build.

## Known limitations

- Not every Java 26.3 block has a complete placement/support/drop rule; unspecified blocks use general fallback behavior.
- Fluid flow, fire spread, crop growth/random ticks, leaf decay, coral death, snow accumulation, piston movement, falling-block entities/damage, and full loot-table parity remain incomplete.
- Door/bed second-cell failure is rolled back, but two edits are not committed in a single database transaction.
