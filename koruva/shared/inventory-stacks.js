/** Minecraft-like stack helpers shared by the inventory UI and tests. */
export function maxStackSizeForItemKey(key = "") {
  const id = String(key).toLowerCase();
  if (/(?:_sword|_pickaxe|_axe|_shovel|_hoe|_helmet|_chestplate|_leggings|_boots)$/.test(id)
    || /(?:^|:)(?:bow|crossbow|trident|shield|elytra|fishing_rod|flint_and_steel|shears|carrot_on_a_stick|warped_fungus_on_a_stick|brush|spyglass|compass|clock|recovery_compass|water_bucket|lava_bucket|powder_snow_bucket|cod_bucket|salmon_bucket|tropical_fish_bucket|pufferfish_bucket|axolotl_bucket|tadpole_bucket|minecart|chest_minecart|furnace_minecart|saddle|totem_of_undying|name_tag|lead|goat_horn|bundle)$/.test(id)
    || /(?:^|:)(?:potion|splash_potion|lingering_potion)$/.test(id)
    || id.startsWith("koruva:potion_")) return 1;
  if (/(?:ender_pearl|snowball|egg|honey_bottle|sign|banner|boat|bucket)$/.test(id)) return 16;
  return 64;
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
