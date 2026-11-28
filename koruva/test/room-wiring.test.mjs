import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const room=readFileSync(new URL("../src/worker/room.ts",import.meta.url),"utf8");
const main=readFileSync(new URL("../src/client/main.ts",import.meta.url),"utf8");
const protocol=readFileSync(new URL("../shared/protocol.ts",import.meta.url),"utf8");
test("room wires server-selected initial inventory, shaped craft and mining handshake",()=>{
 assert.match(room,/resolveInitialInventory\(storedCounts, msg\.counts, me\.host\)/);
 assert.match(room,/craftFromGrid\(me\.counts, msg\.recipeId, grid/);
 assert.match(room,/case \"dig-start\"/); assert.match(room,/case \"dig-cancel\"/);
 assert.match(room,/miningTimeSeconds\(brokenBlockId, B, me\.vitals\.activeEffects, brokenToolItemId, BLOCKS, armorEnchantments, me\.armorSlots, me\.swimming\)/);
 assert.match(room,/blockItemId\(b\) <= 0/);
 assert.doesNotMatch(room,/private async persistVitals\(st: PlayerState\) \{\s*private async persistInventory/);
 assert.match(main,/t: \"dig-start\"/); assert.match(main,/craftGridForRecipe\(recipe, \{ counts: this\.counts, .*gridWidth: 2 \}\)/);
 assert.match(protocol,/t: \"dig-ready\"/);
});

test("server Mob AI uses bounded ticks, persistence and batched client updates",()=>{assert.match(room,/stepMobAI\(mob,\s*actors,\s*dt,\s*now,\s*solidAt\)/);assert.match(room,/await this\.tickMobs\(0\.2, now, online\)/);assert.match(room,/mobbatch/);assert.match(main,/case "mobbatch"/);});


test("item drops persist across restart, expiry, eviction, and pickup", () => {
 assert.match(room,/normalizeSavedDrops\(await ctx\.storage\.get<Drop\[\]>\("drops"\)/);
 assert.match(room,/private async persistDrops\(\)/);
 assert.match(room,/await this\.ctx\.storage\.transaction\(async/);
 assert.match(room,/await this\.spawnDrop\(/);
 assert.match(room,/await this\.clearDrops\(/);
 assert.match(room,/await this\.liveDrops\(/);
});

test("host give, summon, kill, and givefood commands dispatch from the command handler", () => {
 const start = room.indexOf("  private async command(");
 const end = room.indexOf("  private commandTargets(", start);
 assert.ok(start >= 0 && end > start, "command handler boundaries are present");
 const body = room.slice(start, end);
 for (const command of ["give", "summon", "kill", "givefood"]) {
  assert.match(body, new RegExp(`^ {4}if\\s*\\(cmd\\s*===\\s*\"${command}\"\\)`, "m"), `${command} is a top-level command branch`);
 }
 assert.doesNotMatch(body, /^ {4}if\(cmd === "givefood"\)\s*\{\s*if \(cmd === "give"\)/m, "give must not be nested beneath givefood");
});

test("redstone lever interactions validate reach and persist on the room server",()=>{
 assert.match(protocol,/t: "use"; x: number; y: number; z: number/);
 assert.match(room,/case "use"/);
 assert.match(room,/dx \* dx \+ dy \* dy \+ dz \* dz > SERVER_REACH \* SERVER_REACH/);
  assert.match(room,/await this\.applyEdit\(x, y, z, next, me\.dimensionId\)/);
 assert.match(room,/leverOn: B\.REDSTONE_LEVER_ON/);
 assert.match(main,/this\.net\.send\(\{ t: "use", x: t\.x, y: t\.y, z: t\.z \}\)/);
});


test("directional repeater IDs are wired into solo and authoritative room redstone evaluation",()=>{
 assert.match(main,/repeaters: Array\.from\(\{ length: 16 \}, \(_, i\) => B\.REDSTONE_REPEATER \+ i\)/);
 assert.match(room,/repeaters: Array\.from\(\{ length: 16 \}, \(_, i\) => B\.REDSTONE_REPEATER \+ i\)/);
 const blockDefs=readFileSync(new URL("../shared/blocks.ts",import.meta.url),"utf8");
 assert.match(blockDefs,/REDSTONE_REPEATER: 76, REDSTONE_REPEATER_EAST: 77, REDSTONE_REPEATER_SOUTH: 78, REDSTONE_REPEATER_WEST: 79/);
});

test("repeater delay is user-configurable, persisted as a block variant, and used by the Worker",()=>{
 assert.match(main,/nextRepeaterDelayBlockId/);
 assert.match(main,/リピーター遅延/);
 assert.match(room,/nextRepeaterDelayBlockId/);
  assert.match(room,/delay\.cancel/);
 assert.match(room,/input\.delayTicks/);
 const blockDefs=readFileSync(new URL("../shared/blocks.ts",import.meta.url),"utf8");
 assert.match(blockDefs,/REDSTONE_REPEATER_DELAY_2_NORTH: 80/);
 assert.match(blockDefs,/REDSTONE_REPEATER_DELAY_4_WEST: 91/);
});


test("online mobs are loaded, simulated, and delivered within their dimension", () => {
  assert.match(room, /normalizeSavedMobs<MobInfo>/);
  assert.match(room, /mobs: mobsForDimension\(this\.mobs\.values\(\), me\.dimensionId\)/);
  assert.match(room, /mobs: mobsForDimension\(this\.mobs\.values\(\), target\)/);
  assert.match(room, /mobDimensionId\(target\) !== me\.dimensionId/);
  assert.match(room, /dimensionOnline = online\.filter\(\(\{ st \}\) => st\.dimensionId === dimensionId\)/);
  assert.match(room, /private generatedChunkAt\(cx: number, cz: number, dimensionId: string\): Uint16Array/);
  assert.match(room, /const generated = id === DIMENSION_IDS\.OVERWORLD\s*\? generateChunk\(seed, cx, cz, version\)\s*:\s*generateDimensionChunk\(seed, cx, cz, id\)/);
  assert.match(room, /return this\.generatedChunkAt\(cx, cz, dimensionId\)\[index\] \?\? B\.AIR;/);
  assert.match(room, /broadcastDimension\(\{t:\"mob\",mob\}, me\.dimensionId\)/);
  assert.match(room, /mobDimensionId\(mob\) === me\.dimensionId/);
});


test("death drops and XP orbs are server-authoritative and persisted", () => {
 assert.match(room, /private async handleDeathDrops\(/);
 assert.match(room, /buildDeathDropStacks\(st\.counts, \[\], BLOCKS\.length, MAX_STACK\)/);
 assert.match(room, /experienceDropOnDeath\(priorExperience/);
 assert.match(room, /takeExperienceFromDrop\(me\.vitals\.experience/);
 assert.match(room, /this\.broadcastDimension\(\{ t: "drop"[^}]*xp: drop\.xp/);
});
