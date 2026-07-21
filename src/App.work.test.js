import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("work launcher opens the isolated Work screen", () => {
  const source = readFileSync("src/App.jsx", "utf8");
  assert.match(source, /import \{ WorkAppScreen \} from "\.\/work\/WorkAppScreen\.jsx"/);
  assert.match(source, /<WorkAppScreen/);
});
