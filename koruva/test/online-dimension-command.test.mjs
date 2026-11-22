import test from "node:test";
import assert from "node:assert/strict";
import { DIMENSION_IDS, resolveDimensionAlias } from "../shared/dimensions.js";

test("online dimension command resolves supported names and aliases", () => {
  assert.equal(resolveDimensionAlias("overworld"), DIMENSION_IDS.OVERWORLD);
  assert.equal(resolveDimensionAlias("Nether"), DIMENSION_IDS.NETHER);
  assert.equal(resolveDimensionAlias("the_nether"), DIMENSION_IDS.NETHER);
  assert.equal(resolveDimensionAlias("End"), DIMENSION_IDS.END);
  assert.equal(resolveDimensionAlias("the_end"), DIMENSION_IDS.END);
});

test("online dimension command rejects unsupported or empty targets", () => {
  assert.equal(resolveDimensionAlias(""), null);
  assert.equal(resolveDimensionAlias("moon"), null);
  assert.equal(resolveDimensionAlias("minecraft:nether"), null);
});
