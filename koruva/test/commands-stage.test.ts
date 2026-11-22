import assert from "node:assert/strict";
import { COMMANDS, suggestCommand } from "../shared/commands";

const ctx = { players: ["Alex"], items: ["stone", "oak_planks"], foods: ["apple"], effects: ["speed", "night_vision"], mobs: ["zombie", "skeleton"] };
assert.deepEqual([...COMMANDS], ["clear", "claer", "difficulty", "dimension", "effect", "gamemode", "give", "givefood", "kill", "summon", "tp"]);
const commandNames = suggestCommand("/", 1, ctx);
assert.ok(commandNames?.options.includes("dimension"));
assert.ok(commandNames?.options.includes("givefood"));
assert.deepEqual(suggestCommand("/clear ", 7, ctx)?.options, ["@a", "@r", "@s", "@p", "Alex", ":Alex"]);
assert.ok(suggestCommand("/clear :A", 9, ctx)?.options.includes(":Alex"));
assert.ok(suggestCommand("/claer ", 7, ctx)?.options.includes("@p"));
assert.equal(suggestCommand("/clear @s ", 10, ctx), null); // /clear accepts only a target, not an item filter.
assert.ok(suggestCommand("/tp ", 4, ctx)?.options.includes("@p"));
assert.ok(suggestCommand("/tp ", 4, ctx)?.options.includes("~"));
const dimension = "/dimension n";
assert.ok(suggestCommand(dimension, dimension.length, ctx)?.options.includes("nether"));
const mode = "/gamemode c";
assert.ok(suggestCommand(mode, mode.length, ctx)?.options.includes("creative"));
const item = "/give @s st";
assert.ok(suggestCommand(item, item.length, ctx)?.options.includes("stone"));
console.log("stage command-completion tests passed");
