import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID,
  MINECRAFT_BLOCK_STATE_RUNTIME_ID_END,
  MINECRAFT_BLOCK_RUNTIME_ID_END,
  MINECRAFT_BLOCK_TO_RUNTIME_ID,
  minecraftBlockVariantId,
} from '../shared/minecraft-block-runtime.js';
import { MINECRAFT_ITEM_TO_RUNTIME_ID } from '../shared/minecraft-item-runtime.js';
import { MINECRAFT_BLOCK_MODEL_REGISTRY } from '../shared/minecraft-block-model-registry.js';
import { MINECRAFT_BLOCK_OCCUPANCY } from '../shared/minecraft-block-occupancy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'src/client/public/assets/minecraft');

test('Stage 5 catalog keeps block, legacy state, and inventory-only item ID spaces disjoint', () => {
  const itemOnly = Object.entries(MINECRAFT_ITEM_TO_RUNTIME_ID).filter(([key, id]) => !MINECRAFT_BLOCK_TO_RUNTIME_ID[key] && id > 0);
  const itemIds = new Set(itemOnly.map(([, id]) => id));
  assert.ok(itemOnly.length > 0);
  assert.ok(Math.min(...itemIds) > MINECRAFT_BLOCK_RUNTIME_ID_END);
  for (const id of Object.keys(MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID).map(Number)) {
    if (id > MINECRAFT_BLOCK_RUNTIME_ID_END) assert.ok(!itemIds.has(id), `state ${id} collided with an inventory-only item`);
  }
  assert.ok(Math.min(...itemIds) > MINECRAFT_BLOCK_STATE_RUNTIME_ID_END, "item-only IDs must start after every block-state variant");
});

test('official blockstate variants resolve facing, part, axes, and shape into model instances', () => {
  const cases = [
    ['red_bed', { facing: 'east', part: 'head' }, 'minecraft:block/red_bed_head'],
    ['oak_log', { axis: 'x' }, 'minecraft:block/oak_log_horizontal'],
    ['oak_stairs', { facing: 'north', half: 'bottom', shape: 'inner_left' }, 'minecraft:block/oak_stairs_inner'],
    ['oak_button', { face: 'floor', facing: 'east', powered: 'false' }, 'minecraft:block/oak_button'],
    ['oak_door', { facing: 'south', half: 'upper', hinge: 'right', open: 'true' }, 'minecraft:block/oak_door']
  ];
  for (const [token, state, expectedModelPrefix] of cases) {
    const id = minecraftBlockVariantId(token, state);
    assert.ok(id > MINECRAFT_BLOCK_RUNTIME_ID_END, `${token} state should have appended variant id`);
    assert.equal(MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID[id]?.token, token);
    assert.ok(MINECRAFT_BLOCK_MODEL_REGISTRY.byId[id]?.length, `${token} state should resolve to a model`);
    assert.ok(MINECRAFT_BLOCK_MODEL_REGISTRY.byId[id].some((instance) => MINECRAFT_BLOCK_MODEL_REGISTRY.models[instance.m]?.name.startsWith(expectedModelPrefix)));
  }
});

test('special chest, bed, banner, shulker and decorated-pot model paths are present', () => {
  const ids = [
    minecraftBlockVariantId('chest', { facing: 'west' }),
    minecraftBlockVariantId('white_bed', { facing: 'south', part: 'foot' }),
    minecraftBlockVariantId('white_banner', { rotation: '4' }),
    minecraftBlockVariantId('white_shulker_box', {}),
    minecraftBlockVariantId('decorated_pot', {})
  ];
  for (const id of ids) assert.ok(MINECRAFT_BLOCK_MODEL_REGISTRY.byId[id]?.length, `missing special model for block id ${id}`);
  const names = new Set(MINECRAFT_BLOCK_MODEL_REGISTRY.models.map((model) => model.name));
  assert.ok(names.has('koruva:special/chest'));
  assert.ok(names.has('koruva:special/white_banner'));
  assert.ok(names.has('koruva:special/decorated_pot'));
});

test('every referenced block texture is packaged and each model face has valid UV metadata', () => {
  assert.equal(MINECRAFT_BLOCK_MODEL_REGISTRY.modelCount, MINECRAFT_BLOCK_MODEL_REGISTRY.models.length);
  for (const key of MINECRAFT_BLOCK_MODEL_REGISTRY.textures) {
    const relative = key.replace(/^minecraft:/, '');
    assert.ok(fs.existsSync(path.join(assets, 'textures', `${relative}.png`)), `missing texture ${key}`);
  }
  for (const model of MINECRAFT_BLOCK_MODEL_REGISTRY.models) {
    assert.ok(model.elements.length > 0, `empty model ${model.name}`);
    for (const element of model.elements) {
      assert.equal(element.from.length, 3);
      assert.equal(element.to.length, 3);
      for (const face of Object.values(element.faces)) {
        assert.ok([0, 90, 180, 270].includes(face.rotation));
        assert.ok(face.uv === null || face.uv.length === 4);
      }
    }
  }
});

test('model-derived collision masks cover modelled blocks and remain 4x4x4 masks', () => {
  assert.ok(MINECRAFT_BLOCK_OCCUPANCY.length > MINECRAFT_BLOCK_STATE_RUNTIME_ID_END);
  const stone = MINECRAFT_BLOCK_TO_RUNTIME_ID['minecraft:stone'];
  const stairs = minecraftBlockVariantId('oak_stairs', { facing: 'north', half: 'bottom', shape: 'straight' });
  assert.equal(MINECRAFT_BLOCK_OCCUPANCY[stone], 'ffffffffffffffff');
  assert.ok(MINECRAFT_BLOCK_OCCUPANCY[stairs]);
  assert.notEqual(MINECRAFT_BLOCK_OCCUPANCY[stairs], 'ffffffffffffffff');
  for (const mask of MINECRAFT_BLOCK_OCCUPANCY) if (mask !== null) assert.match(mask, /^[0-9a-f]{16}$/);
});


test('Stage 5 GUI sprite backgrounds and vanilla widget assets are present and referenced', () => {
  const css = fs.readFileSync(path.join(root, 'src/client/style.css'), 'utf8');
  const expected = [
    'textures/gui/menu_background.png',
    'textures/gui/inworld_menu_background.png',
    'textures/gui/sprites/widget/button.png',
    'textures/gui/sprites/widget/button_highlighted.png',
    'textures/gui/sprites/widget/button_disabled.png',
    'textures/gui/sprites/widget/text_field.png',
    'textures/gui/container/inventory.png',
    'textures/gui/container/crafting_table.png',
    'textures/gui/sprites/hud/hotbar.png',
    'textures/gui/sprites/hud/crosshair.png',
  ];
  for (const resource of expected) {
    assert.ok(fs.existsSync(path.join(assets, resource)), `missing vanilla GUI asset ${resource}`);
    assert.ok(css.includes(`/assets/minecraft/${resource}`), `GUI stylesheet does not reference ${resource}`);
  }
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
});

test('generated chest and banner special tiles are all exact 16x16 PNGs', () => {
  const special = path.join(assets, 'textures', 'koruva');
  const files = [
    ...fs.readdirSync(path.join(special, 'chest')).map((name) => path.join(special, 'chest', name)),
    ...fs.readdirSync(path.join(special, 'banner')).map((name) => path.join(special, 'banner', name)),
  ];
  assert.equal(files.filter((file) => file.endsWith('.png')).length, 86);
  for (const file of files.filter((item) => item.endsWith('.png'))) {
    const header = fs.readFileSync(file).subarray(0, 24);
    assert.equal(header.readUInt32BE(16), 16, `${file} width`);
    assert.equal(header.readUInt32BE(20), 16, `${file} height`);
  }
});
