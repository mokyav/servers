// A stable, non-overlapping runtime ID space for all Minecraft inventory items.
// Block items keep their actual world-block runtime IDs; item-only entries follow the block range.
import { MINECRAFT_BLOCK_STATE_RUNTIME_ID_END, MINECRAFT_BLOCK_TO_RUNTIME_ID } from "./minecraft-block-runtime.js";
import { MINECRAFT_ITEM_IDS } from "./minecraft-item-catalog.js";
let nextId = MINECRAFT_BLOCK_STATE_RUNTIME_ID_END + 1;
const map = Object.create(null);
for (const identifier of MINECRAFT_ITEM_IDS) {
  const blockId = MINECRAFT_BLOCK_TO_RUNTIME_ID[identifier];
  map[identifier] = blockId !== undefined ? blockId : nextId++;
}
export const MINECRAFT_ITEM_TO_RUNTIME_ID = Object.freeze(map);
export const MINECRAFT_ITEM_RUNTIME_IDS = Object.freeze(MINECRAFT_ITEM_IDS.map((id) => map[id]).filter((id) => Number.isSafeInteger(id) && id > 0));
export const MINECRAFT_ITEM_RUNTIME_ID_END = nextId - 1;
