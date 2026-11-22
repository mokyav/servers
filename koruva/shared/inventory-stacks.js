import { MINECRAFT_ITEM_STACK_SIZES } from "./minecraft-item-stack-sizes.js";

/** Minecraft-like stack sizing and storage-capacity helpers. */
const HOTBAR_SLOTS = 9;
const MAIN_SLOTS = 27;
export const PLAYER_STORAGE_SLOT_COUNT = HOTBAR_SLOTS + MAIN_SLOTS;
export const PLAYER_TOTAL_SLOT_COUNT = PLAYER_STORAGE_SLOT_COUNT + 4 + 1 + 4 + 9 + 1; // armor, offhand, crafting, table, cursor

/**
 * Resolve vanilla Java items from the versioned registry rather than guessing
 * from name fragments (e.g. spawn eggs, banner patterns and boats overlap).
 * Custom namespaces keep conservative category fallbacks for Koruva items.
 */
export function maxStackSizeForItemKey(key = "") {
  const id = String(key).toLowerCase();
  if (id.startsWith("minecraft:")) {
    const itemPath = id.slice("minecraft:".length);
    return MINECRAFT_ITEM_STACK_SIZES[itemPath] ?? 64;
  }

  const itemPath = id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
  if (/(?:_sword|_pickaxe|_axe|_shovel|_hoe|_spear|_helmet|_chestplate|_leggings|_boots|_mace|_horse_armor|_shulker_box|_boat|_raft|_bed|_bundle)$/.test(itemPath)
    || /^(?:bow|crossbow|trident|shield|elytra|fishing_rod|flint_and_steel|shears|carrot_on_a_stick|warped_fungus_on_a_stick|brush|spyglass|water_bucket|lava_bucket|milk_bucket|powder_snow_bucket|cod_bucket|salmon_bucket|tropical_fish_bucket|pufferfish_bucket|axolotl_bucket|tadpole_bucket|sulfur_cube_bucket|(?:[a-z0-9_]+_)?minecart|saddle|totem_of_undying|goat_horn|bundle|enchanted_book|writable_book|knowledge_book|debug_stick|music_disc_[a-z0-9_]+|potion|splash_potion|lingering_potion|beetroot_soup|mushroom_stew|rabbit_stew|suspicious_stew|cake)$/.test(itemPath)
    || id.startsWith("koruva:potion_")) return 1;

  if (/^(?:bucket|ender_pearl|snowball|egg|blue_egg|brown_egg|honey_bottle|armor_stand)$/.test(itemPath)
    || /(?:_sign|_hanging_sign|_banner|_cushion)$/.test(itemPath)) return 16;

  return 64;
}

/** Maximum count representable across the selected set of tracked inventory slots. */
export function maxInventoryCountForItemKey(key = "", slots = PLAYER_TOTAL_SLOT_COUNT) {
  const safeSlots = Number.isSafeInteger(slots) ? Math.max(0, slots) : PLAYER_TOTAL_SLOT_COUNT;
  return maxStackSizeForItemKey(key) * safeSlots;
}

/** Right click picks ceil(stack/2), leaving floor(stack/2) in the slot. */
export function splitStackInHalf(amount) {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  const taken = Math.ceil(safe / 2);
  return { taken, remaining: safe - taken };
}

/** Merge as many incoming items as fit, returning moved and leftover counts. */
export function mergeStackAmounts(current, incoming, limit = 64) {
  const have = Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0;
  const add = Number.isFinite(incoming) ? Math.max(0, Math.floor(incoming)) : 0;
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 64;
  const moved = Math.min(add, Math.max(0, cap - have));
  return { moved, total: have + moved, remaining: add - moved };
}

/** Compares item components, not the number of items in the stack. */
export function stackComponentsEqual(a, b) {
  const clean = (v) => JSON.stringify({
    enchantments: Object.fromEntries(Object.entries(v?.enchantments ?? {}).sort(([x], [y]) => x.localeCompare(y))),
    damage: Number(v?.damage ?? 0),
    repairCost: Number(v?.repairCost ?? 0),
    customName: v?.customName ?? "",
    chargedProjectiles: Array.isArray(v?.chargedProjectiles) ? v.chargedProjectiles : [],
  });
  return clean(a) === clean(b);
}

/**
 * Number of plain/compatible items that can still enter the 36 storage slots.
 * Current aggregate counts account for legacy saves whose slot snapshot is missing.
 */
export function inventoryStorageCapacity(stackData, itemId, blocks, currentCount = 0, incomingComponents = null) {
  if (!Number.isSafeInteger(itemId) || itemId <= 0 || !Array.isArray(blocks) || !blocks[itemId]) return 0;
  const limit = maxStackSizeForItemKey(blocks[itemId].key ?? "");
  const data = stackData && typeof stackData === "object" && !Array.isArray(stackData) ? stackData : {};
  let free = 0;
  let empty = 0;
  let trackedItemCount = 0;

  for (const record of Object.values(data)) {
    if (record && record.itemId === itemId && Number.isSafeInteger(record.count) && record.count > 0) {
      trackedItemCount += record.count;
    }
  }

  for (const type of ["hotbar", "main"]) {
    const length = type === "hotbar" ? HOTBAR_SLOTS : MAIN_SLOTS;
    for (let index = 0; index < length; index++) {
      const record = data[`${type}:${index}`];
      if (!record || !Number.isSafeInteger(record.itemId) || record.itemId <= 0 ||
          !Number.isSafeInteger(record.count) || record.count <= 0) {
        empty++;
        continue;
      }
      if (record.itemId === itemId && stackComponentsEqual(record, incomingComponents)) {
        free += Math.max(0, limit - Math.min(limit, record.count));
      }
    }
  }

  const current = Number.isFinite(currentCount) ? Math.max(0, Math.floor(currentCount)) : 0;
  const untracked = Math.max(0, current - trackedItemCount);
  const reservedEmpty = Math.min(empty, Math.ceil(untracked / limit));
  // Assume untracked legacy items are plain and packed into the fewest available slots.
  if (stackComponentsEqual(incomingComponents, null)) {
    free += Math.max(0, reservedEmpty * limit - untracked);
  }
  free += Math.max(0, empty - reservedEmpty) * limit;
  return Math.max(0, Math.floor(free));
}
