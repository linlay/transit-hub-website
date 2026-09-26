import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/modelColor.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } });
let saved = null;
const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
function load(localStorage = storage) {
  const context = { exports: {}, window: { localStorage } };
  vm.runInNewContext(outputText, context);
  return context.exports.modelColor;
}
const color = load();
const models = Array.from({ length: 8 }, (_, i) => `model-${i}`);
const original = models.map(color);
assert.equal(original[0], "#0a84ff");
assert.equal(new Set(original).size, 8);
const reload = load();
for (const model of [...models].reverse()) assert.equal(reload(model), original[models.indexOf(model)]);
assert.equal(reload(models[3]), original[3]);
const blocked = load({ getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
assert.equal(blocked("first"), "#0a84ff");
assert.notEqual(blocked("second"), blocked("first"));
console.log("Original multicolor palette, reordered/reloaded identity and unavailable storage passed.");
