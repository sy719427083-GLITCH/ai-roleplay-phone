import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/work/WorkSettings.jsx", "utf8");
const styles = readFileSync("src/work/office.css", "utf8");

test("settings explains and confirms the Work-only reset", () => {
  for (const text of [
    "工作设置",
    "存储与重置",
    "清除工作缓存",
    "清除工作缓存？",
    "公司名称、员工安排、项目列表和倒计时",
    "钱包、API 和角色资料不会被删除",
    "取消",
    "确认清除",
    "清除失败，请重试",
  ]) {
    assert.match(source, new RegExp(text));
  }
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /clearWorkCache\(window\.localStorage\)/);
  assert.match(styles, /\.work-settings-clear\s*\{[^}]*min-height:\s*48px/s);
  assert.match(styles, /\.work-cache-confirm-action\s*\{[^}]*min-height:\s*48px/s);
});

test("settings exposes accessible local and AI director modes", () => {
  for (const text of ["自主行为模式", "A 本地调度（推荐）", "B AI 导演", "AI 不可用时自动使用本地调度"]) assert.match(source, new RegExp(text));
  assert.match(source, /role="radiogroup"/);
  assert.match(source, /role="radio"/);
  assert.match(source, /aria-checked=/);
  assert.match(styles, /\.work-mode-option\s*\{[^}]*min-height:\s*52px/s);
});
