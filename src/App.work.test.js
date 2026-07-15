import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("opens the dedicated animated Work app", () => {
  assert.match(app, /import WorkAppScreen from "\.\/work\/WorkAppScreen\.jsx"/);
  assert.match(app, /const isWork = app\.title === "工作"/);
  assert.match(app, /if \(isWork\) return <WorkAppScreen onClose=\{onClose\} \/>/);
});
