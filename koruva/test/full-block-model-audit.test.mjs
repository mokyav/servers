import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MINECRAFT_BLOCK_MODEL_REGISTRY as registry } from "../shared/minecraft-block-model-registry.js";
import {
  MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID,
  MINECRAFT_BLOCK_RUNTIME_ID_START,
} from "../shared/minecraft-block-runtime.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directions = new Set(["down", "up", "north", "south", "west", "east"]);
const textures = new Set(registry.textures);

test("every generated blockstate instance and model face has valid geometry and UV data", () => {
  assert.ok(registry.models.length > 0, "generated model registry must not be empty");
  assert.ok(registry.textures.length > 0, "generated texture registry must not be empty");

  let instanceCount = 0;
  let elementCount = 0;
  let faceCount = 0;
  const invalid = [];

  for (const [idText, instances] of registry.byId.entries()) {
    if (!Array.isArray(instances)) {
      invalid.push(`blockstate ${idText}: instance list is not an array`);
      continue;
    }
    for (const instance of instances) {
      instanceCount++;
      if (!Number.isInteger(instance.m) || instance.m < 0 || instance.m >= registry.models.length) {
        invalid.push(`blockstate ${idText}: model index ${instance.m} is invalid`);
        continue;
      }
      if (![instance.x, instance.y, instance.z].every(Number.isFinite)) {
        invalid.push(`blockstate ${idText}: transform contains non-finite rotation`);
      }
      const model = registry.models[instance.m];
      if (!model || !Array.isArray(model.elements)) {
        invalid.push(`blockstate ${idText}: model ${instance.m} has no element list`);
        continue;
      }
      for (const [elementIndex, element] of model.elements.entries()) {
        elementCount++;
        if (!Array.isArray(element.from) || !Array.isArray(element.to)
          || element.from.length !== 3 || element.to.length !== 3
          || ![...element.from, ...element.to].every(Number.isFinite)) {
          invalid.push(`model ${instance.m} element ${elementIndex}: invalid bounds`);
        }
        for (const [direction, face] of Object.entries(element.faces ?? {})) {
          faceCount++;
          if (!directions.has(direction)) invalid.push(`model ${instance.m}: invalid face direction ${direction}`);
          if (!face || typeof face.texture !== "string" || !textures.has(face.texture)) {
            invalid.push(`model ${instance.m} ${direction}: texture missing from atlas registry (${face?.texture})`);
          }
          if (face?.uv !== null && face?.uv !== undefined) {
            if (!Array.isArray(face.uv) || face.uv.length !== 4
              || !face.uv.every(Number.isFinite)
              || face.uv.some(value => value < 0 || value > 16)) {
              invalid.push(`model ${instance.m} ${direction}: invalid UV rectangle ${JSON.stringify(face.uv)}`);
            }
          }
          if (![0, 90, 180, 270].includes(face?.rotation ?? 0)) {
            invalid.push(`model ${instance.m} ${direction}: unsupported UV rotation ${face?.rotation}`);
          }
        }
      }
    }
  }

  console.log(`[Block model audit] models=${registry.models.length}, textures=${registry.textures.length}, instances=${instanceCount}, elements=${elementCount}, faces=${faceCount}`);
  assert.deepEqual(invalid.slice(0, 20), [], invalid.slice(0, 20).join("\\n"));
});

test("every generated model texture resolves to a bundled PNG", () => {
  const missing = [];
  for (const resource of registry.textures) {
    if (typeof resource !== "string" || !resource.startsWith("minecraft:")) {
      missing.push(`unsupported resource ID: ${resource}`);
      continue;
    }
    const relative = resource.slice("minecraft:".length);
    const file = path.join(root, "src/client/public/assets/minecraft/textures", `${relative}.png`);
    if (!existsSync(file)) missing.push(`${resource} -> ${file}`);
  }
  console.log(`[Block texture audit] referenced PNGs=${registry.textures.length}, missing=${missing.length}`);
  assert.deepEqual(missing.slice(0, 20), [], missing.slice(0, 20).join("\\n"));
});

test("report registered blockstates without a generated model instead of silently hiding them", () => {
  const missing = [];
  let total = 0;
  for (const [idText, meta] of Object.entries(MINECRAFT_BLOCK_STATE_BY_RUNTIME_ID)) {
    const id = Number(idText);
    if (id < MINECRAFT_BLOCK_RUNTIME_ID_START) continue;
    total++;
    if (!registry.byId[id]?.length) missing.push({ id, token: meta.token, kind: meta.kind, state: meta.state });
  }
  console.log(`[Block state coverage] registered=${total}, modeled=${total - missing.length}, fallback=${missing.length}`);
  if (missing.length) console.log(`[Block state fallback examples] ${JSON.stringify(missing.slice(0, 80))}`);
  // Some technical/no-render blockstates are intentionally handled by the voxel fallback.
  // Keep the list visible so new omissions are caught during review.
  assert.ok(missing.length <= Math.max(32, Math.ceil(total * 0.01)),
    `too many blockstates lack official model geometry: ${missing.length}/${total}`);
});
