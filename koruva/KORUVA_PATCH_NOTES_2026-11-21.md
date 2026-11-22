# Koruva patch notes — 2026-11-21

## Changes integrated from `koruva-skin-fix.zip`
- Cherry-picked the useful crouch, edge-clamp, and player-model improvements without replacing the newer dimension-aware game, save, redstone, mob/XP, or room-server implementation.
- Added optional `sneak` state to multiplayer position/player synchronization so older clients that omit the field remain compatible.
- Added C-key crouching, slower movement while crouched, interpolated eye height, lowered first-person targeting, and remote-player crouch animation.
- Updated the player model proportions and upper-body pivot/lean presentation.
- Fixed HUD health/effect rendering in the current UI.
- Fixed grounded-state handling when vertical movement is zero, and retained support probing so edge-clamp/sneak movement behaves reliably.

## Bugs fixed
- Moved `normalizeInventory` out of an accidental block comment. The old placement meant the online room path could call an undefined function while normalizing a joining player's inventory.
- Extended inventory normalization and persistence to the expanded item runtime-ID range.
- Fixed `/give` so catalogued non-block items (for example, diamond sword) can be granted and synchronized without being treated as placeable world blocks.
- Prevented item-only IDs from being placed into world block storage; item-only entries remain inventory items.
- Fixed the same-game-mode command path so requesting the current mode does not unnecessarily rebroadcast and persist a redundant mode change.
- Removed duplicate/unreachable code found during the room edit-path review.

## Minecraft Java 26.3 client data integrated
Data was cross-checked against the supplied `client.zip` (Java Edition 26.3 resource/data set).
- 1,288 registered block identifiers and block texture mappings.
- 1,658 item definition identifiers; `air` is excluded from usable inventory, leaving 1,657 inventory item identifiers.
- Added the missing client resource assets identified during comparison and included `koruva-resource-manifest.json` with catalog and supported-feature counts.
- Creative inventory can enumerate the registered item catalog. Survival inventory, server normalization, saving, and `/give` support the expanded item ID range.
- Block items share their block runtime IDs. Items without a corresponding placeable block receive separate item-only runtime IDs.

## Crafting recipes
- Imported 733 shaped and 230 shapeless recipes (963 total) that can be represented by the current exact-identifier 3×3 crafting grid.
- Preserved the existing legacy recipes for compatibility.
- The client data contains 2,042 recipe JSON files overall. The current crafting engine does not yet implement every recipe family or every tag/alternative ingredient representation. Smelting, stonecutting, smithing, brewing, and other unsupported recipe types are not claimed as implemented by this patch.

## Blocks, collision, and dimensions
- Stair and slab rendering/collision use the same 2×2×2 sub-cell occupancy checks to reduce disagreement between visible geometry and player collision.
- Straight bottom stairs support the four horizontal facings. Slab and directional stair regression tests were added.
- All 1,288 block identifiers are registered, but this does not mean every vanilla block has fully reproduced behavior or collision. Complex multi-part/state-dependent shapes (such as fences, walls, panes, doors, connected shapes, upside-down stairs, and stair corners) can still use simplified geometry where no explicit shape implementation exists.
- Preserved the three existing Minecraft dimensions: Overworld, Nether, and End, including dimension-specific world data and travel. This patch does not add additional custom dimensions.

## Validation performed
- Node test suite: 169 tests passed.
- TypeScript-oriented test scripts: 6 test files passed in the transpiled test harness.
- TypeScript transpilation check: 73 source files, zero transpilation diagnostics.
- Room/server tests exercised online joining, non-block `/give`, sneak-state relay, persistence, drops, kick/BAN, and related room flows using a test stub.
- A full package-manager install, production build, real browser playtest, and live Cloudflare deployment were not completed in this environment. The transpile/test results therefore should not be read as a successful production build or full vanilla-parity certification.
