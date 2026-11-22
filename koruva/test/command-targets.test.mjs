import test from "node:test";
import assert from "node:assert/strict";
import { resolveCommandTargets } from "../shared/command-targets.js";
const sockets = [{ id: "a" }, { id: "b" }, { id: "c" }];
const players = [
  { ws: sockets[0], st: { joined: true, name: "Alex", p: [50, 0, 0] } },
  { ws: sockets[1], st: { joined: true, name: "Bex", p: [4, 0, 0] } },
  { ws: sockets[2], st: { joined: true, name: "Cy", p: [10, 0, 0] } },
];
test("@a returns all players; @s and omitted target resolve to the issuer", () => {
  assert.deepEqual(resolveCommandTargets("@a", players, sockets[0]), players);
  assert.deepEqual(resolveCommandTargets("@s", players, sockets[1]), [players[1]]);
  assert.deepEqual(resolveCommandTargets(undefined, players, sockets[2]), [players[2]]);
});
test("@p includes the command sender, who is nearest to their own position", () => {
  assert.deepEqual(resolveCommandTargets("@p", players, sockets[0]), [players[0]]);
});
test("@r selects one player using the supplied random source", () => {
  assert.deepEqual(resolveCommandTargets("@r", players, sockets[0], () => 0.5), [players[1]]);
});
test("colon-prefixed and plain names are matched case-insensitively", () => {
  assert.deepEqual(resolveCommandTargets(":bEx", players, sockets[0]), [players[1]]);
  assert.deepEqual(resolveCommandTargets("Cy", players, sockets[0]), [players[2]]);
  assert.deepEqual(resolveCommandTargets(":", players, sockets[0]), []);
  assert.deepEqual(resolveCommandTargets("NotHere", players, sockets[0]), []);
});
