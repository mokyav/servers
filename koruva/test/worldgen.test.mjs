import test from "node:test"; import assert from "node:assert/strict"; import {createHash} from "node:crypto"; import {createWorldgen} from "../src/client/worldgen-core.js"; import {MINECRAFT_BIOME_IDS,MINECRAFT_STRUCTURE_IDS,MINECRAFT_WORLDGEN_REGISTRY_COUNTS} from "../shared/minecraft-worldgen-catalog.js";
const B={AIR:0,GRASS:1,DIRT:2,STONE:3,SAND:4,LOG:5,LEAVES:6,PLANKS:7,GLASS:8,COBBLE:9,BRICK:10,SNOW:11,WATER:12,LAMP:13,BEDROCK:14,GRAVEL:15,ORE:16,RED:17,BLUE:18,YELLOW:19,WHITE:20,OAK_PLANKS:21,SPRUCE_PLANKS:22,BIRCH_PLANKS:23,OAK_SLAB:24,STONE_SLAB:25,COBBLE_SLAB:26,BRICK_SLAB:27,SANDSTONE:28,COAL_ORE:29,IRON_ORE:30,GOLD_ORE:31,OAK_STAIRS:32,STONE_STAIRS:36,COBBLE_STAIRS:40,BRICK_STAIRS:44,SANDSTONE_STAIRS:48,SPRUCE_STAIRS:52,BIRCH_STAIRS:56};
const S=16,H=64,gen=createWorldgen({blocks:B,chunkSize:S,chunkVolume:S*S*H,seaLevel:22,worldHeight:H}),idx=(x,y,z)=>(y*S+z)*S+x,sha=a=>createHash('sha256').update(Uint8Array.from(a)).digest('hex');
test('legacy v1 chunk is byte-for-byte compatible with the previous generator',()=>assert.equal(sha(gen.generateChunk(123456789,-2,3,1)),'ef13bceb8ac520e1d8d54842ee075d7c4785b70f8845b47097807668c14905ed'));
test('v2 is seeded, deterministic, bounded, and keeps bedrock',()=>{const a=gen.generateChunk(918273,-2,3,2),b=gen.generateChunk(918273,-2,3,2),c=gen.generateChunk(918274,-2,3,2);assert.equal(sha(a),sha(b));assert.notEqual(sha(a),sha(c));assert.ok(a instanceof Uint16Array);assert.equal(a.length,S*S*H);for(let z=0;z<S;z++)for(let x=0;x<S;x++)assert.equal(a[idx(x,0,z)],B.BEDROCK);for(const q of a)assert.ok(Number.isInteger(q)&&q>=0&&q<=56);});
test('climate makes all five deterministic biomes',()=>{const seen=new Set();for(let z=-2048;z<=2048;z+=128)for(let x=-2048;x<=2048;x+=128)seen.add(gen.biomeAt(404,x,z,2));assert.deepEqual([...seen].sort(),['desert','forest','plains','snowy','taiga']);assert.equal(gen.biomeAt(404,123,-456,1),'legacy');});
test('v2 generates caves and coal, iron, and gold veins',()=>{const c={caves:0,coal:0,iron:0,gold:0};for(let cz=-2;cz<=2;cz++)for(let cx=-2;cx<=2;cx++){const d=gen.generateChunk(23017,cx,cz,2);for(let z=0;z<S;z++)for(let x=0;x<S;x++){const h=gen.heightAt(23017,cx*S+x,cz*S+z);for(let y=4;y<h-4;y++){const b=d[idx(x,y,z)];if(b===0)c.caves++;if(b===29)c.coal++;if(b===30)c.iron++;if(b===31)c.gold++;}}}assert.ok(c.caves>100,JSON.stringify(c));assert.ok(c.coal>10,JSON.stringify(c));assert.ok(c.iron>10,JSON.stringify(c));assert.ok(c.gold>5,JSON.stringify(c));});
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


test("v3 carves 3D caves as well as the legacy world generator", () => {
  const caveSeed = 23017;
  let caves = 0;
  for (let cz = -2; cz <= 2; cz++) for (let cx = -2; cx <= 2; cx++) {
    const data = gen.generateChunk(caveSeed, cx, cz, 3);
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const h = gen.heightAt(caveSeed, cx * S + x, cz * S + z);
      for (let y = 4; y < h - 4; y++) if (data[idx(x, y, z)] === B.AIR) caves++;
    }
  }
  assert.ok(caves > 100, `expected v3 cave carving, found ${caves} air cells`);
});

test("v3 stony shore keeps its biome surface instead of becoming generic sand", () => {
  const seed = 20261122;
  let location = null;
  outer: for (let z = -4096; z <= 4096; z += 16) {
    for (let x = -4096; x <= 4096; x += 16) {
      if (gen.biomeAt(seed, x, z, 3) === "stony_shore" && gen.heightAt(seed, x, z) <= 25) {
        location = { x, z, height: gen.heightAt(seed, x, z) };
        break outer;
      }
    }
  }
  assert.ok(location, "test seed should contain a low-elevation stony shore");
  const chunk = gen.generateChunk(seed, Math.floor(location.x / S), Math.floor(location.z / S), 3);
  const lx = ((location.x % S) + S) % S, lz = ((location.z % S) + S) % S;
  assert.equal(chunk[idx(lx, location.height, lz)], B.STONE,
    "stony shore uses stone surface; coastal override must not replace it with sand");
});
