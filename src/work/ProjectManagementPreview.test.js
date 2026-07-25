import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/work/ProjectManagementPreview.jsx", "utf8");
const styles = readFileSync("src/work/office.css", "utf8");

test("project preview exposes the full mobile project card content", () => {
  for (const text of ["项目管理", "项目合同", "交付期限", "合同总额", "项目内容", "签署合同并开始"]) {
    assert.match(source, new RegExp(text));
  }
  assert.match(source, /projects\.map/);
  assert.match(source, /difficulty/);
});

test("project preview provides refresh loading and locked states", () => {
  assert.match(source, /generateWorkProjects/);
  assert.match(source, /正在生成项目/);
  assert.match(source, /合同已生效，本批合同已锁定/);
  assert.match(source, /合同执行中/);
  assert.match(source, /disabled=\{locked \|\| loading\}/);
  assert.match(source, /Array\.from\(\{ length: 5 \}\)/);
});

test("project preview consumes lifted project state and starts a timed contract", () => {
  assert.match(source, /projectState/);
  assert.match(source, /onProjectStateChange/);
  assert.match(source, /startWorkProject/);
  assert.match(source, /Date\.now/);
  assert.match(source, /副 API/);
  assert.match(source, /主 API/);
  assert.match(source, /原合同已保留/);
  assert.doesNotMatch(source, /WORK_PROJECTS_STORAGE_KEY|restoreWorkProjectState|serializeWorkProjectState/);
});

test("project page controls meet the mobile touch target requirement", () => {
  assert.match(styles, /\.work-projects-refresh\s*\{[^}]*min-width:\s*76px/s);
  assert.match(styles, /\.work-projects-refresh\s*\{[^}]*min-height:\s*44px/s);
  assert.match(styles, /\.work-project-start\s*\{[^}]*min-height:\s*46px/s);
});

test("project preview renders formal contract fields and signed state", () => {
  for (const text of ["项目合同", "待签署合同", "委托方", "CCAT 工作中心", "承接方", "合同总额", "人民币", "交付期限", "甲方签章", "乙方签章", "签署合同并开始", "已签署", "今日生效"]) {
    assert.match(source, new RegExp(text));
  }
  for (const className of ["work-contract-number", "work-contract-parties", "work-contract-terms", "work-contract-signatures", "work-contract-seal"]) {
    assert.match(source, new RegExp(className));
  }
  assert.match(styles, /--work-contract-seal:\s*#a92c2c/);
  assert.match(styles, /\.work-project-card::after/);
  assert.doesNotMatch(source, /WORK BOARD|ASSIGNMENT/);
});

test("formal contracts use white paper on the existing grey desk", () => {
  assert.match(styles, /--work-contract-paper:\s*#ffffff/);
  assert.match(styles, /background-color:\s*#dedbd3/);
  assert.doesNotMatch(styles, /--work-contract-paper:\s*#fbf7ea/);
});
