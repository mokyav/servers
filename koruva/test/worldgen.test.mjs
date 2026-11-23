import test from "node:test"; import assert from "node:assert/strict"; import {createHash} from "node:crypto"; import {readFileSync} from "node:fs"; import {createWorldgen, createDimensionWorldgen, strongholdPortalRoomPlacements, normalizeWorldgenVersion, WORLDGEN_VERSION} from "../src/client/worldgen-core.js";
import {minecraftBlockVariantId, MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID, MINECRAFT_BLOCK_TO_RUNTIME_ID} from "../shared/minecraft-block-runtime.js";
import {DIMENSION_IDS, END_CENTER_SURFACE_Y, END_CONTINENT_RADIUS, mapDimensionCoordinates} from "../shared/dimensions.js"; import {MINECRAFT_BIOME_IDS,MINECRAFT_STRUCTURE_IDS,MINECRAFT_WORLDGEN_REGISTRY_COUNTS} from "../shared/minecraft-worldgen-catalog.js";
const B={AIR:0,GRASS:1,DIRT:2,STONE:3,SAND:4,LOG:5,LEAVES:6,PLANKS:7,GLASS:8,COBBLE:9,BRICK:10,SNOW:11,WATER:12,LAMP:13,BEDROCK:14,GRAVEL:15,ORE:16,RED:17,BLUE:18,YELLOW:19,WHITE:20,OAK_PLANKS:21,SPRUCE_PLANKS:22,BIRCH_PLANKS:23,OAK_SLAB:24,STONE_SLAB:25,COBBLE_SLAB:26,BRICK_SLAB:27,SANDSTONE:28,COAL_ORE:29,IRON_ORE:30,GOLD_ORE:31,OAK_STAIRS:32,STONE_STAIRS:36,COBBLE_STAIRS:40,BRICK_STAIRS:44,SANDSTONE_STAIRS:48,SPRUCE_STAIRS:52,BIRCH_STAIRS:56,END_STONE:64};
const S=16,H=64,gen=createWorldgen({blocks:B,chunkSize:S,chunkVolume:S*S*H,seaLevel:22,worldHeight:H}),genV4=createWorldgen({blocks:B,blockIds:MINECRAFT_BLOCK_TO_RUNTIME_ID,chunkSize:S,chunkVolume:S*S*H,seaLevel:22,worldHeight:H}),genV5=createWorldgen({blocks:B,blockIds:MINECRAFT_BLOCK_TO_RUNTIME_ID,chunkSize:S,chunkVolume:S*S*H,seaLevel:22,worldHeight:H}),idx=(x,y,z)=>(y*S+z)*S+x,sha=a=>createHash('sha256').update(Uint8Array.from(a)).digest('hex');
test('legacy v1 chunk is byte-for-byte compatible with the previous generator',()=>assert.equal(sha(gen.generateChunk(123456789,-2,3,1)),'ef13bceb8ac520e1d8d54842ee075d7c4785b70f8845b47097807668c14905ed'));
test('v2 is seeded, deterministic, bounded, and keeps bedrock',()=>{const a=gen.generateChunk(918273,-2,3,2),b=gen.generateChunk(918273,-2,3,2),c=gen.generateChunk(918274,-2,3,2);assert.equal(sha(a),sha(b));assert.notEqual(sha(a),sha(c));assert.ok(a instanceof Uint16Array);assert.equal(a.length,S*S*H);for(let z=0;z<S;z++)for(let x=0;x<S;x++)assert.equal(a[idx(x,0,z)],B.BEDROCK);for(const q of a)assert.ok(Number.isInteger(q)&&q>=0&&q<=56);});
test('climate makes all five deterministic biomes',()=>{const seen=new Set();for(let z=-2048;z<=2048;z+=128)for(let x=-2048;x<=2048;x+=128)seen.add(gen.biomeAt(404,x,z,2));assert.deepEqual([...seen].sort(),['desert','forest','plains','snowy','taiga']);assert.equal(gen.biomeAt(404,123,-456,1),'legacy');});
test('v2 generates caves and coal, iron, and gold veins',()=>{const c={caves:0,coal:0,iron:0,gold:0};for(let cz=-2;cz<=2;cz++)for(let cx=-2;cx<=2;cx++){const d=gen.generateChunk(23017,cx,cz,2);for(let z=0;z<S;z++)for(let x=0;x<S;x++){const h=gen.heightAt(23017,cx*S+x,cz*S+z);for(let y=4;y<h-4;y++){const b=d[idx(x,y,z)];if(b===0)c.caves++;if(b===29)c.coal++;if(b===30)c.iron++;if(b===31)c.gold++;}}}assert.ok(c.caves>100,JSON.stringify(c));assert.ok(c.coal>10,JSON.stringify(c));assert.ok(c.iron>10,JSON.stringify(c));assert.ok(c.gold>5,JSON.stringify(c));});

test("v4 cave density is deterministic and creates connected tunnel and cavern networks",()=>{
  const seed=20261123;
  const a=genV4.generateChunk(seed,-2,1,4);
  const b=genV4.generateChunk(seed,-2,1,4);
  assert.equal(sha(a),sha(b));
  let air=0,adjacent=0;
  for(let y=3;y<H-3;y++) for(let z=0;z<S;z++) for(let x=0;x<S;x++){
    if(a[idx(x,y,z)]!==0) continue;
    air++;
    if((x+1<S&&a[idx(x+1,y,z)]===0)||(y+1<H&&a[idx(x,y+1,z)]===0)||(z+1<S&&a[idx(x,y,z+1)]===0)) adjacent++;
  }
  assert.ok(air>140,"expected meaningful cave volume, got "+air);
  assert.ok(adjacent>air*0.40,"caves should form connected spaces, got "+adjacent+"/"+air);
  assert.ok(["cave","lush_caves","dripstone_caves","deep_dark","sulfur_caves"].includes(genV4.caveBiomeAt(seed,16,12,24)));
});

test("v4 generates common overworld ores and deep deepslate variants",()=>{
  const names=["coal_ore","deepslate_coal_ore","iron_ore","deepslate_iron_ore","copper_ore","deepslate_copper_ore","gold_ore","deepslate_gold_ore","redstone_ore","deepslate_redstone_ore","diamond_ore","deepslate_diamond_ore","lapis_ore","deepslate_lapis_ore"];
  const counts=new Map(names.map(name=>[name,0]));
  for(let cz=-3;cz<=3;cz++) for(let cx=-3;cx<=3;cx++){
    const data=genV4.generateChunk(20261123,cx,cz,4);
    for(const name of names){
      const id=MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:"+name];
      if(!id) continue;
      for(const value of data) if(value===id) counts.set(name,counts.get(name)+1);
    }
  }
  for(const family of ["coal_ore","iron_ore","copper_ore","gold_ore","redstone_ore","diamond_ore","lapis_ore"]){
    assert.ok(counts.get(family)+counts.get("deepslate_"+family)>0,"missing "+family);
  }
  assert.ok(counts.get("deepslate_coal_ore")+counts.get("deepslate_iron_ore")+counts.get("deepslate_copper_ore")>0,"deep strata should contain deepslate ores");
});

test("v4 ore veins are deterministic across neighbouring chunk generation order",()=>{
  const seed=884422;
  const left=genV4.generateChunk(seed,-1,0,4);
  const right=genV4.generateChunk(seed,0,0,4);
  assert.equal(sha(left),sha(genV4.generateChunk(seed,-1,0,4)));
  assert.equal(sha(right),sha(genV4.generateChunk(seed,0,0,4)));
});

test('tree canopy crosses a chunk boundary without a seam',()=>{let found=false;outer:for(let seed=1;seed<=32;seed++)for(let edge=-128;edge<=128;edge+=16)for(let z=-128;z<=128;z++){const h=gen.heightAt(seed,edge-1,z),th=gen.treeAt(seed,edge-1,z,h,2);if(!th||h+th+1>=H)continue;const right=gen.generateChunk(seed,edge/16,Math.floor(z/16),2),lz=((z%16)+16)%16;if(right[idx(0,h+th+1,lz)]===B.LEAVES){found=true;break outer;}}assert.equal(found,true);});
test('negative chunks are independent of generation order',()=>{const a=gen.generateChunk(7721,-4,-7,2),b=gen.generateChunk(7721,-3,-7,2);assert.equal(sha(a),sha(gen.generateChunk(7721,-4,-7,2)));assert.equal(sha(b),sha(gen.generateChunk(7721,-3,-7,2)));});

test('v3 exposes the complete 26.3 biome and structure registries and creates deterministic extended terrain',()=>{
  assert.equal(MINECRAFT_BIOME_IDS.length,67);
  assert.equal(MINECRAFT_STRUCTURE_IDS.length,52);
  assert.equal(MINECRAFT_WORLDGEN_REGISTRY_COUNTS["worldgen/placed_feature"],273);
  const seen=new Set(); for(let z=-2048;z<=2048;z+=96) for(let x=-2048;x<=2048;x+=96) seen.add(gen.biomeAt(20261121,x,z,3));
  assert.ok(seen.size>=12,`only ${seen.size} biomes found`);
  const allowed=new Set(MINECRAFT_BIOME_IDS.map(id=>id.replace(/^minecraft:/,"")));
  for(const name of seen) assert.ok(allowed.has(name),`unknown generated biome ${name}`);
  const a=gen.generateChunk(20261121,-3,4,3),b=gen.generateChunk(20261121,-3,4,3);
  assert.equal(sha(a),sha(b)); assert.equal(a.length,S*S*H);
});


test("Stronghold portal room is carved hollow and has twelve inward-facing empty-eye frame states", () => {
  const frameIds = Object.fromEntries(["north", "east", "south", "west"].map(facing => [
    facing,
    minecraftBlockVariantId("minecraft:end_portal_frame", { eye: "false", facing }),
  ]));
  for (const facing of Object.keys(frameIds)) assert.ok(frameIds[facing] > 0, `missing end portal frame state: ${facing}`);

  const edits = strongholdPortalRoomPlacements(32, -48, END_CENTER_SURFACE_Y, B.BRICK, facing => frameIds[facing]);
  const finalBlocks = new Map(edits.map(([x, y, z, id]) => [`${x},${y},${z}`, id]));
  const frames = edits.filter(([, , , id]) => MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID[id]?.token === "end_portal_frame");

  assert.equal(frames.length, 12);
  assert.equal(new Set(frames.map(([x, y, z]) => `${x},${y},${z}`)).size, 12);

  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
    assert.equal(finalBlocks.get(`${32 + x},${END_CENTER_SURFACE_Y + 1},${-48 + z}`), B.AIR, "the 3×3 portal opening must stay empty");
  }

  for (const [x, y, z, id] of frames) {
    const state = MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID[id];
    assert.equal(state.state.eye, "false");
    const expectedFacing = z === -50 ? "south" : z === -46 ? "north" : x === 30 ? "east" : "west";
    assert.equal(state.state.facing, expectedFacing);
    assert.equal(y, END_CENTER_SURFACE_Y + 1);
  }
  assert.equal(finalBlocks.get(`32,${END_CENTER_SURFACE_Y + 1},-48`), B.AIR);
  assert.equal(finalBlocks.get(`32,${END_CENTER_SURFACE_Y},-48`), B.BRICK, "portal room floor is at the surface reference Y");
  assert.equal(finalBlocks.get(`32,${END_CENTER_SURFACE_Y},-72`), B.BRICK, "open-air approach path reaches the surface");
});


test("End main continent has a constant surface Y and the End arrival coordinate uses it", () => {
  const endGen = createDimensionWorldgen({ blocks: B, chunkSize: S, chunkVolume: S*S*H, worldHeight: H });
  const seed = 20261123;
  const samples = [[0,0],[15,15],[32,0],[-48,32],[60,0],[-64,0],[0,64]];
  for (const [x,z] of samples) {
    assert.ok(Math.hypot(x,z) < END_CONTINENT_RADIUS - 12);
    const cx = Math.floor(x/S), cz = Math.floor(z/S);
    const lx = ((x % S) + S) % S, lz = ((z % S) + S) % S;
    const data = endGen.generateChunk(seed,cx,cz,DIMENSION_IDS.END);
    assert.equal(data[idx(lx,END_CENTER_SURFACE_Y,lz)],B.END_STONE, `flat surface missing at ${x},${z}`);
    assert.equal(data[idx(lx,END_CENTER_SURFACE_Y+1,lz)],B.AIR, `unexpected block above flat surface at ${x},${z}`);
  }
  const mapped = mapDimensionCoordinates(DIMENSION_IDS.OVERWORLD,DIMENSION_IDS.END,{x:100,y:70,z:-20});
  assert.equal(mapped.x,0);
  assert.equal(mapped.z,0);
  assert.equal(mapped.y,END_CENTER_SURFACE_Y+1);
});


test("v5 adds Java 26.3 cave formations, geodes, and attached cave blocks deterministically", () => {
  assert.equal(WORLDGEN_VERSION, 5);
  assert.equal(normalizeWorldgenVersion(4), 4, "saved v4 worlds must retain their generator");
  assert.equal(normalizeWorldgenVersion(5), 5);
  const seed = 20261123;
  const names = ["smooth_basalt", "calcite", "amethyst_block", "budding_amethyst", "amethyst_cluster", "glow_lichen", "pointed_dripstone", "sculk_vein", "hanging_roots", "rooted_dirt", "sulfur_spike"];
  const ids = Object.fromEntries(names.map(name => [name, MINECRAFT_BLOCK_TO_RUNTIME_ID["minecraft:" + name] ?? 0]));
  const counts = Object.fromEntries(names.map(name => [name, 0]));
  for (let cz = -3; cz <= 3; cz++) for (let cx = -3; cx <= 3; cx++) {
    const chunk = genV5.generateChunk(seed, cx, cz, 5);
    for (const name of names) {
      const id = ids[name];
      if (!id) continue;
      for (const value of chunk) if (value === id) counts[name]++;
    }
  }
  assert.ok(counts.smooth_basalt > 0, "geode outer shell must use smooth basalt");
  assert.ok(counts.calcite > 0, "geode middle shell must use calcite");
  assert.ok(counts.amethyst_block + counts.budding_amethyst > 0, "geode inner shell must use amethyst");
  assert.ok(counts.glow_lichen + counts.pointed_dripstone + counts.sculk_vein + counts.hanging_roots > 0, "cave wall and biome features should be generated");
  const a = genV5.generateChunk(seed, -2, 1, 5);
  const b = genV5.generateChunk(seed, -2, 1, 5);
  assert.equal(sha(a), sha(b), "v5 generation must be deterministic");
});

test("v5 keeps v4 saved-room generation selectable after the default version changes", () => {
  const room = readFileSync(new URL("../src/worker/room.ts", import.meta.url), "utf8");
  assert.ok(room.includes("normalizeWorldgenVersion(this.meta?.worldgenVersion ?? LEGACY_WORLDGEN_VERSION)"));
  assert.ok(!room.includes("this.meta?.worldgenVersion===WORLDGEN_VERSION?WORLDGEN_VERSION:LEGACY_WORLDGEN_VERSION"));
});
