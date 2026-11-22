import test from "node:test";
import assert from "node:assert/strict";
import { createRepeaterDelayController } from "../shared/repeater-delay.js";

test("rising edges apply after exactly 1-4 configured redstone ticks", () => {
  for (let delay = 1; delay <= 4; delay++) {
    const q = createRepeaterDelayController();
    assert.equal(q.schedule(`r${delay}`, true, delay, 10), true);
    assert.deepEqual(q.advance(10 + delay - 1), []);
    assert.deepEqual(q.advance(10 + delay), [{ id: `r${delay}`, powered: true, dueTick: 10 + delay }]);
    assert.equal(q.getOutput(`r${delay}`), true);
  }
});
test("a pulse that ends before the delay expires cancels the pending turn-on", () => {
  const q = createRepeaterDelayController(); q.schedule("r", true, 3, 20);
  assert.equal(q.schedule("r", false, 1, 21), true); assert.equal(q.size, 0);
  assert.deepEqual(q.advance(30), []); assert.equal(q.getOutput("r"), false);
});
test("input changes cancel transitions that return to current output and delay turn-off", () => {
  const q = createRepeaterDelayController(); q.initialize("r", true);
  q.schedule("r", false, 2, 1); q.schedule("r", true, 4, 2); assert.equal(q.size, 0);
  q.schedule("r", false, 4, 3); assert.deepEqual(q.advance(6), []);
  assert.deepEqual(q.advance(7), [{ id: "r", powered: false, dueTick: 7 }]); assert.equal(q.getOutput("r"), false);
});
test("due transitions are deterministic and capacity-bounded", () => {
  const q = createRepeaterDelayController({ maxPending: 2 });
  assert.equal(q.schedule("z", true, 1, 0), true); assert.equal(q.schedule("b", true, 1, 0), true);
  assert.equal(q.schedule("a", true, 1, 0), false);
  assert.deepEqual(q.advance(1), [{ id: "b", powered: true, dueTick: 1 }, { id: "z", powered: true, dueTick: 1 }]);
  assert.equal(q.size, 0);
});
test("invalid inputs and backwards time are rejected", () => {
  const q = createRepeaterDelayController();
  assert.throws(() => q.schedule("r", true, 0, 0), /1 to 4/); assert.throws(() => q.schedule("r", true, 5, 0), /1 to 4/);
  assert.throws(() => q.schedule("r", 1, 2, 0), /boolean/); assert.throws(() => q.schedule("", true, 2, 0), /id/);
  assert.throws(() => q.advance(-1), /non-negative/); q.advance(3); assert.throws(() => q.advance(2), /backwards/);
});

test("pending transitions and output state survive snapshot/restore", () => {
 const a=createRepeaterDelayController(); a.initialize("0,4,0",true); a.schedule("1,4,0",true,2,7);
 const b=createRepeaterDelayController(); b.restore(a.snapshot());
 assert.equal(b.tick,7); assert.equal(b.getOutput("0,4,0"),true); assert.deepEqual(b.advance(8),[]);
 assert.deepEqual(b.advance(9),[{id:"1,4,0",powered:true,dueTick:9}]);
});
