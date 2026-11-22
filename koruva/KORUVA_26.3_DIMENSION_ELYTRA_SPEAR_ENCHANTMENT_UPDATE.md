# Koruva 26.3 — Dimension / Elytra / Spear / Enchantment Update

## Status

This package contains the implemented update and source data listed below. It is **not a full Minecraft Java 26.3 parity build** yet. The project can be tested from source, but the production build could not be verified in this environment because the installed dependencies are incomplete (`vite/client` type definitions are missing).

## Implemented

### Dimensions
- Runtime dimension IDs: Overworld, Nether, and End.
- Per-dimension chunk edits, mob/drop/projectile snapshots, and player dimension isolation remain connected to the room server.
- Nether portal route and Overworld/End portal route are wired to server-side contact validation.
- Overworld/Nether coordinate scaling is 8:1.
- Koruva runtime world height is 128 blocks (Y 0..127); dimension-type source metadata is retained separately.
- Bundled the four 26.3 dimension-type definitions: `overworld`, `overworld_caves`, `the_nether`, `the_end`.

**Limitations:** runtime exposes three dimensions only. `overworld_caves` is bundled as metadata and is not a fourth playable dimension. This is not vanilla's full negative-Y / 384-block world-height implementation. Portal frame validation, exact portal linking, End gateway behavior, Ender Dragon boss fight, and full vanilla structure integration are not complete.

### Elytra
- Elytra is accepted in the chest equipment slot.
- Space while falling starts gliding; glide movement is simulated on the client.
- Durability is tracked up to 432 points and persisted for room players and solo saves.
- Unbreaking reduces per-second Elytra wear chance.
- Firework rockets can boost while gliding; room mode validates that the player is gliding, checks a 500 ms use cooldown, consumes rockets in Survival, and applies the boost from the server.
- Remote players receive Elytra equipment state and render wing textures; glide state is synchronized for the wing pose.
- Removing/breaking the Elytra ends the glide on the next position update.

**Limitations:** glide physics are client-simulated and only bounded by server movement validation; the server does not independently reproduce the complete vanilla flight integrator. Firework flight duration/explosion variants and all Elytra collision edge cases are not modeled. Elytra repair via Mending is currently a simplified kill-XP repair path, not the full XP-orb distribution system.

### Spears
- Seven item variants and textures are present: wooden, stone, copper, iron, golden, diamond, and netherite.
- Spear attack reach is 4.5 blocks; each spear uses the weapon cooldown / charge system.
- Spear damage is included in server-validated melee combat.
- Lunge enchantment applies an impulse in room mode.

**Limitations:** this is the melee/thrust implementation. All vanilla 26.3 attack timing, charge-angle, riding, shield interaction, animation, knockback, and edge-case behaviors have not been independently verified against the full game.

### Enchantments
- Bundled all 43 Minecraft 26.3 enchantment JSON definitions.
- Added level caps, item compatibility checks, mutually exclusive enchantment checks, sanitization, and save/load support.
- Added an enchanting-table UI and server-side validation for table position/range, target item, lapis, and XP level.
- Implemented effects currently connected to gameplay:
  - Sharpness, Smite, Bane of Arthropods, Impaling, Density
  - Protection, Feather Falling, Fire Protection, Blast Protection, Projectile Protection
  - Efficiency, Fortune, Silk Touch, Aqua Affinity
  - Depth Strider, Soul Speed, Swift Sneak
  - Fire Aspect, Knockback, Looting, Lunge
  - Elytra Unbreaking and a simplified Elytra Mending repair path
- Explosion and ranged attacks now carry their own damage causes so Blast Protection and Projectile Protection can be applied separately.
- Fall damage uses enchantment-only protection from equipped armor (including Feather Falling) without incorrectly applying the normal armor points to fall damage.

**Important limitations:** enchantments are currently stored by *item type ID*, not by unique inventory stack. Two swords of the same material therefore share the same enchantments. The inventory model must be upgraded to per-stack NBT/data components before this can match vanilla. The other imported enchantment definitions are available as data/compatibility entries but do not all have their full gameplay effects yet. Examples still incomplete include Breach, Wind Burst, Thorns, Frost Walker, Respiration, Sweeping Edge, bow/crossbow enchantment effects, trident enchantment effects, and curse/anvil/grindstone behavior. The enchanting table also does not yet reproduce the full bookshelf-power and randomized-offer algorithm.

## Multiplayer / persistence
- Room server validates enchantment-table requests and deducts XP/lapis in Survival.
- Enchantment maps and Elytra wear are persisted per player CID.
- Elytra equipment/glide state is synchronized to other players in the same dimension.
- Rocket consumption/boost and spear attack validation execute through room-server messages.
- Existing dimension isolation for players, mobs, drops, projectiles, and block edits is retained.

## Verification
- `node --test test/*.test.mjs`: **201 tests passed, 0 failed**.
- TypeScript syntax transpilation: **0 syntax diagnostics** in `src/client/main.ts`, `src/client/remote.ts`, `src/worker/room.ts`, `shared/protocol.ts`, and `src/client/save.ts`.
- `npm run build`: **not completed**. Typecheck stopped with `TS2688: Cannot find type definition file for 'vite/client'`; this is an environment dependency issue, so a production bundle / complete typecheck has not been confirmed.

## Files of interest
- `shared/dimensions.js`
- `shared/enchantments.js`
- `shared/item-mechanics.js`
- `shared/protocol.ts`
- `src/worker/room.ts`
- `src/client/main.ts`
- `src/client/remote.ts`
- `src/client/public/assets/minecraft/textures/entity/equipment/wings/elytra.png`
- `src/client/public/assets/minecraft/textures/item/*_spear*.png`
- `data/minecraft/dimension_type/*.json`
- `data/minecraft/enchantment/*.json`
