import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSoloRedstoneRuntime } from "../shared/solo-redstone.js";
const IDS = { source: 1, wire: 2, lampOff: 3, lampOn: 4, leverOn: 5, repeaters: Array.from({length: 16}, (_, i) => 76 + i) };
function createWorld(repeaterId = 76) {
  const cells = new Map([["0,4,1", 1], ["0,4,0", repeaterId], ["0,4,-1", 3]]);
  const blockAt = (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0;
  const setBlock = (x, y, z, id) => cells.set(`${x},${y},${z}`, id);
  const runtime = createSoloRedstoneRuntime({ blockAt, setBlock, ids: IDS });
  return { blockAt, setBlock, runtime };
}
test("solo repeater applies lamp power only after 1 redstone tick", () => {
  const w = createWorld(); w.runtime.onBlockChanged(0, 4, 1);
  assert.equal(w.blockAt(0, 4, -1), 3); assert.equal(w.runtime.pending, 1);
  w.runtime.advance(0.049); assert.equal(w.blockAt(0, 4, -1), 3);
  w.runtime.advance(0.001); assert.equal(w.blockAt(0, 4, -1), 4); assert.equal(w.runtime.pending, 0);
});
test("solo repeater honors the selected 4-tick delay", () => {
  const w = createWorld(88); w.runtime.onBlockChanged(0, 4, 1);
  for (let i=0;i<3;i++) { w.runtime.advance(0.05); assert.equal(w.blockAt(0,4,-1),3); }
  w.runtime.advance(0.05); assert.equal(w.blockAt(0,4,-1),4);
});
test("removing a solo repeater cancels queued state", () => {
  const w = createWorld(); w.runtime.onBlockChanged(0,4,1); w.setBlock(0,4,0,0); w.runtime.onBlockChanged(0,4,0);
  assert.equal(w.runtime.pending,0); w.runtime.advance(0.2); assert.equal(w.blockAt(0,4,-1),3);
});
test("solo runtime snapshot restores pending repeater and sub-tick progress", () => {
  const w = createWorld(); w.runtime.onBlockChanged(0,4,1); w.runtime.advance(0.02);
  const saved = w.runtime.snapshot(); const resumed = createSoloRedstoneRuntime({blockAt:w.blockAt,setBlock:w.setBlock,ids:IDS});
  resumed.restore(saved); resumed.advance(0.029); assert.equal(w.blockAt(0,4,-1),3);
  resumed.advance(0.001); assert.equal(w.blockAt(0,4,-1),4);
});

test("solo repeater state survives the JSON save/load round-trip", () => {
  const w = createWorld(); w.runtime.onBlockChanged(0,4,1); w.runtime.advance(0.02);
  const saved = JSON.parse(JSON.stringify(w.runtime.snapshot()));
  const resumed = createSoloRedstoneRuntime({blockAt:w.blockAt,setBlock:w.setBlock,ids:IDS});
  resumed.restore(saved); resumed.advance(0.029); assert.equal(w.blockAt(0,4,-1),3);
  resumed.advance(0.001); assert.equal(w.blockAt(0,4,-1),4);
});

test("solo autosave writes the circuit snapshot and manual load restores it safely", () => {
  const main = readFileSync(new URL("../src/client/main.ts", import.meta.url), "utf8");
  assert.match(main, /redstone: this\.soloRedstone\.snapshot\(\)/);
  assert.match(main, /this\.soloRedstone\.restore\(s\.redstone\)/);
  assert.match(main, /if \(s\.redstone\)/);
  assert.match(main, /catch \{ this\.soloRedstone\.clear\(\); \}/);
});
