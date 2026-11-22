import { ENCHANTMENT_MAX_LEVEL, areEnchantmentsCompatible, isEnchantmentCompatible } from "./enchantments.js";
import { maxStackSizeForItemKey } from "./inventory-stacks.js";
import { repairMaterialValue } from "./item-durability.js";

const SLOT_RE = /^(hotbar:[0-8]|main:(?:[0-9]|1[0-9]|2[0-6])|armor:[0-3]|offhand:0|cursor:0|craft:[0-3]|craft-table:[0-8])$/;
const ITEM_RE = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;
const cleanName = (v) => typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 50) : "";

export function normalizeStackComponents(raw, slotItems = {}, blocks = []) {
  const out = Object.create(null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [slot, value] of Object.entries(raw)) {
    if (!SLOT_RE.test(slot) || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const expected = slotItems[slot];
    const itemId = Number(value.itemId);
    const count = Number(value.count);
    if (!Number.isSafeInteger(itemId) || itemId <= 0 || itemId >= blocks.length || !blocks[itemId]) continue;
    if (!Number.isSafeInteger(count) || count <= 0 || (expected && (expected.itemId !== itemId || expected.count < 1))) continue;
    const max = maxStackSizeForItemKey(blocks[itemId].key ?? "");
    const enchantments = Object.create(null);
    if (value.enchantments && typeof value.enchantments === "object" && !Array.isArray(value.enchantments)) {
      for (const [nameRaw, levelRaw] of Object.entries(value.enchantments)) {
        const name = String(nameRaw).replace(/^minecraft:/, "").toLowerCase();
        const level = Math.floor(Number(levelRaw));
        if (ENCHANTMENT_MAX_LEVEL[name] && level >= 1 && level <= ENCHANTMENT_MAX_LEVEL[name] && isEnchantmentCompatible(name, itemId, blocks)) enchantments[name] = level;
      }
      const names = Object.keys(enchantments);
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if (!areEnchantmentsCompatible(names[i], names[j])) delete enchantments[names[j]];
    }
    const charged = Array.isArray(value.chargedProjectiles) ? value.chargedProjectiles.filter((id) => Number.isSafeInteger(id) && id > 0 && id < blocks.length).slice(0, 3) : [];
    const damage = Math.max(0, Math.floor(Number(value.damage) || 0));
    const repairCost = Math.max(0, Math.min(127, Math.floor(Number(value.repairCost) || 0)));
    const customName = cleanName(value.customName);
    const stackId = typeof value.stackId === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(value.stackId) ? value.stackId : null;
    out[slot] = {
      itemId,
      count: Math.min(max, count),
      ...(stackId ? { stackId } : {}),
      ...(Object.keys(enchantments).length ? { enchantments } : {}),
      ...(damage ? { damage } : {}),
      ...(repairCost ? { repairCost } : {}),
      ...(customName ? { customName } : {}),
      ...(charged.length ? { chargedProjectiles: charged } : {}),
    };
  }
  return out;
}

export function makeStackRecord(itemId, count, components = {}, stackId = null) {
  return {
    itemId: Math.max(0, Math.floor(Number(itemId) || 0)),
    count: Math.max(0, Math.floor(Number(count) || 0)),
    ...(stackId ? { stackId } : {}),
    ...(components.enchantments && Object.keys(components.enchantments).length ? { enchantments: { ...components.enchantments } } : {}),
    ...(Number.isFinite(components.damage) && components.damage > 0 ? { damage: Math.floor(components.damage) } : {}),
    ...(Number.isFinite(components.repairCost) && components.repairCost > 0 ? { repairCost: Math.floor(components.repairCost) } : {}),
    ...(cleanName(components.customName) ? { customName: cleanName(components.customName) } : {}),
    ...(Array.isArray(components.chargedProjectiles) && components.chargedProjectiles.length ? { chargedProjectiles: components.chargedProjectiles.slice(0, 3) } : {}),
  };
}

export function stackDataForSlot(stackData, slot, itemId, count) {
  const entry = stackData?.[slot];
  if (!entry || entry.itemId !== itemId || entry.count <= 0 || count <= 0) return null;
  return makeStackRecord(itemId, Math.min(count, entry.count), entry, entry.stackId);
}

export function withStackEnchantments(legacy, stackData, slot, itemId) {
  const hasSlotRecord = !!(stackData?.[slot] && Number(stackData[slot].itemId) === itemId);
  const stack = hasSlotRecord ? stackDataForSlot(stackData, slot, itemId, 1) : null;
  const enchants = hasSlotRecord ? (stack?.enchantments ?? {}) : (legacy?.[String(itemId)] ?? {});
  return { ...(legacy ?? {}), [String(itemId)]: { ...enchants } };
}

export function setStackEnchantment(stackData, slot, itemId, count, enchantmentId, level, blocks) {
  const name = String(enchantmentId ?? "").replace(/^minecraft:/, "").toLowerCase();
  const n = Math.floor(Number(level));
  if (!SLOT_RE.test(slot) || !isEnchantmentCompatible(name, itemId, blocks) || !Number.isSafeInteger(n) || n < 1 || n > ENCHANTMENT_MAX_LEVEL[name]) return null;
  const old = stackDataForSlot(stackData, slot, itemId, count) ?? makeStackRecord(itemId, count);
  const next = { ...(old.enchantments ?? {}) };
  if (Object.keys(next).some((other) => other !== name && !areEnchantmentsCompatible(other, name))) return null;
  next[name] = n;
  return { ...(stackData ?? {}), [slot]: makeStackRecord(itemId, count, { ...old, enchantments: next }, old.stackId) };
}

export function moveStackData(stackData, from, to, itemId, count, { split = false } = {}) {
  if (!SLOT_RE.test(from) || !SLOT_RE.test(to) || from === to) return stackData ?? {};
  const next = { ...(stackData ?? {}) };
  const source = next[from];
  if (!source || source.itemId !== itemId) return next;
  if (split) {
    next[to] = makeStackRecord(itemId, count, source, null);
  } else {
    next[to] = makeStackRecord(itemId, count, source, source.stackId);
    delete next[from];
  }
  return next;
}

function priorWorkCost(record) { return Math.max(0, Math.min(127, Number(record?.repairCost) || 0)); }
function enchantCost(name, level) {
  const weights = { mending: 4, unbreaking: 2, protection: 2, sharpness: 2, efficiency: 2, fortune: 4, silk_touch: 4, thorns: 8, wind_burst: 8, breach: 4, density: 2, binding_curse: 8, vanishing_curse: 8 };
  return (weights[name] ?? 2) * Math.max(1, level);
}

export function combineAnvilStacks(first, second, { blocks, maxDamage = 0, rename = "" } = {}) {
  if (!first || !second || first.itemId <= 0 || second.itemId <= 0) return { ok: false, reason: "empty" };
  const sameItem = first.itemId === second.itemId;
  const secondKey = blocks?.[second.itemId]?.key ?? "";
  const enchantedBook = secondKey.endsWith(":enchanted_book");
  const repairValue = !sameItem && !enchantedBook ? repairMaterialValue(blocks?.[first.itemId]?.key, secondKey, maxDamage) : 0;
  if (!sameItem && !enchantedBook && repairValue <= 0) return { ok: false, reason: "incompatible_items" };
  const ench = { ...(first.enchantments ?? {}) };
  let cost = priorWorkCost(first) + priorWorkCost(second);
  for (const [name, raw] of Object.entries(second.enchantments ?? {})) {
    const incoming = Math.floor(Number(raw) || 0);
    if (!incoming) continue;
    for (const existing of Object.keys(ench)) if (existing !== name && !areEnchantmentsCompatible(existing, name)) return { ok: false, reason: "incompatible_enchantments" };
    const current = Math.floor(Number(ench[name]) || 0);
    const nextLevel = Math.min(ENCHANTMENT_MAX_LEVEL[name] ?? incoming, current === incoming ? current + 1 : Math.max(current, incoming));
    ench[name] = nextLevel;
    cost += enchantCost(name, nextLevel);
  }
  let damage = Math.max(0, Math.floor(Number(first.damage) || 0));
  if (maxDamage > 0 && sameItem) {
    const otherDamage = Math.max(0, Math.floor(Number(second.damage) || 0));
    damage = Math.max(0, damage + otherDamage - maxDamage - Math.floor(maxDamage * 0.12));
    if (otherDamage || damage < (first.damage ?? 0)) cost += 2;
  } else if (repairValue > 0) {
    damage = Math.max(0, damage - repairValue);
    cost += 1;
  }
  const customName = cleanName(rename) || first.customName || "";
  if (rename && customName !== first.customName) cost += 1;
  if (cost <= 0) cost = 1;
  if (cost > 39) return { ok: false, reason: "too_expensive", cost };
  const result = makeStackRecord(first.itemId, 1, { ...first, enchantments: ench, damage, customName, repairCost: Math.min(127, Math.max(priorWorkCost(first), priorWorkCost(second)) * 2 + 1) });
  return { ok: true, result, cost };
}

export function grindstoneStack(first, second = null, maxDamage = 0) {
  const source = first && first.itemId > 0 ? first : second;
  if (!source || source.itemId <= 0) return { ok: false, reason: "empty" };
  const retained = {};
  for (const [name, level] of Object.entries(source.enchantments ?? {})) if (name.endsWith("_curse")) retained[name] = level;
  const removedLevels = Object.entries(source.enchantments ?? {}).filter(([name]) => !name.endsWith("_curse")).reduce((n, [, level]) => n + Number(level || 0), 0);
  const repaired = second && first?.itemId === second?.itemId && maxDamage > 0
    ? Math.max(0, (Number(first.damage) || 0) + (Number(second.damage) || 0) - maxDamage - Math.floor(maxDamage * 0.05))
    : Math.max(0, Number(source.damage) || 0);
  return { ok: true, result: makeStackRecord(source.itemId, 1, { ...source, enchantments: retained, damage: repaired, repairCost: 0 }), experience: Math.floor(removedLevels / 2), removed: removedLevels };
}

export function slotKey(type, index = 0) {
  const key = `${type}:${index}`;
  return SLOT_RE.test(key) ? key : null;
}

export function validateStackComponents(raw, blocks, counts) {
  const normalized = normalizeStackComponents(raw, {}, blocks);
  const totals = new Map();
  for (const record of Object.values(normalized)) totals.set(record.itemId, (totals.get(record.itemId) ?? 0) + record.count);
  for (const [itemId, total] of totals) {
    if (total > Math.max(0, Math.floor(Number(counts?.[itemId]) || 0))) {
      for (const [slot, record] of Object.entries(normalized)) if (record.itemId === itemId) delete normalized[slot];
    }
  }
  return normalized;
}

export function migrateLegacyEnchantments(legacy, slotItems, blocks) {
  const out = Object.create(null);
  if (!legacy || typeof legacy !== "object") return out;
  for (const [idRaw, enchantments] of Object.entries(legacy)) {
    const itemId = Number(idRaw);
    if (!Number.isSafeInteger(itemId) || itemId <= 0) continue;
    const slot = Object.keys(slotItems ?? {}).find((key) => slotItems[key]?.itemId === itemId && slotItems[key]?.count > 0);
    if (!slot) continue;
    out[slot] = makeStackRecord(itemId, slotItems[slot].count, { enchantments });
  }
  return normalizeStackComponents(out, slotItems, blocks);
}
