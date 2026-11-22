import { BLOCKS } from "../../shared/blocks";
import { blockIcon } from "./icons";
import { maxDurabilityForItemKey } from "../../shared/item-durability.js";

export type InventorySlotType = "hotbar" | "main" | "armor" | "offhand" | "craft" | "craft-table";
export interface InventorySlotRef { type: InventorySlotType; index: number }
export interface InventoryRenderState {
  hotbar: number[];
  hotbarCounts: number[];
  main: number[];
  mainCounts: number[];
  armor: number[];
  armorCounts: number[];
  offhand: number;
  offhandCount: number;
  craft: number[];
  craftCounts: number[];
  craftTable: number[];
  craftTableCounts: number[];
  counts: number[];
  selected: number;
  cursor: number;
  cursorCount: number;
  stackData?: Record<string, { itemId?: number; damage?: number }>;
}

/** Minecraft Java-style survival inventory: 27 main slots, 9 hotbar slots, 4 armor slots and offhand. */
export class MinecraftInventoryUI {
  private bound = false;
  private state: InventoryRenderState | null = null;
  constructor(
    private readonly atlas: HTMLCanvasElement,
    private readonly onSlotClick: (slot: InventorySlotRef, event: PointerEvent) => void,
  ) {
    this.bind();
  }

  private bind() {
    if (this.bound) return;
    this.bound = true;
    const root = document.getElementById("inventory-layout");
    if (!root) return;
    root.addEventListener("pointerdown", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-slot-type][data-slot-index]");
      if (!target) return;
      const type = target.dataset.slotType as InventorySlotType;
      const index = Number(target.dataset.slotIndex);
      if (!["hotbar", "main", "armor", "offhand", "craft", "craft-table"].includes(type) || !Number.isInteger(index)) return;
      event.preventDefault();
      this.onSlotClick({ type, index }, event);
    });
    root.addEventListener("contextmenu", (event) => {
      if ((event.target as HTMLElement).closest("[data-slot-type]")) event.preventDefault();
    });
    document.addEventListener("pointermove", (event) => {
      const cursor = document.getElementById("mc-cursor-item");
      if (!cursor || cursor.hidden) return;
      cursor.style.left = `${event.clientX + 12}px`;
      cursor.style.top = `${event.clientY + 12}px`;
    });
  }

  render(state: InventoryRenderState) {
    this.state = state;
    this.renderSlots("player-armor-slots", state.armor, state.armorCounts, "armor", state.counts, ["helmet", "chestplate", "leggings", "boots"]);
    this.renderSlots("player-main-inventory", state.main, state.mainCounts, "main", state.counts);
    this.renderSlots("player-hotbar-slots", state.hotbar, state.hotbarCounts, "hotbar", state.counts);
    this.renderSlots("player-offhand-slot", [state.offhand], [state.offhandCount], "offhand", state.counts, ["shield"]);
    this.renderSlots("crafting-grid-2x2", state.craft, state.craftCounts, "craft", state.counts);
    this.renderSlots("crafting-grid-3x3", state.craftTable, state.craftTableCounts, "craft-table", state.counts);
    this.renderCursor(state.cursor, state.cursorCount, state.counts);
  }

  private renderSlots(hostId: string, ids: number[], stackCounts: number[], type: InventorySlotType, counts: number[], placeholders: string[] = []) {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.textContent = "";
    ids.forEach((id, index) => {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = `mc-slot${type === "craft" ? " craft-preview-slot" : ""}${type === "hotbar" && index === this.state?.selected ? " selected" : ""}`;
      slot.dataset.slotType = type;
      slot.dataset.slotIndex = String(index);
      slot.setAttribute("aria-label", id > 0 ? BLOCKS[id]?.name ?? `Item ${id}` : `${type} slot ${index + 1}`);
      if (id > 0 && BLOCKS[id]) {
        const img = document.createElement("img");
        img.src = blockIcon(this.atlas, id, 32);
        img.alt = BLOCKS[id].name;
        img.draggable = false;
        slot.appendChild(img);
        const amount = stackCounts[index] ?? counts[id] ?? 0;
        if (amount > 1) {
          const count = document.createElement("span");
          count.className = "mc-stack-count";
          count.textContent = String(amount);
          slot.appendChild(count);
        }
        slot.title = `${BLOCKS[id].name}${amount > 0 ? ` ×${amount}` : ""}`;
        const slotKey = type === "craft" ? `craft:${index}` : type === "craft-table" ? `craft-table:${index}` : `${type}:${index}`;
        this.appendDurabilityBar(slot, id, this.state?.stackData?.[slotKey]?.damage ?? 0);
      } else if (placeholders[index]) {
        slot.classList.add(`placeholder-${placeholders[index]}`);
        slot.title = placeholders[index];
      }
      if (type === "hotbar") {
        const key = document.createElement("span");
        key.className = "mc-slot-number";
        key.textContent = String(index + 1);
        slot.appendChild(key);
      }
      host.appendChild(slot);
    });
  }

  private appendDurabilityBar(slot: HTMLElement, itemId: number, damage: number) {
    const maximum = maxDurabilityForItemKey(BLOCKS[itemId]?.key);
    if (!maximum || !Number.isFinite(damage) || damage <= 0) return;
    const remaining = Math.max(0, maximum - Math.floor(damage));
    const ratio = remaining / maximum;
    const bar = document.createElement("span");
    bar.className = "mc-durability-bar";
    const fill = document.createElement("i");
    fill.style.width = `${ratio * 100}%`;
    fill.style.backgroundColor = ratio > 0.5 ? "#54c85a" : ratio > 0.25 ? "#e1c14a" : "#e14949";
    bar.appendChild(fill);
    slot.appendChild(bar);
    slot.title += ` · 耐久値 ${remaining}/${maximum}`;
  }

  private renderCursor(id: number, amount: number, counts: number[]) {
    const cursor = document.getElementById("mc-cursor-item");
    if (!cursor) return;
    cursor.textContent = "";
    cursor.hidden = !(id > 0 && BLOCKS[id]);
    if (cursor.hidden) return;
    const img = document.createElement("img");
    img.src = blockIcon(this.atlas, id, 32);
    img.alt = BLOCKS[id].name;
    cursor.appendChild(img);
    const stackAmount = amount || counts[id] || 0;
    if (stackAmount > 1) {
      const count = document.createElement("span");
      count.textContent = String(stackAmount);
      cursor.appendChild(count);
    }
  }
}


/** Keep the creative item catalogue separate from the player inventory panel. */
export function inventoryPanelVisibility(gameMode: string, workbenchOpen = false) {
  const creativeInventory = (gameMode === "creative" || gameMode === "spectator") && !workbenchOpen;
  return {
    creativeInventory,
    survivalInventory: !creativeInventory,
  };
}
