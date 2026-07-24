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
  assert.match(styles, /\.office-object\.desk\.boss\s*\{[^}]*top:\s*23%/s);
  assert.match(styles, /\.office-object\.tea\s*\{[^}]*top:\s*4%;[^}]*right:\s*0;[^}]*width:\s*58%;[^}]*height:\s*16%/s);
  assert.match(styles, /--walk-duration/);
  assert.doesNotMatch(styles, /\.office-object\.door|\.left-door|\.right-top-door|\.right-mid-door/);
});

test("office screen measures the scene and advances timed A star segments", () => {
  const screen = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  const scene = readFileSync("src/work/OfficeScene.jsx", "utf8");
  assert.match(screen, /sceneRef/);
  assert.match(screen, /createOfficeRoute/);
  assert.match(screen, /durationMs/);
  assert.doesNotMatch(screen, /430/);
  assert.match(scene, /getOfficePoint/);
  assert.doesNotMatch(scene, /OFFICE_NODES/);
});
