import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/work/ProjectCountdownView.jsx", "utf8");
const styles = readFileSync("src/work/office.css", "utf8");

test("countdown detail exposes idle, running, finished, and claim content", () => {
  for (const text of ["项目倒计时", "暂无进行中的项目", "项目进行中", "工作结束", "点击领取报酬", "项目管理", "合同报酬", "预计完成"]) {
    assert.match(source, new RegExp(text));
  }
  assert.match(source, /timer\.display/);
  assert.match(source, /timer\.project/);
  assert.match(source, /onClaim/);
  assert.match(source, /onOpenProjects/);
});

test("renders the selected full-screen countdown with real contract clauses", () => {
  for (const text of ["合同内容", "合同范围", "交付物", "验收标准", "项目难度"]) {
    assert.match(source, new RegExp(text));
  }
  assert.doesNotMatch(source, /查看完整合同/);
  assert.match(source, /timer\.project\.scopeItems/);
  assert.match(source, /CircularProgressbarWithChildren/);
  assert.match(source, /timer\.progressPercent/);
  assert.match(source, /timer\.project\.deliverables/);
  assert.match(source, /timer\.project\.acceptanceCriteria/);
  assert.match(source, /role="progressbar"/);
  assert.match(styles, /project-countdown-background\.png/);
  assert.match(styles, /\.work-countdown-fixed-action/);
  assert.match(styles, /--countdown-reward-icon:/);
  assert.match(styles, /--countdown-delivery-icon:/);
  assert.match(styles, /--countdown-acceptance-icon:/);
  assert.match(styles, /min-height:\s*44px/);
});

test("repeats signed contract facts below the clauses like the selected visual", () => {
  assert.match(source, /work-countdown-contract-facts/);
  for (const text of ["合同报酬", "约定工期", "项目难度", "预计完成"]) {
    assert.match(source, new RegExp(text));
  }
});

test("uses the approved coral floating action and transparent running footer", () => {
  assert.match(source, /work-countdown-action-bar \$\{finished \? "is-finished" : "is-running"\}/);
  assert.match(styles, /\.work-countdown-action-bar\.is-running\s*\{[^}]*background:\s*transparent/s);
  assert.match(styles, /\.work-countdown-action-bar\.is-running \.work-countdown-fixed-action\s*\{[^}]*width:\s*58px[^}]*height:\s*58px[^}]*border:\s*0[^}]*border-radius:\s*50%[^}]*background:\s*var\(--countdown-live\)[^}]*color:\s*#fff/s);
  assert.match(styles, /\.work-project-countdown-page\s*\{[^}]*background-position:\s*center bottom/s);
  assert.match(styles, /\.work-countdown-hero\s*\{[^}]*background:\s*rgba\(255,255,255,\.64\)/s);
  assert.match(styles, /\.work-countdown-contract\s*\{[^}]*background:\s*rgba\(255,255,255,\.68\)/s);
});
