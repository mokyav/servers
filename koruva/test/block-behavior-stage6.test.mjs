import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canBlockStay,
  canPlaceBlockAt,
  blockToken,
  isFallingBlock,
  isReplaceableBlock,
  pairedBlockPosition,
  requiresBlockSupport,
} from '../shared/block-behavior.js';
import { getBlockDrops } from '../shared/gameplay.js';
import { MINECRAFT_ITEM_TO_RUNTIME_ID } from '../shared/minecraft-item-runtime.js';

const ids = { floor: 900001, torch: 900002, sand: 900003, doorLower: 900004, doorUpper: 900005, gate: 900006, bedFoot: 900007, bedHead: 900008, grass: 900009, farmland: 900010, wheat: 900011, water: 900012, sugarCane: 900013, lilyPad: 900014, cactus: 900015, sign: 900016, vine: 900017, repeater: 900018, endRod: 900019, bell: 900020, coral: 900021, seaPickle: 900022, chorusPlant: 900023, chorusFlower: 900024 };
const blocks = {
  [ids.floor]: { key: 'minecraft:stone', solid: true, placeable: true, shape: 'cube' },
  [ids.torch]: { key: 'minecraft:torch', solid: false, placeable: true, shape: 'thin' },
  [ids.sand]: { key: 'minecraft:sand', solid: true, placeable: true, shape: 'cube' },
  [ids.doorLower]: { key: 'minecraft:oak_door_lower_north_left_closed', solid: false, placeable: true, shape: 'door', state: { half: 'lower', facing: 'north' } },
  [ids.doorUpper]: { key: 'minecraft:oak_door_upper_north_left_closed', solid: false, placeable: true, shape: 'door', state: { half: 'upper', facing: 'north' } },
  [ids.gate]: { key: 'minecraft:oak_fence_gate', solid: false, placeable: true, shape: 'door', state: { facing: 'north' } },
  [ids.bedFoot]: { key: 'minecraft:red_bed', solid: false, placeable: true, shape: 'thin', state: { facing: 'east', part: 'foot' } },
  [ids.bedHead]: { key: 'minecraft:red_bed', solid: false, placeable: true, shape: 'thin', state: { facing: 'east', part: 'head' } },
  [ids.grass]: { key: 'minecraft:short_grass', solid: false, placeable: true, shape: 'thin' },
  [ids.farmland]: { key: 'minecraft:farmland', solid: true, placeable: true, shape: 'cube' },
  [ids.wheat]: { key: 'minecraft:wheat', solid: false, placeable: true, shape: 'thin' },
  [ids.water]: { key: 'minecraft:water', solid: false, render: 'liquid', placeable: true, shape: 'cube' },
  [ids.sugarCane]: { key: 'minecraft:sugar_cane', solid: false, placeable: true, shape: 'thin' },
  [ids.lilyPad]: { key: 'minecraft:lily_pad', solid: false, placeable: true, shape: 'thin' },
  [ids.cactus]: { key: 'minecraft:cactus', solid: true, placeable: true, shape: 'cube' },
  [ids.sign]: { key: 'minecraft:oak_sign', solid: false, placeable: true, shape: 'thin', state: { rotation: '0' } },
  [ids.vine]: { key: 'minecraft:vine', solid: false, placeable: true, shape: 'thin', state: { north: 'true', east: 'false', south: 'false', west: 'false', up: 'false' } },
  [ids.repeater]: { key: 'minecraft:repeater', solid: false, placeable: true, shape: 'thin' },
  [ids.endRod]: { key: 'minecraft:end_rod', solid: false, placeable: true, shape: 'thin', state: { facing: 'east' } },
  [ids.bell]: { key: 'minecraft:bell', solid: false, placeable: true, shape: 'thin', state: { attachment: 'ceiling' } },
  [ids.coral]: { key: 'minecraft:tube_coral_block', solid: true, placeable: true, shape: 'cube' },
  [ids.seaPickle]: { key: 'minecraft:sea_pickle', solid: false, placeable: true, shape: 'thin' },
  [ids.chorusPlant]: { key: 'minecraft:chorus_plant', solid: false, placeable: true, shape: 'thin' },
  [ids.chorusFlower]: { key: 'minecraft:chorus_flower', solid: false, placeable: true, shape: 'thin' },
};

function world(entries = []) {
  const map = new Map(entries.map(([x, y, z, id]) => [`${x},${y},${z}`, id]));
  return (x, y, z) => map.get(`${x},${y},${z}`) ?? 0;
}

test('floor-attached blocks require a solid support and cannot be placed in mid-air', () => {
  const get = world([[0, 0, 0, ids.floor]]);
  assert.equal(requiresBlockSupport(ids.torch, blocks), true);
  assert.equal(canBlockStay(get, ids.torch, 0, 1, 0, blocks), true);
  assert.equal(canBlockStay(() => 0, ids.torch, 0, 1, 0, blocks), false);
  assert.equal(canPlaceBlockAt(get, ids.torch, 0, 1, 0, blocks), true);
  assert.equal(canPlaceBlockAt(() => 0, ids.torch, 0, 1, 0, blocks), false);
});

test('plant blocks and air are replaceable while solid blocks are not', () => {
  assert.equal(isReplaceableBlock(0, blocks), true);
  assert.equal(isReplaceableBlock(ids.grass, blocks), true);
  assert.equal(isReplaceableBlock(ids.floor, blocks), false);
});

test('sand is treated as a gravity block', () => {
  assert.equal(isFallingBlock(ids.sand, blocks), true);
  assert.equal(isFallingBlock(ids.floor, blocks), false);
});

test('double doors use a paired vertical cell and fail as a pair if floor support is removed', () => {
  const pair = pairedBlockPosition(ids.doorLower, 2, 5, 3, blocks);
  assert.deepEqual(pair, { x: 2, y: 6, z: 3 });
  assert.equal(blockToken(ids.doorLower, blocks), blockToken(ids.doorUpper, blocks));
  const get = world([[2, 4, 3, ids.floor], [2, 5, 3, ids.doorLower], [2, 6, 3, ids.doorUpper]]);
  assert.equal(canBlockStay(get, ids.doorLower, 2, 5, 3, blocks), true);
  assert.equal(canBlockStay((x, y, z) => y === 6 && x === 2 && z === 3 ? ids.doorUpper : 0, ids.doorLower, 2, 5, 3, blocks), false);
});

test('fence gates are not incorrectly treated as floor-attached doors', () => {
  assert.equal(requiresBlockSupport(ids.gate, blocks), false);
});

test('bed pair position follows its facing and head/foot state', () => {
  assert.deepEqual(pairedBlockPosition(ids.bedFoot, 4, 8, 9, blocks), { x: 5, y: 8, z: 9 });
  assert.deepEqual(pairedBlockPosition(ids.bedHead, 5, 8, 9, blocks), { x: 4, y: 8, z: 9 });
  const get = world([[4, 7, 9, ids.floor], [5, 7, 9, ids.floor], [4, 8, 9, ids.bedFoot], [5, 8, 9, ids.bedHead]]);
  assert.equal(canBlockStay(get, ids.bedFoot, 4, 8, 9, blocks), true);
  assert.equal(canBlockStay((x, y, z) => x === 5 && y === 8 && z === 9 ? ids.bedHead : 0, ids.bedFoot, 4, 8, 9, blocks), false);
});

test('crops require farmland and sugar cane requires valid soil next to water', () => {
  assert.equal(canBlockStay(world([[0, 0, 0, ids.farmland]]), ids.wheat, 0, 1, 0, blocks), true);
  assert.equal(canBlockStay(world([[0, 0, 0, ids.floor]]), ids.wheat, 0, 1, 0, blocks), false);
  assert.equal(canBlockStay(world([[0, 0, 0, ids.sand], [1, 0, 0, ids.water]]), ids.sugarCane, 0, 1, 0, blocks), true);
  assert.equal(canBlockStay(world([[0, 0, 0, ids.sand]]), ids.sugarCane, 0, 1, 0, blocks), false);
});

test('lily pads may rest on water and cactus only rests on sand or red sand', () => {
  assert.equal(canBlockStay(world([[0, 0, 0, ids.water]]), ids.lilyPad, 0, 1, 0, blocks), true);
  assert.equal(canBlockStay(world([[0, 0, 0, ids.floor]]), ids.lilyPad, 0, 1, 0, blocks), false);
  assert.equal(canBlockStay(world([[0, 0, 0, ids.sand]]), ids.cactus, 0, 1, 0, blocks), true);
  assert.equal(canBlockStay(world([[0, 0, 0, ids.floor]]), ids.cactus, 0, 1, 0, blocks), false);
});

test('standing signs need a floor and vines need at least one attached face', () => {
  assert.equal(canBlockStay(world([[0, 0, 0, ids.floor]]), ids.sign, 0, 1, 0, blocks), true);
  assert.equal(canBlockStay(() => 0, ids.sign, 0, 1, 0, blocks), false);
  assert.equal(canBlockStay(world([[-0, 1, -1, ids.floor]]), ids.vine, 0, 1, 0, blocks), true);
  assert.equal(canBlockStay(() => 0, ids.vine, 0, 1, 0, blocks), false);
});

test('stone requires a pickaxe and silk touch preserves the mined block', () => {
  const B = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4 };
  const item = id => id === B.COBBLE ? 44 : id;
  const catalog = {
    [3]: { key: 'minecraft:stone' },
    [20]: { key: 'minecraft:wooden_pickaxe' },
    [21]: { key: 'minecraft:iron_pickaxe' },
  };
  assert.deepEqual(getBlockDrops(3, B, item, { blocks: catalog }), []);
  assert.deepEqual(getBlockDrops(3, B, item, { blocks: catalog, toolItemId: 20 }), [{ itemId: 44, count: 1 }]);
  assert.deepEqual(getBlockDrops(3, B, item, { blocks: catalog, toolItemId: 21, enchantments: { silk_touch: 1 } }), [{ itemId: 3, count: 1 }]);
});

test('diamond ore needs an iron-tier pickaxe and Fortune scales the item-only drop', () => {
  const oreId = 51, woodenId = 52, ironId = 53;
  const diamondId = MINECRAFT_ITEM_TO_RUNTIME_ID['minecraft:diamond'];
  const catalog = {
    [oreId]: { key: 'minecraft:diamond_ore' },
    [woodenId]: { key: 'minecraft:wooden_pickaxe' },
    [ironId]: { key: 'minecraft:iron_pickaxe' },
  };
  const blockItem = () => 0;
  assert.deepEqual(getBlockDrops(oreId, {}, blockItem, { blocks: catalog, toolItemId: woodenId }), []);
  assert.deepEqual(getBlockDrops(oreId, {}, blockItem, { blocks: catalog, toolItemId: ironId, random: () => 0.999999, enchantments: { fortune: 3 } }), [{ itemId: diamondId, count: 4 }]);
});

test('leaves require shears or Silk Touch and gravel drops flint only 10 percent of the time', () => {
  const leavesId = 61, gravelId = 62, shearsId = 63;
  const catalog = {
    [leavesId]: { key: 'minecraft:oak_leaves' },
    [gravelId]: { key: 'minecraft:gravel' },
    [shearsId]: { key: 'minecraft:shears' },
  };
  const item = id => id;
  assert.deepEqual(getBlockDrops(leavesId, {}, item, { blocks: catalog }), []);
  assert.deepEqual(getBlockDrops(leavesId, {}, item, { blocks: catalog, toolItemId: shearsId }), [{ itemId: leavesId, count: 1 }]);
  assert.deepEqual(getBlockDrops(gravelId, {}, item, { blocks: catalog, random: () => 0 }), [{ itemId: MINECRAFT_ITEM_TO_RUNTIME_ID['minecraft:flint'], count: 1 }]);
  assert.deepEqual(getBlockDrops(gravelId, {}, item, { blocks: catalog, random: () => 0.5 }), [{ itemId: gravelId, count: 1 }]);
});

test('client and room server route paired-block cleanup, support checks, and dimension-aware mining', () => {
  const root = new URL('..', import.meta.url);
  const client = fs.readFileSync(new URL('src/client/main.ts', root), 'utf8');
  const worker = fs.readFileSync(new URL('src/worker/room.ts', root), 'utf8');
  assert.match(client, /pairedBlockPosition\(id, cell\.x, cell\.y, cell\.z, BLOCKS\)/);
  assert.match(client, /resolveBlockStateChanges\(get, cell\.x, cell\.y, cell\.z\)/);
  assert.match(client, /const affected = new Map/);
  assert.match(worker, /pairedBlockPosition\(brokenBlockId, x, y, z, BLOCKS\)/);
  assert.match(worker, /canPlaceBlockAt\(\(bx, by, bz\) => this\.blockAt\(bx, by, bz, me\.dimensionId\)/);
  const digStart = worker.slice(worker.indexOf('case "dig-start":'), worker.indexOf('case "dig-cancel":'));
  assert.match(digStart, /this\.blockAt\(x, y, z, me\.dimensionId\)/);
});


test('repeaters, end rods, ceiling bells, chorus flowers, and sea pickles validate their vanilla support type', () => {
  assert.equal(canBlockStay(world([[0, 0, 0, ids.floor]]), ids.repeater, 0, 1, 0, blocks), true);
  assert.equal(canBlockStay(() => 0, ids.repeater, 0, 1, 0, blocks), false);
  assert.equal(canBlockStay(world([[0, 1, 0, ids.floor]]), ids.endRod, 0, 0, 0, { ...blocks, [ids.endRod]: { ...blocks[ids.endRod], state: { facing: 'down' } } }), true);
  assert.equal(canBlockStay(world([[0, 1, 0, ids.floor]]), ids.bell, 0, 0, 0, blocks), true);
  assert.equal(canBlockStay(world([[0, 0, 0, ids.coral]]), ids.seaPickle, 0, 1, 0, blocks), true);
  assert.equal(canBlockStay(world([[0, 0, 0, ids.chorusPlant]]), ids.chorusFlower, 0, 1, 0, blocks), true);
  assert.equal(canBlockStay(world([[0, 0, 0, ids.floor]]), ids.chorusFlower, 0, 1, 0, blocks), false);
  assert.equal(canBlockStay(world([[0, 0, 0, ids.floor]]), ids.seaPickle, 0, 1, 0, blocks), false);
});
