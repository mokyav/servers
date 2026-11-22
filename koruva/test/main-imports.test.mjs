import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mainPath = resolve(root, "src/client/main.ts");
const main = readFileSync(mainPath, "utf8");
function targetFor(spec, typeOnly) {
  const base = resolve(dirname(mainPath), spec);
  const ext = base.slice(base.lastIndexOf("."));
  let candidates;
  if (ext === ".js") {
    const stem = base.slice(0, -3);
    candidates = typeOnly ? [`${stem}.d.ts`, base, `${stem}.ts`, `${stem}.tsx`] : [base, `${stem}.ts`, `${stem}.tsx`, `${stem}.d.ts`];
  } else if ([".ts", ".tsx"].includes(ext)) candidates = [base];
  else candidates = [`${base}.ts`, `${base}.js`, `${base}.d.ts`, `${base}/index.ts`, `${base}/index.js`];
  return candidates.find(existsSync);
}
function exportedNames(source) {
  const names = new Set();
  for (const m of source.matchAll(/\bexport\s+(?:declare\s+)?(?:async\s+)?(?:function|class|const|let|var|enum|type|interface)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of source.matchAll(/\bexport\s*\{([^}]+)\}/g)) for (const raw of m[1].split(",")) {
    const item = raw.trim().replace(/^type\s+/, ""); const name = item.split(/\s+as\s+/)[0].trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
  }
  return names;
}
test("main.ts imports every local module through an exported name", () => {
  const imports = [...main.matchAll(/^import\s+(type\s+)?(.+?)\s+from\s+["']([^"']+)["']\s*;?\s*$/gm)];
  const checked = new Set();
  for (const m of imports) {
    const typeOnly = Boolean(m[1]), clause = m[2].trim(), spec = m[3];
    if (!spec.startsWith(".")) continue;
    const target = targetFor(spec, typeOnly); assert.ok(target, `missing local module ${spec}`);
    const named = clause.match(/^\{([\s\S]*)\}$/); assert.ok(named, `local import must use named exports: ${m[0]}`);
    const available = exportedNames(readFileSync(target, "utf8"));
    for (const raw of named[1].split(",")) {
      const token = raw.trim().replace(/^type\s+/, ""); const imported = token.split(/\s+as\s+/)[0].trim();
      if (!imported) continue;
      assert.ok(available.has(imported), `${imported} is not exported by ${spec}`); checked.add(`${spec}:${imported}`);
    }
  }
  assert.ok(checked.size >= 117, `expected to verify at least 117 imports; checked ${checked.size}`);
});
