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

test("office screen uses full-bleed floating controls", () => {
  const screen = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  const styles = readFileSync("src/work/office.css", "utf8");
  assert.match(screen, /work-office-shell/);
  assert.match(styles, /\.work-office-shell\s*\{[^}]*grid-template-rows:\s*1fr/s);
  assert.match(styles, /\.work-topbar\s*\{[^}]*position:\s*absolute/s);
  assert.match(styles, /\.work-bottom-nav\s*\{[^}]*position:\s*absolute/s);
});
