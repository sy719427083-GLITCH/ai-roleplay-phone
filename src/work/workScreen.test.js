import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("work screen contains approved controls and blank management views", () => {
  const source = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  for (const text of ["项目管理", "工作倒计时", "员工管理", "暂时留空", "工作设置"]) assert.match(source, new RegExp(text));
});

test("office scene uses semantic object buttons", () => {
  const source = readFileSync("src/work/OfficeScene.jsx", "utf8");
  assert.match(source, /<button/);
  assert.match(source, /aria-label=/);
});
