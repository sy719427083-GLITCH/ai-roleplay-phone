import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/work/ProjectManagementPreview.jsx", "utf8");
const styles = readFileSync("src/work/office.css", "utf8");

test("project preview exposes the full mobile project card content", () => {
  for (const text of ["项目管理", "今日项目", "项目时间", "项目金额", "项目内容", "开始项目"]) {
    assert.match(source, new RegExp(text));
  }
  assert.match(source, /projects\.map/);
  assert.match(source, /difficulty/);
});

test("project preview provides refresh loading and locked states", () => {
  assert.match(source, /650/);
  assert.match(source, /正在刷新项目/);
  assert.match(source, /项目进行中，今日列表已锁定/);
  assert.match(source, /项目进行中/);
  assert.match(source, /disabled=\{locked \|\| refreshing\}/);
  assert.match(source, /Array\.from\(\{ length: 5 \}\)/);
});

test("project page controls meet the mobile touch target requirement", () => {
  assert.match(styles, /\.work-projects-refresh\s*\{[^}]*min-width:\s*68px;[^}]*min-height:\s*44px/s);
  assert.match(styles, /\.work-project-start\s*\{[^}]*min-height:\s*46px/s);
});

test("project preview uses the approved editorial task-board hierarchy", () => {
  for (const text of ["WORK BOARD", "今日项目", "个新项目等待认领", "刷新"]) {
    assert.match(source, new RegExp(text));
  }
  for (const className of ["work-projects-kicker", "work-projects-count", "work-project-price", "work-project-ticket-meta", "is-muted"]) {
    assert.match(source, new RegExp(className));
  }
  assert.match(styles, /--work-editorial-navy:\s*#17233d/);
  assert.match(styles, /--work-editorial-acid:\s*#b9ee43/);
  assert.doesNotMatch(styles, /\.work-project-start\s*\{[^}]*linear-gradient/s);
});
